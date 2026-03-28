#!/usr/bin/env python3
"""
Takwim-based Intelligent Scheduler

This script manages intelligent scheduling based on Parliament Takwim (calendar):
- Validates and syncs Takwim data monthly
- During active mesyuarat (session): daily incremental processing
- After mesyuarat ends: full reprocessing for data integrity

Daily pipeline triggered at 08:00 MYT (--auto-process):
  Step 0  daily_scraper.py           → HansardDocument  (pull new PDFs)
  Step 1  preprocess_pipeline.py     → hansard_cpatf    (cleaned text)
  Step 2  production_inference.py    → hansard_inference (clusters)
  Step 3  topic_generation.py        → hansard_topic    (topic labels)
  Step 4  arima_forecast.py          → hansard_arima    (time series forecasts)
  Step 5  topic_analysis.py          → hansard_analysis (advanced insights)

Cron expression (Linux/macOS – add via `crontab -e`):
    0 8 * * * /path/to/venv/bin/python /path/to/takwim_scheduler.py --auto-process >> /var/log/takwim_scheduler.log 2>&1

Windows Task Scheduler (PowerShell – run once as admin):
    setup_task_scheduler.ps1

How Incremental Mode Works:
- Checks for new documents in the last N days
- If new docs exist: re-clusters ALL documents (not just new ones)
- If no new docs: skips processing (saves compute)
- See INCREMENTAL_INFERENCE_GUIDE.md for details

Usage:
    python takwim_scheduler.py --validate-takwim          # Validate and sync Takwim
    python takwim_scheduler.py --check-session            # Check current session status
    python takwim_scheduler.py --scrape-new               # Only run step 0 (daily scraper)
    python takwim_scheduler.py --auto-process             # Smart processing based on Takwim
    python takwim_scheduler.py --auto-process --dry-run   # Preview what would be executed
"""
import argparse
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment
project_root = Path(__file__).resolve().parents[2]
backend_env_path = project_root / "3_app_system" / "backend" / ".env"
load_dotenv(backend_env_path, override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/MyParliament")
TAKWIM_URL = "https://www.parlimen.gov.my/takwim-dewan-rakyat.html?uweb=dr"
TAKWIM_COLLECTION = "parliament_takwim"

# Canonical cron expression for the daily 08:00 MYT job.
# Exposed as a module-level constant so tests can import and assert it.
DAILY_CRON_EXPRESSION = "0 8 * * *"
DAILY_SCRAPE_LOOKBACK_DAYS = int(os.getenv("DAILY_SCRAPE_LOOKBACK_DAYS", "7"))


def get_db():
    """Get MongoDB database connection."""
    client = MongoClient(MONGO_URI)
    return client["MyParliament"]


def parse_date_malay(date_str: str) -> Optional[datetime]:
    """
    Parse Malay date format to datetime.
    
    Examples:
        "19 Januari 2026" -> datetime(2026, 1, 19)
        "03 Mac 2026" -> datetime(2026, 3, 3)
    """
    month_map = {
        "Januari": 1, "Februari": 2, "Mac": 3, "April": 4,
        "Mei": 5, "Jun": 6, "Julai": 7, "Ogos": 8,
        "September": 9, "Oktober": 10, "November": 11, "Disember": 12
    }
    
    try:
        parts = date_str.strip().split()
        if len(parts) != 3:
            return None
        day = int(parts[0])
        month = month_map.get(parts[1])
        year = int(parts[2])
        
        if month is None:
            return None
        
        return datetime(year, month, day)
    except (ValueError, IndexError):
        return None


def scrape_takwim() -> List[Dict]:
    """
    Scrape Takwim data from Parliament website.
    
    Returns:
        List of session dictionaries with start_date, end_date, days, session_number
    """
    print(f"Fetching Takwim from: {TAKWIM_URL}")
    
    try:
        response = requests.get(TAKWIM_URL, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"Error fetching Takwim: {exc}")
        return []
    
    soup = BeautifulSoup(response.content, "html.parser")
    sessions = []
    
    # Find all session tables
    tables = soup.find_all("table", class_="table")
    
    for table in tables:
        rows = table.find_all("tr")
        current_session = None
        
        for row in rows:
            cells = row.find_all("td")
            
            # Session header row (e.g., "Mesyuarat Pertama")
            if len(cells) == 1 and "Mesyuarat" in cells[0].get_text():
                session_text = cells[0].get_text().strip()
                # Extract session number (Pertama=1, Kedua=2, Ketiga=3, etc.)
                session_map = {
                    "Pertama": 1, "Kedua": 2, "Ketiga": 3, "Keempat": 4,
                    "Kelima": 5, "Keenam": 6, "Ketujuh": 7, "Kelapan": 8
                }
                for malay_num, num in session_map.items():
                    if malay_num in session_text:
                        current_session = num
                        break
            
            # Data row (date range and days)
            elif len(cells) >= 3 and current_session is not None:
                # cells[1] contains date range (e.g., "19 Januari 2026 - 03 Mac 2026")
                # cells[2] contains days (e.g., "20 Hari")
                date_text = cells[1].get_text().strip()
                days_text = cells[2].get_text().strip()
                
                # Parse date range
                date_match = re.search(r"(\d+\s+\w+\s+\d{4})\s*-\s*(\d+\s+\w+\s+\d{4})", date_text)
                if date_match:
                    start_str = date_match.group(1)
                    end_str = date_match.group(2)
                    
                    start_date = parse_date_malay(start_str)
                    end_date = parse_date_malay(end_str)
                    
                    # Parse days
                    days_match = re.search(r"(\d+)\s*Hari", days_text)
                    days = int(days_match.group(1)) if days_match else None
                    
                    if start_date and end_date:
                        sessions.append({
                            "session_number": current_session,
                            "session_name": f"Mesyuarat {current_session}",
                            "start_date": start_date,
                            "end_date": end_date,
                            "days": days,
                            "scraped_at": datetime.now()
                        })
                        print(f"  Found: Mesyuarat {current_session} "
                              f"({start_date.date()} to {end_date.date()}, {days} days)")
    
    return sessions


def save_takwim_to_db(sessions: List[Dict]):
    """
    Save scraped Takwim data to MongoDB.
    
    Stores in parliament_takwim collection with year as key.
    """
    if not sessions:
        print("No sessions to save")
        return
    
    db = get_db()
    takwim_col = db[TAKWIM_COLLECTION]
    
    # Group by year
    year = sessions[0]["start_date"].year
    
    # Upsert Takwim document
    takwim_doc = {
        "year": year,
        "sessions": sessions,
        "last_validated": datetime.now(),
        "source_url": TAKWIM_URL
    }
    
    takwim_col.update_one(
        {"year": year},
        {"$set": takwim_doc},
        upsert=True
    )
    
    print(f"\nSaved {len(sessions)} sessions to database (year {year})")


def get_current_takwim() -> Optional[Dict]:
    """
    Get Takwim data for current year from database.
    
    Returns:
        Takwim document or None if not found
    """
    db = get_db()
    takwim_col = db[TAKWIM_COLLECTION]
    
    current_year = datetime.now().year
    takwim = takwim_col.find_one({"year": current_year})
    
    return takwim


def check_session_status(date: Optional[datetime] = None) -> Dict:
    """
    Check Parliament session status for a given date.
    
    Args:
        date: Date to check (defaults to today)
    
    Returns:
        {
            "is_active": bool,
            "current_session": int or None,
            "session_name": str or None,
            "start_date": datetime or None,
            "end_date": datetime or None,
            "days_into_session": int or None,
            "days_until_end": int or None,
            "status": "before_session" | "during_session" | "after_session" | "between_sessions"
        }
    """
    if date is None:
        date = datetime.now()
    
    takwim = get_current_takwim()
    
    if not takwim or not takwim.get("sessions"):
        return {
            "is_active": False,
            "current_session": None,
            "session_name": None,
            "start_date": None,
            "end_date": None,
            "days_into_session": None,
            "days_until_end": None,
            "status": "no_takwim_data"
        }
    
    sessions = takwim["sessions"]
    
    # Check if date falls within any session
    for session in sessions:
        start = session["start_date"]
        end = session["end_date"]
        
        if start <= date <= end:
            # Currently in session
            days_into = (date - start).days + 1
            days_until_end = (end - date).days
            
            return {
                "is_active": True,
                "current_session": session["session_number"],
                "session_name": session["session_name"],
                "start_date": start,
                "end_date": end,
                "days_into_session": days_into,
                "days_until_end": days_until_end,
                "status": "during_session"
            }
    
    # Not in session - check if before first, after last, or between sessions
    first_session = min(sessions, key=lambda s: s["start_date"])
    last_session = max(sessions, key=lambda s: s["end_date"])
    
    if date < first_session["start_date"]:
        return {
            "is_active": False,
            "current_session": None,
            "session_name": None,
            "start_date": None,
            "end_date": None,
            "days_into_session": None,
            "days_until_end": None,
            "status": "before_session",
            "next_session_starts": first_session["start_date"]
        }
    elif date > last_session["end_date"]:
        return {
            "is_active": False,
            "current_session": None,
            "session_name": None,
            "start_date": None,
            "end_date": None,
            "days_into_session": None,
            "days_until_end": None,
            "status": "after_session",
            "last_session_ended": last_session["end_date"]
        }
    else:
        return {
            "is_active": False,
            "current_session": None,
            "session_name": None,
            "start_date": None,
            "end_date": None,
            "days_into_session": None,
            "days_until_end": None,
            "status": "between_sessions"
        }


def get_processing_strategy() -> Dict:
    """
    Determine optimal processing strategy based on Takwim.
    
    Returns:
        {
            "strategy": "incremental" | "full_reprocess" | "skip",
            "reason": str,
            "session_status": dict,
            "recommended_command": str
        }
    """
    status = check_session_status()
    
    if status["status"] == "no_takwim_data":
        return {
            "strategy": "incremental",
            "reason": "No Takwim data - defaulting to incremental (safe mode)",
            "session_status": status,
            "recommended_command": "python preprocess_pipeline.py --incremental"
        }
    
    if status["is_active"]:
        # During active session: incremental processing
        return {
            "strategy": "incremental",
            "reason": f"Active session ({status['session_name']}) - daily incremental processing",
            "session_status": status,
            "recommended_command": "python preprocess_pipeline.py --incremental --incremental-days 2"
        }
    
    elif status["status"] == "after_session":
        # Just after session ends: check if we already did full reprocess
        db = get_db()
        processing_log = db["processing_log"]
        
        last_session_end = status.get("last_session_ended")
        if last_session_end:
            # Check if we already did full reprocess after this session
            recent_full = processing_log.find_one({
                "strategy": "full_reprocess",
                "timestamp": {"$gte": last_session_end}
            })
            
            if recent_full:
                return {
                    "strategy": "skip",
                    "reason": "Already completed full reprocess after last session",
                    "session_status": status,
                    "recommended_command": "# No action needed"
                }
        
        return {
            "strategy": "full_reprocess",
            "reason": "Session ended - full reprocessing for data integrity",
            "session_status": status,
            "recommended_command": "python preprocess_pipeline.py --full-reprocess"
        }
    
    else:
        # Between sessions or before first session: skip
        return {
            "strategy": "skip",
            "reason": f"No active session ({status['status']}) - no processing needed",
            "session_status": status,
            "recommended_command": "# No action needed"
        }


def run_daily_scraper(dry_run: bool = False) -> int:
    """
    Execute daily_scraper.py (step 0) and return the number of new docs added.

    Uses subprocess so the scraper runs in its own process, matching the
    pattern used by the rest of the pipeline steps.  A non-zero exit code
    is treated as a warning only – the pipeline still continues.
    """
    import subprocess

    cmd = [
        sys.executable,
        str(Path(__file__).parent / "daily_scraper.py"),
        "--lookback-days", str(DAILY_SCRAPE_LOOKBACK_DAYS),
    ]
    if dry_run:
        cmd.append("--dry-run")

    print("\n[0/5] Running daily Hansard scraper...")
    try:
        result = subprocess.run(cmd, check=False, capture_output=False)
        if result.returncode != 0:
            print(
                f"[takwim_scheduler] daily_scraper exited with code "
                f"{result.returncode} – continuing pipeline"
            )
    except Exception as exc:
        print(f"[takwim_scheduler] daily_scraper failed to launch: {exc}")

    # Return value is informational; actual new-doc count is printed by the
    # scraper itself.  We return 1 to signal "scraper was invoked".
    return 1


def log_processing_run(strategy: str, success: bool, details: str = ""):
    """Log a processing run to database."""
    db = get_db()
    processing_log = db["processing_log"]
    
    log_entry = {
        "strategy": strategy,
        "success": success,
        "details": details,
        "timestamp": datetime.now()
    }
    
    processing_log.insert_one(log_entry)


def auto_process():
    """
    Automatically run processing based on Takwim intelligence.
    
    This is the main function to be called by cron daily.
    """
    print("=" * 60)
    print("TAKWIM INTELLIGENT SCHEDULER")
    print("=" * 60)
    
    strategy_info = get_processing_strategy()
    
    print(f"\nSession Status: {strategy_info['session_status']['status']}")
    if strategy_info['session_status']['is_active']:
        status = strategy_info['session_status']
        print(f"  Active Session: {status['session_name']}")
        print(f"  Day {status['days_into_session']} of session")
        print(f"  {status['days_until_end']} days until session ends")
    
    print(f"\nStrategy: {strategy_info['strategy'].upper()}")
    print(f"Reason: {strategy_info['reason']}")
    print(f"Command: {strategy_info['recommended_command']}")
    
    if strategy_info['strategy'] == 'skip':
        print("\nNo processing needed")
        return
    
    # Execute recommended processing
    print("\n" + "=" * 60)
    print("EXECUTING PROCESSING...")
    print("=" * 60)
    
    import subprocess
    
    try:
        # Step 0 always runs first: pull any new Hansard PDFs into the DB
        run_daily_scraper()

        if strategy_info['strategy'] == 'incremental':
            # Run incremental preprocessing
            print("\n[1/5] Running incremental preprocessing...")
            preprocess_cmd = [
                sys.executable,
                str(Path(__file__).parent / "preprocess_pipeline.py"),
                "--incremental",
                "--incremental-days", "2"
            ]
            subprocess.run(preprocess_cmd, check=True)
            
            # Run incremental inference
            print("\n[2/5] Running incremental inference...")
            inference_cmd = [
                sys.executable,
                str(Path(__file__).parent / "production_inference.py"),
                "--incremental",
                "--incremental-days", "2"
            ]
            subprocess.run(inference_cmd, check=True)
            
            # Run topic generation
            print("\n[3/5] Generating topic labels...")
            topic_cmd = [
                sys.executable,
                str(Path(__file__).parent / "topic_generation.py"),
                "--pipeline", "all"
            ]
            subprocess.run(topic_cmd, check=True)
            
            # Run ARIMA forecast
            print("\n[4/5] Running ARIMA time series forecast...")
            arima_cmd = [
                sys.executable,
                str(Path(__file__).parent / "arima_forecast.py"),
                "--pipeline", "all"
            ]
            subprocess.run(arima_cmd, check=True)
            
            # Run topic analysis
            print("\n[5/5] Running advanced topic analysis...")
            analysis_cmd = [
                sys.executable,
                str(Path(__file__).parent / "topic_analysis.py"),
                "--pipeline", "all",
                "--analysis", "all"
            ]
            subprocess.run(analysis_cmd, check=True)
            
            log_processing_run("incremental", True, "Daily incremental processing completed (full pipeline)")
            print("\nIncremental processing completed successfully (all 5 steps)")
        
        elif strategy_info['strategy'] == 'full_reprocess':
            # Run full reprocessing
            print("\n[1/5] Running full reprocessing...")
            preprocess_cmd = [
                sys.executable,
                str(Path(__file__).parent / "preprocess_pipeline.py"),
                "--full-reprocess"
            ]
            subprocess.run(preprocess_cmd, check=True)
            
            # Run full reinference
            print("\n[2/5] Running full reinference...")
            inference_cmd = [
                sys.executable,
                str(Path(__file__).parent / "production_inference.py"),
                "--full-reinfer"
            ]
            subprocess.run(inference_cmd, check=True)
            
            # Run topic generation
            print("\n[3/5] Generating topic labels...")
            topic_cmd = [
                sys.executable,
                str(Path(__file__).parent / "topic_generation.py"),
                "--pipeline", "all"
            ]
            subprocess.run(topic_cmd, check=True)
            
            # Run ARIMA forecast
            print("\n[4/5] Running ARIMA time series forecast...")
            arima_cmd = [
                sys.executable,
                str(Path(__file__).parent / "arima_forecast.py"),
                "--pipeline", "all"
            ]
            subprocess.run(arima_cmd, check=True)
            
            # Run topic analysis
            print("\n[5/5] Running advanced topic analysis...")
            analysis_cmd = [
                sys.executable,
                str(Path(__file__).parent / "topic_analysis.py"),
                "--pipeline", "all",
                "--analysis", "all"
            ]
            subprocess.run(analysis_cmd, check=True)
            
            log_processing_run("full_reprocess", True, "Post-session full reprocessing completed (full pipeline)")
            print("\nFull reprocessing completed successfully (all 5 steps)")
    
    except subprocess.CalledProcessError as exc:
        log_processing_run(strategy_info['strategy'], False, f"Error: {exc}")
        print(f"\n[ERROR] Processing failed: {exc}")
        raise


def validate_takwim():
    """
    Validate and update Takwim data.
    
    Should be run monthly to ensure Takwim is up to date.
    """
    print("=" * 60)
    print("TAKWIM VALIDATION")
    print("=" * 60)
    
    # Check existing data
    existing = get_current_takwim()
    if existing:
        last_validated = existing.get("last_validated", datetime.min)
        days_since_validation = (datetime.now() - last_validated).days
        print(f"\nLast validated: {last_validated.date()} ({days_since_validation} days ago)")
    else:
        print("\nNo existing Takwim data found")
    
    # Scrape new data
    print("\nScraping latest Takwim...")
    sessions = scrape_takwim()
    
    if not sessions:
        print("\n[ERROR] Failed to scrape Takwim data")
        return
    
    # Save to database
    save_takwim_to_db(sessions)
    print("\nTakwim validation completed")
    
    # Show current status
    print("\n" + "=" * 60)
    print("CURRENT SESSION STATUS")
    print("=" * 60)
    status = check_session_status()
    print(f"\nStatus: {status['status']}")
    if status['is_active']:
        print(f"Active Session: {status['session_name']}")
        print(f"Period: {status['start_date'].date()} to {status['end_date'].date()}")
        print(f"Day {status['days_into_session']} of session ({status['days_until_end']} days remaining)")


def main():
    parser = argparse.ArgumentParser(
        description="Takwim-based Intelligent Scheduler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Monthly Takwim validation (run via cron monthly)
  python takwim_scheduler.py --validate-takwim

  # Check current session status
  python takwim_scheduler.py --check-session

  # Run daily scraper only (no ML pipeline)
  python takwim_scheduler.py --scrape-new

  # Auto-process based on Takwim (run via OS cron at 08:00 daily)
  python takwim_scheduler.py --auto-process

  # Dry-run to see what would be executed
  python takwim_scheduler.py --auto-process --dry-run

  # Linux cron entry (crontab -e):
  #   0 8 * * * /venv/bin/python /path/takwim_scheduler.py --auto-process >> /var/log/takwim.log 2>&1
        """
    )
    
    parser.add_argument(
        "--validate-takwim",
        action="store_true",
        help="Validate and update Takwim data from Parliament website"
    )
    parser.add_argument(
        "--check-session",
        action="store_true",
        help="Check current session status"
    )
    parser.add_argument(
        "--scrape-new",
        action="store_true",
        help="Run daily_scraper.py only (step 0, no ML pipeline)"
    )
    parser.add_argument(
        "--auto-process",
        action="store_true",
        help="Automatically run processing based on Takwim intelligence"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be executed without actually running it"
    )

    args = parser.parse_args()

    if args.validate_takwim:
        validate_takwim()
    elif args.scrape_new:
        run_daily_scraper(dry_run=args.dry_run)
    elif args.check_session:
        status = check_session_status()
        strategy = get_processing_strategy()
        
        print("=" * 60)
        print("SESSION STATUS")
        print("=" * 60)
        print(f"\nStatus: {status['status']}")
        if status['is_active']:
            print(f"Active Session: {status['session_name']}")
            print(f"Period: {status['start_date'].date()} to {status['end_date'].date()}")
            print(f"Day {status['days_into_session']} ({status['days_until_end']} days remaining)")
        
        print("\n" + "=" * 60)
        print("RECOMMENDED PROCESSING")
        print("=" * 60)
        print(f"\nStrategy: {strategy['strategy']}")
        print(f"Reason: {strategy['reason']}")
        print(f"Command: {strategy['recommended_command']}")
    elif args.auto_process:
        if args.dry_run:
            strategy = get_processing_strategy()
            print("=" * 60)
            print("DRY RUN - Would execute:")
            print("=" * 60)
            print(f"\nStrategy: {strategy['strategy']}")
            print(f"Reason: {strategy['reason']}")
            print(f"Command: {strategy['recommended_command']}")
        else:
            auto_process()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
