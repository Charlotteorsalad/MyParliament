#!/usr/bin/env python3
"""
Daily Hansard Scraper

Runs every day at 08:00 MYT (triggered by OS cron / Task Scheduler).

Algorithm:
  1. Query HansardDocument for the latest hansardDate already in the DB.
  2. Build the list of every weekday (Mon–Fri) from that date up to today.
  3. For each date, derive the expected PDF URL and check whether it already
     exists in the DB (the latest date itself is re-checked each run in case
     it was a partial day when last stored).
  4. Download and store any missing documents.
  5. Log the run to ScheduledJobExecution (admin cron analytics).

Falls back to a configurable lookback window (--fallback-days, default 30)
when HansardDocument is completely empty.

Usage:
    python daily_scraper.py                        # normal daily run
    python daily_scraper.py --fallback-days 60     # empty-DB fallback window
    python daily_scraper.py --dry-run              # preview without writing
"""
import argparse
import io
import os
import sys
import time
import uuid
import concurrent.futures
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pytz
import pymongo
import pdfplumber
import requests
import urllib3
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
_project_root = Path(__file__).resolve().parents[2]
_backend_env = _project_root / "3_app_system" / "backend" / ".env"
load_dotenv(_backend_env, override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/MyParliament")
HANSARD_PDF_URL_TEMPLATE = (
    "https://www.parlimen.gov.my/files/hindex/pdf/DR-{date}.pdf"
)
MY_TZ = pytz.timezone("Asia/Kuala_Lumpur")

# Constant job identity – must match whatever name the admin UI shows
SCRAPER_JOB_ID   = "daily_hansard_scraper"
SCRAPER_JOB_NAME = "Daily Hansard Scraper"
SCRAPER_SCHEDULE = "0 8 * * *"          # re-uses takwim_scheduler.DAILY_CRON_EXPRESSION

# MongoDB collection name Mongoose uses for ScheduledJobExecution.
# Mongoose lowercases and pluralises the model name:
#   ScheduledJobExecution  ->  scheduledjobexecutions
SCHEDULED_JOBS_COLLECTION = "scheduledjobexecutions"


# ---------------------------------------------------------------------------
# Admin cron-analytics logging
# ---------------------------------------------------------------------------

def log_job_execution(
    db,  # pymongo.database.Database
    *,
    status: str,
    start_time: datetime,
    end_time: datetime,
    output: str = "",
    error_message: str = "",
    extra: Optional[Dict] = None,
) -> None:
    """
    Insert one ScheduledJobExecution document so the admin cron-analytics
    dashboard (GET /admin/analytics/cron-jobs) picks up this run.

    Core fields match DevOpsMetrics.js → ScheduledJobExecutionSchema.
    Extra scraper-specific fields (dates_detected, dates_downloaded, etc.)
    are stored alongside — MongoDB ignores Mongoose strict mode when written
    via PyMongo, and the aggregation pipeline can read them freely.
    """
    try:
        duration_secs = max(0, int((end_time - start_time).total_seconds()))
        doc: Dict = {
            "jobId":        SCRAPER_JOB_ID,
            "jobName":      SCRAPER_JOB_NAME,
            "schedule":     SCRAPER_SCHEDULE,
            "status":       status,             # 'success' | 'failed' | 'skipped'
            "startTime":    start_time,
            "endTime":      end_time,
            "duration":     duration_secs,
            "output":       output[:2000],
            "errorMessage": error_message[:1000],
            "category":     "data_processing",
            "description":  (
                "Pulls new Hansard PDFs from parlimen.gov.my into HansardDocument. "
                "Window: latest DB date to today (weekdays only)."
            ),
            "createdAt":    end_time,
            # Scraper-specific fields for admin analytics
            "window_start":     (extra or {}).get("window_start", ""),
            "window_end":       (extra or {}).get("window_end", ""),
            "dates_checked":    (extra or {}).get("dates_checked", 0),
            "dates_detected":   (extra or {}).get("dates_detected", 0),
            "dates_downloaded": (extra or {}).get("dates_downloaded", 0),
            "dates_not_found":  (extra or {}).get("dates_not_found", 0),
        }
        db[SCHEDULED_JOBS_COLLECTION].insert_one(doc)
        print(
            f"[daily_scraper] Run logged to {SCHEDULED_JOBS_COLLECTION} "
            f"(status={status}, duration={duration_secs}s)"
        )
    except Exception as exc:
        # Non-fatal – logging failure must never crash the scraper
        print(f"[daily_scraper] Warning: could not log run to admin DB: {exc}")


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

class DailyHansardScraper:
    """
    Daily scraper that picks up exactly where the DB left off.

    Mirrors HansardScraper in
    1_data_pipeline/01_scraping/HistoricalScraper_v2.py but derives its
    date window dynamically from the latest hansardDate in HansardDocument.
    """

    def __init__(self, mongo_uri: str, max_workers: int = 5):
        self.max_workers = max_workers
        try:
            self.client = pymongo.MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=30000,
                socketTimeoutMS=None,
                maxPoolSize=50,
            )
            self.db = self.client["MyParliament"]
            self.collection = self.db["HansardDocument"]
            self._setup_indexes()
        except Exception as exc:
            print(f"[daily_scraper] MongoDB connection failed: {exc}")
            raise

    # ------------------------------------------------------------------
    def _setup_indexes(self):
        try:
            existing = self.collection.index_information()
            if "url_1" not in existing:
                self.collection.create_index(
                    [("url", pymongo.ASCENDING)], unique=True
                )
            if "hansardDate_1" not in existing:
                self.collection.create_index(
                    [("hansardDate", pymongo.ASCENDING)]
                )
        except Exception as exc:
            print(f"[daily_scraper] Index setup warning: {exc}")

    # ------------------------------------------------------------------
    def _latest_hansard_date(self) -> Optional[datetime]:
        """
        Return the most recent hansardDate stored in HansardDocument,
        stripped to midnight (no tzinfo), or None if the collection is empty.
        """
        try:
            doc = self.collection.find_one(
                {"hansardDate": {"$exists": True}},
                sort=[("hansardDate", pymongo.DESCENDING)],
                projection={"hansardDate": 1},
            )
            if doc and doc.get("hansardDate"):
                raw: datetime = doc["hansardDate"]
                # Strip timezone and time component for uniform comparison
                return raw.replace(hour=0, minute=0, second=0,
                                   microsecond=0, tzinfo=None)
        except Exception as exc:
            print(f"[daily_scraper] Could not query latest date: {exc}")
        return None

    # ------------------------------------------------------------------
    def _today(self) -> datetime:
        return datetime.now(MY_TZ).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
        )

    # ------------------------------------------------------------------
    def _candidate_dates(self, start: datetime) -> List[datetime]:
        """
        Return every weekday (Mon–Fri) from *start* up to and including today,
        in ascending order.
        """
        today = self._today()
        dates: List[datetime] = []
        cursor = start
        while cursor <= today:
            if cursor.weekday() < 5:  # 0=Mon … 4=Fri
                dates.append(cursor)
            cursor += timedelta(days=1)
        return dates

    # ------------------------------------------------------------------
    def _url_for_date(self, date: datetime) -> str:
        return HANSARD_PDF_URL_TEMPLATE.format(date=date.strftime("%d%m%Y"))

    # ------------------------------------------------------------------
    def _missing_dates(self, dates: List[datetime]) -> List[datetime]:
        """Filter down to dates whose Hansard URL is NOT yet in the DB."""
        missing = []
        for date in dates:
            url = self._url_for_date(date)
            try:
                if not self.collection.find_one({"url": url}):
                    missing.append(date)
            except Exception as exc:
                print(f"[daily_scraper] DB check error for {date.date()}: {exc}")
        return missing

    # ------------------------------------------------------------------
    def _fetch_and_store(self, date: datetime) -> Dict:
        """Download the PDF for *date*, extract text, and insert into MongoDB."""
        url = self._url_for_date(date)
        print(f"[daily_scraper] Fetching: {url}")

        for attempt in range(3):
            try:
                response = requests.get(url, timeout=30, verify=False)

                if response.status_code == 404:
                    print(f"[daily_scraper] No document for {date.date()} (404)")
                    return {"status": "skipped", "date": date,
                            "reason": "no_document", "detected": False}

                response.raise_for_status()

                content_type = response.headers.get("Content-Type", "")
                if "pdf" not in content_type.lower() and len(response.content) < 1000:
                    return {"status": "skipped", "date": date,
                            "reason": "invalid_content", "detected": False}

                # PDF exists and looks valid — considered "detected"
                text = self._extract_text(response.content)
                self._store(url, date, text)
                print(f"[daily_scraper] [OK] Stored: {date.date()}")
                return {"status": "success", "date": date, "detected": True}

            except requests.RequestException as exc:
                if attempt == 2:
                    return {
                        "status": "failed", "date": date, "detected": True,
                        "error": f"Request failed after 3 attempts: {exc}",
                    }
                time.sleep(5 * (attempt + 1))

            except Exception as exc:
                return {"status": "failed", "date": date, "detected": True,
                        "error": str(exc)}

        return {"status": "failed", "date": date, "detected": True,
                "error": "exhausted retries"}

    # ------------------------------------------------------------------
    def _extract_text(self, content: bytes) -> str:
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                pages = []
                for page in pdf.pages:
                    try:
                        pages.append(page.extract_text() or "")
                    except Exception:
                        pass
                return " ".join(pages)
        except Exception as exc:
            print(f"[daily_scraper] PDF extraction error: {exc}")
            raise

    # ------------------------------------------------------------------
    def _store(self, url: str, date: datetime, text: str):
        try:
            self.collection.insert_one(
                {
                    "url": url,
                    "downloadDate": datetime.now(MY_TZ),
                    "processedStatus": "completed",
                    "content_text": text,
                    "hansardDate": date,
                }
            )
        except pymongo.errors.DuplicateKeyError:
            print(f"[daily_scraper] Already exists (race condition): {url}")
        except Exception as exc:
            print(f"[daily_scraper] MongoDB insert error: {exc}")
            raise

    # ------------------------------------------------------------------
    def run(self, fallback_days: int = 30, dry_run: bool = False) -> Dict:
        """
        Main entry point.

        Determines the start date by querying the DB for the latest hansardDate.
        Falls back to *fallback_days* calendar days ago when the collection is empty.
        Logs every run to ScheduledJobExecution for admin cron analytics.

        Returns:
            {
                "new_docs": int,
                "skipped": int,        # 404 or already-in-DB
                "failed": int,
                "dates_checked": int,
                "start_date": str,     # ISO date used as window start
                "failures": list[dict],
            }
        """
        run_start = datetime.now(timezone.utc).replace(tzinfo=None)
        today = self._today()

        latest = self._latest_hansard_date()
        if latest:
            start = latest  # re-check from latest date onward
            print(
                f"[daily_scraper] Latest DB date: {latest.date()} — "
                f"checking from {latest.date()} to {today.date()}"
            )
        else:
            start = today - timedelta(days=fallback_days)
            print(
                f"[daily_scraper] HansardDocument is empty — "
                f"falling back to {fallback_days}-day window "
                f"({start.date()} to {today.date()})"
            )

        candidates = self._candidate_dates(start)
        print(f"[daily_scraper] {len(candidates)} candidate weekday(s) in window")

        missing = self._missing_dates(candidates)
        already_in_db = len(candidates) - len(missing)
        print(
            f"[daily_scraper] {already_in_db} already in DB, "
            f"{len(missing)} to fetch"
        )

        if dry_run:
            for date in missing:
                print(f"  [dry-run] Would fetch: {self._url_for_date(date)}")
            return {
                "new_docs": 0,
                "skipped": already_in_db,
                "failed": 0,
                "dates_checked": len(candidates),
                "start_date": start.date().isoformat(),
                "failures": [],
                "dry_run": True,
            }

        results: Dict = {
            "new_docs": 0,
            "already_in_db": already_in_db,
            "not_found": 0,       # 404 – Parliament didn't publish that day
            "detected": 0,        # PDF actually existed on the site
            "failed": 0,
            "dates_checked": len(candidates),
            "start_date": start.date().isoformat(),
            "failures": [],
        }

        if not missing:
            print("[daily_scraper] Nothing new to fetch.")
            run_end = datetime.now(timezone.utc).replace(tzinfo=None)
            log_job_execution(
                self.db,
                status="skipped",
                start_time=run_start,
                end_time=run_end,
                output=(
                    f"Window: {start.date()} to {today.date()} | "
                    f"{len(candidates)} weekdays checked, all already in DB."
                ),
                extra={
                    "window_start":      start.date().isoformat(),
                    "window_end":        today.date().isoformat(),
                    "dates_checked":     len(candidates),
                    "dates_detected":    0,
                    "dates_downloaded":  0,
                    "dates_not_found":   0,
                },
            )
            return results

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self.max_workers
        ) as executor:
            futures = {
                executor.submit(self._fetch_and_store, date): date
                for date in missing
            }
            for future in concurrent.futures.as_completed(futures):
                outcome = future.result()
                if outcome["status"] == "success":
                    results["new_docs"] += 1
                    results["detected"] += 1
                elif outcome["status"] == "skipped":
                    if outcome.get("reason") == "no_document":
                        results["not_found"] += 1
                    # invalid_content treated as not_found for rate purposes
                else:
                    results["failed"] += 1
                    if outcome.get("detected"):
                        results["detected"] += 1
                    results["failures"].append(
                        {
                            "date": outcome["date"].strftime("%Y-%m-%d"),
                            "error": outcome.get("error", "unknown"),
                        }
                    )

        run_end = datetime.now(timezone.utc).replace(tzinfo=None)
        final_status = (
            "failed"
            if results["failed"] > 0 and results["new_docs"] == 0
            else "success"
        )
        output_summary = (
            f"Window: {start.date()} to {today.date()} | "
            f"checked={results['dates_checked']} "
            f"detected={results['detected']} "
            f"downloaded={results['new_docs']} "
            f"not_found={results['not_found']} "
            f"failed={results['failed']}"
        )
        error_msg = "; ".join(
            f"{f['date']}: {f['error']}" for f in results["failures"]
        )
        log_job_execution(
            self.db,
            status=final_status,
            start_time=run_start,
            end_time=run_end,
            output=output_summary,
            error_message=error_msg,
            extra={
                "window_start":      start.date().isoformat(),
                "window_end":        today.date().isoformat(),
                "dates_checked":     results["dates_checked"],
                "dates_detected":    results["detected"],
                "dates_downloaded":  results["new_docs"],
                "dates_not_found":   results["not_found"],
            },
        )

        return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Daily Hansard scraper – picks up from latest DB date to today"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python daily_scraper.py                      # normal daily run
  python daily_scraper.py --fallback-days 60   # empty-DB window
  python daily_scraper.py --dry-run            # preview without writing
        """,
    )
    parser.add_argument(
        "--fallback-days",
        type=int,
        default=30,
        help=(
            "Calendar days to look back when HansardDocument is empty "
            "(default: 30)"
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be fetched without writing to DB",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("DAILY HANSARD SCRAPER")
    print(f"Run time: {datetime.now(MY_TZ).strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print("=" * 60)

    try:
        scraper = DailyHansardScraper(MONGO_URI)
        results = scraper.run(
            fallback_days=args.fallback_days,
            dry_run=args.dry_run,
        )
    except Exception as exc:
        print(f"[daily_scraper] Fatal error: {exc}")
        sys.exit(1)

    print("\n=== SCRAPE SUMMARY ===")
    print(f"  Window start  : {results['start_date']}")
    print(f"  Dates checked : {results['dates_checked']}")
    print(f"  Already in DB : {results['already_in_db']}")
    print(f"  Detected (PDF): {results['detected']}")
    print(f"  New docs added: {results['new_docs']}")
    print(f"  Not found (404): {results['not_found']}")
    print(f"  Failed        : {results['failed']}")

    if results["failures"]:
        print("\n  Failures:")
        for f in results["failures"]:
            print(f"    {f['date']}: {f['error']}")

    sys.exit(0)


if __name__ == "__main__":
    main()
