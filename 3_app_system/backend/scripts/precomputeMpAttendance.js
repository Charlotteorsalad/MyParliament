/**
 * Precompute MP attendance from HansardDocument using session_range date filtering.
 *
 * Strategy:
 *   1. Determine which parliament terms each MP served (current term + parliamentary_history).
 *   2. Use SESSION_RANGES to get the exact date range for each term/penggal.
 *   3. Query HansardDocuments whose hansardDate falls within that term's range.
 *   4. Parse content_text (fallback: full_text) to check if MP is in "Yang Hadir" or "Tidak Hadir".
 *   5. After completing each term, write results to DB immediately.
 *   6. Skip MPs that already have attendanceComputedAt set (unless --force).
 *
 * Usage:
 *   node scripts/precomputeMpAttendance.js                    # all MPs, skip already computed
 *   node scripts/precomputeMpAttendance.js --force            # recompute every MP
 *   node scripts/precomputeMpAttendance.js --limit 5          # first 5 MPs (for testing)
 *   node scripts/precomputeMpAttendance.js --concurrency 3    # parallel concurrency (default 2)
 *   node scripts/precomputeMpAttendance.js --mp "Steven Sim"  # single MP by name (for testing)
 *
 * Requires: MONGO_URI in backend/.env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
// Use raw collection for updates to avoid ObjectId casting issues with string _ids
let mpCol;

// ---------------------------------------------------------------------------
// Session range data (from Session_range.xlsx)
// Format: { parlimen, penggal, mesyuarat, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
// ---------------------------------------------------------------------------
const SESSION_ROWS = [
  { parlimen: 1, penggal: 1, mesyuarat: 1, start: '1959-09-11', end: '1959-12-14' },
  { parlimen: 1, penggal: 1, mesyuarat: 2, start: '1960-02-22', end: '1960-02-24' },
  { parlimen: 1, penggal: 2, mesyuarat: 1, start: '1960-04-20', end: '1960-12-22' },
  { parlimen: 1, penggal: 3, mesyuarat: 1, start: '1961-02-06', end: '1961-12-21' },
  { parlimen: 1, penggal: 3, mesyuarat: 2, start: '1962-01-08', end: '1962-01-31' },
  { parlimen: 1, penggal: 4, mesyuarat: 1, start: '1962-04-26', end: '1962-12-22' },
  { parlimen: 1, penggal: 4, mesyuarat: 2, start: '1963-03-11', end: '1963-03-13' },
  { parlimen: 1, penggal: 5, mesyuarat: 1, start: '1963-05-23', end: '1963-12-31' },
  { parlimen: 1, penggal: 5, mesyuarat: 2, start: '1964-01-02', end: '1964-01-11' },
  { parlimen: 2, penggal: 1, mesyuarat: 1, start: '1964-05-18', end: '1964-12-29' },
  { parlimen: 2, penggal: 1, mesyuarat: 2, start: '1965-03-03', end: '1965-03-05' },
  { parlimen: 2, penggal: 2, mesyuarat: 1, start: '1965-05-26', end: '1965-12-22' },
  { parlimen: 2, penggal: 2, mesyuarat: 2, start: '1966-03-21', end: '1966-03-25' },
  { parlimen: 2, penggal: 3, mesyuarat: 1, start: '1966-06-15', end: '1966-10-26' },
  { parlimen: 2, penggal: 3, mesyuarat: 2, start: '1967-01-19', end: '1967-11-16' },
  { parlimen: 2, penggal: 4, mesyuarat: 1, start: '1968-01-18', end: '1968-03-01' },
  { parlimen: 2, penggal: 5, mesyuarat: 1, start: '1968-06-06', end: '1968-10-17' },
  { parlimen: 2, penggal: 5, mesyuarat: 2, start: '1969-01-09', end: '1969-02-13' },
  { parlimen: 3, penggal: 1, mesyuarat: 1, start: '1971-02-20', end: '1972-02-11' },
  { parlimen: 3, penggal: 2, mesyuarat: 1, start: '1972-05-10', end: '1973-01-31' },
  { parlimen: 3, penggal: 3, mesyuarat: 1, start: '1973-04-18', end: '1974-01-21' },
  { parlimen: 3, penggal: 4, mesyuarat: 1, start: '1974-04-25', end: '1974-07-26' },
  { parlimen: 4, penggal: 1, mesyuarat: 1, start: '1974-11-04', end: '1976-01-27' },
  { parlimen: 4, penggal: 2, mesyuarat: 1, start: '1976-03-31', end: '1977-01-27' },
  { parlimen: 4, penggal: 3, mesyuarat: 1, start: '1977-03-22', end: '1978-01-12' },
  { parlimen: 4, penggal: 4, mesyuarat: 1, start: '1978-03-21', end: '1978-04-07' },
  { parlimen: 5, penggal: 1, mesyuarat: 1, start: '1978-07-31', end: '1978-12-15' },
  { parlimen: 5, penggal: 1, mesyuarat: 2, start: '1979-01-17', end: '1979-12-11' },
  { parlimen: 5, penggal: 2, mesyuarat: 1, start: '1980-03-18', end: '1980-12-12' },
  { parlimen: 5, penggal: 3, mesyuarat: 1, start: '1981-03-17', end: '1981-12-21' },
  { parlimen: 6, penggal: 1, mesyuarat: 1, start: '1982-03-09', end: '1982-12-10' },
  { parlimen: 6, penggal: 1, mesyuarat: 2, start: '1983-03-14', end: '1983-12-02' },
  { parlimen: 6, penggal: 2, mesyuarat: 1, start: '1984-03-13', end: '1984-12-06' },
  { parlimen: 6, penggal: 3, mesyuarat: 1, start: '1985-03-26', end: '1985-12-06' },
  { parlimen: 6, penggal: 4, mesyuarat: 1, start: '1986-03-11', end: '1986-04-08' },
  { parlimen: 7, penggal: 1, mesyuarat: 1, start: '1986-10-06', end: '1986-12-08' },
  { parlimen: 7, penggal: 1, mesyuarat: 2, start: '1987-03-09', end: '1987-07-10' },
  { parlimen: 7, penggal: 1, mesyuarat: 3, start: '1987-10-12', end: '1987-12-07' },
  { parlimen: 7, penggal: 2, mesyuarat: 1, start: '1988-03-08', end: '1988-12-06' },
  { parlimen: 7, penggal: 3, mesyuarat: 1, start: '1989-03-07', end: '1989-12-15' },
  { parlimen: 7, penggal: 4, mesyuarat: 1, start: '1990-02-27', end: '1990-06-26' },
  { parlimen: 8, penggal: 1, mesyuarat: 1, start: '1990-12-03', end: '1990-12-21' },
  { parlimen: 8, penggal: 1, mesyuarat: 2, start: '1991-01-02', end: '1991-12-24' },
  { parlimen: 8, penggal: 2, mesyuarat: 1, start: '1992-04-28', end: '1992-12-24' },
  { parlimen: 8, penggal: 2, mesyuarat: 2, start: '1993-01-18', end: '1993-08-04' },
  { parlimen: 8, penggal: 3, mesyuarat: 1, start: '1993-10-18', end: '1993-12-23' },
  { parlimen: 8, penggal: 4, mesyuarat: 1, start: '1994-04-12', end: '1994-12-22' },
  { parlimen: 9, penggal: 1, mesyuarat: 1, start: '1995-06-07', end: '1995-06-29' },
  { parlimen: 9, penggal: 1, mesyuarat: 2, start: '1995-08-14', end: '1995-09-05' },
  { parlimen: 9, penggal: 1, mesyuarat: 3, start: '1995-10-16', end: '1995-12-21' },
  { parlimen: 9, penggal: 1, mesyuarat: 4, start: '1996-01-08', end: '1996-01-11' },
  { parlimen: 9, penggal: 2, mesyuarat: 1, start: '1996-03-26', end: '1996-05-22' },
  { parlimen: 9, penggal: 2, mesyuarat: 2, start: '1996-07-08', end: '1996-07-31' },
  { parlimen: 9, penggal: 2, mesyuarat: 3, start: '1996-10-14', end: '1996-12-19' },
  { parlimen: 9, penggal: 3, mesyuarat: 1, start: '1997-03-25', end: '1997-07-16' },
  { parlimen: 9, penggal: 3, mesyuarat: 2, start: '1997-07-21', end: '1997-08-05' },
  { parlimen: 9, penggal: 3, mesyuarat: 3, start: '1997-10-06', end: '1997-12-18' },
  { parlimen: 9, penggal: 4, mesyuarat: 1, start: '1998-03-24', end: '1998-05-13' },
  { parlimen: 9, penggal: 4, mesyuarat: 2, start: '1998-07-13', end: '1998-09-30' },
  { parlimen: 9, penggal: 4, mesyuarat: 3, start: '1998-10-20', end: '1998-12-10' },
  { parlimen: 9, penggal: 5, mesyuarat: 1, start: '1999-04-06', end: '1999-05-11' },
  { parlimen: 9, penggal: 5, mesyuarat: 2, start: '1999-07-12', end: '1999-07-27' },
  { parlimen: 9, penggal: 5, mesyuarat: 3, start: '1999-10-18', end: '1999-11-10' },
  { parlimen: 10, penggal: 1, mesyuarat: 1, start: '1999-12-20', end: '1999-12-23' },
  { parlimen: 10, penggal: 2, mesyuarat: 1, start: '2000-02-15', end: '2000-04-25' },
  { parlimen: 10, penggal: 2, mesyuarat: 2, start: '2000-07-10', end: '2000-07-20' },
  { parlimen: 10, penggal: 2, mesyuarat: 3, start: '2000-10-16', end: '2000-12-14' },
  { parlimen: 10, penggal: 3, mesyuarat: 1, start: '2001-03-20', end: '2001-05-10' },
  { parlimen: 10, penggal: 3, mesyuarat: 2, start: '2001-07-16', end: '2001-08-09' },
  { parlimen: 10, penggal: 3, mesyuarat: 3, start: '2001-10-09', end: '2001-12-11' },
  { parlimen: 10, penggal: 4, mesyuarat: 1, start: '2002-03-12', end: '2002-04-09' },
  { parlimen: 10, penggal: 4, mesyuarat: 2, start: '2002-06-17', end: '2002-06-27' },
  { parlimen: 10, penggal: 4, mesyuarat: 3, start: '2002-09-09', end: '2002-11-12' },
  { parlimen: 10, penggal: 5, mesyuarat: 1, start: '2003-03-11', end: '2003-04-10' },
  { parlimen: 10, penggal: 5, mesyuarat: 2, start: '2003-06-16', end: '2003-06-26' },
  { parlimen: 10, penggal: 5, mesyuarat: 3, start: '2003-09-02', end: '2003-11-11' },
  { parlimen: 11, penggal: 1, mesyuarat: 1, start: '2004-05-17', end: '2004-06-14' },
  { parlimen: 11, penggal: 1, mesyuarat: 2, start: '2004-07-05', end: '2004-07-20' },
  { parlimen: 11, penggal: 1, mesyuarat: 3, start: '2004-09-01', end: '2004-12-14' },
  { parlimen: 11, penggal: 2, mesyuarat: 1, start: '2005-01-17', end: '2005-04-28' },
  { parlimen: 11, penggal: 2, mesyuarat: 2, start: '2005-06-20', end: '2005-07-12' },
  { parlimen: 11, penggal: 2, mesyuarat: 3, start: '2005-09-19', end: '2005-12-08' },
  { parlimen: 11, penggal: 3, mesyuarat: 1, start: '2006-03-14', end: '2006-05-11' },
  { parlimen: 11, penggal: 3, mesyuarat: 2, start: '2006-06-26', end: '2006-07-18' },
  { parlimen: 11, penggal: 3, mesyuarat: 3, start: '2006-08-21', end: '2006-12-13' },
  { parlimen: 11, penggal: 4, mesyuarat: 1, start: '2007-03-20', end: '2007-05-10' },
  { parlimen: 11, penggal: 4, mesyuarat: 2, start: '2007-06-18', end: '2007-08-29' },
  { parlimen: 11, penggal: 4, mesyuarat: 3, start: '2007-09-03', end: '2007-12-19' },
  { parlimen: 12, penggal: 1, mesyuarat: 1, start: '2008-04-28', end: '2008-05-29' },
  { parlimen: 12, penggal: 1, mesyuarat: 2, start: '2008-06-23', end: '2008-07-17' },
  { parlimen: 12, penggal: 1, mesyuarat: 3, start: '2008-08-18', end: '2008-12-18' },
  { parlimen: 12, penggal: 1, mesyuarat: 4, start: '2009-01-12', end: '2009-01-12' },
  { parlimen: 12, penggal: 2, mesyuarat: 1, start: '2009-02-16', end: '2009-03-25' },
  { parlimen: 12, penggal: 2, mesyuarat: 2, start: '2009-06-15', end: '2009-07-02' },
  { parlimen: 12, penggal: 2, mesyuarat: 3, start: '2009-10-19', end: '2009-12-17' },
  { parlimen: 12, penggal: 3, mesyuarat: 1, start: '2010-03-15', end: '2010-04-22' },
  { parlimen: 12, penggal: 3, mesyuarat: 2, start: '2010-06-07', end: '2010-07-15' },
  { parlimen: 12, penggal: 3, mesyuarat: 3, start: '2010-10-11', end: '2010-12-16' },
  { parlimen: 12, penggal: 4, mesyuarat: 1, start: '2011-03-07', end: '2011-04-07' },
  { parlimen: 12, penggal: 4, mesyuarat: 2, start: '2011-06-13', end: '2011-06-30' },
  { parlimen: 12, penggal: 4, mesyuarat: 3, start: '2011-10-03', end: '2011-12-01' },
  { parlimen: 12, penggal: 5, mesyuarat: 1, start: '2012-03-12', end: '2012-04-19' },
  { parlimen: 12, penggal: 5, mesyuarat: 2, start: '2012-06-11', end: '2012-06-28' },
  { parlimen: 12, penggal: 5, mesyuarat: 3, start: '2012-09-24', end: '2012-11-29' },
  { parlimen: 13, penggal: 1, mesyuarat: 1, start: '2013-06-24', end: '2013-07-18' },
  { parlimen: 13, penggal: 1, mesyuarat: 2, start: '2013-09-23', end: '2013-10-03' },
  { parlimen: 13, penggal: 1, mesyuarat: 3, start: '2013-10-21', end: '2013-12-05' },
  { parlimen: 13, penggal: 2, mesyuarat: 1, start: '2014-03-10', end: '2014-04-10' },
  { parlimen: 13, penggal: 2, mesyuarat: 2, start: '2014-06-09', end: '2014-06-19' },
  { parlimen: 13, penggal: 2, mesyuarat: 3, start: '2014-10-07', end: '2014-11-27' },
  { parlimen: 13, penggal: 2, mesyuarat: 4, start: '2014-07-23', end: '2014-07-23' }, // Khas
  { parlimen: 13, penggal: 3, mesyuarat: 1, start: '2015-03-09', end: '2015-04-09' },
  { parlimen: 13, penggal: 3, mesyuarat: 2, start: '2015-05-18', end: '2015-06-18' },
  { parlimen: 13, penggal: 3, mesyuarat: 3, start: '2015-10-19', end: '2015-12-03' },
  { parlimen: 13, penggal: 3, mesyuarat: 4, start: '2016-01-26', end: '2016-01-27' }, // Khas
  { parlimen: 13, penggal: 4, mesyuarat: 1, start: '2016-03-07', end: '2016-04-07' },
  { parlimen: 13, penggal: 4, mesyuarat: 2, start: '2016-05-16', end: '2016-05-26' },
  { parlimen: 13, penggal: 4, mesyuarat: 3, start: '2016-10-17', end: '2016-11-24' },
  { parlimen: 13, penggal: 5, mesyuarat: 1, start: '2017-03-06', end: '2017-04-06' },
  { parlimen: 13, penggal: 5, mesyuarat: 2, start: '2017-07-24', end: '2017-08-10' },
  { parlimen: 13, penggal: 5, mesyuarat: 3, start: '2017-10-23', end: '2017-11-30' },
  { parlimen: 13, penggal: 6, mesyuarat: 1, start: '2018-03-05', end: '2018-04-05' },
  { parlimen: 14, penggal: 1, mesyuarat: 1, start: '2018-07-16', end: '2018-08-16' },
  { parlimen: 14, penggal: 1, mesyuarat: 2, start: '2018-10-15', end: '2018-12-11' },
  { parlimen: 14, penggal: 2, mesyuarat: 1, start: '2019-03-11', end: '2019-04-11' },
  { parlimen: 14, penggal: 2, mesyuarat: 2, start: '2019-07-01', end: '2019-07-18' },
  { parlimen: 14, penggal: 2, mesyuarat: 3, start: '2019-10-07', end: '2019-12-05' },
  { parlimen: 14, penggal: 3, mesyuarat: 1, start: '2020-05-18', end: '2020-05-18' },
  { parlimen: 14, penggal: 3, mesyuarat: 2, start: '2020-07-13', end: '2020-08-27' },
  { parlimen: 14, penggal: 3, mesyuarat: 3, start: '2020-11-02', end: '2020-12-17' },
  { parlimen: 14, penggal: 3, mesyuarat: 4, start: '2021-07-26', end: '2021-07-29' }, // Khas
  { parlimen: 14, penggal: 4, mesyuarat: 1, start: '2021-09-13', end: '2021-10-12' },
  { parlimen: 14, penggal: 4, mesyuarat: 2, start: '2021-10-25', end: '2021-12-20' },
  { parlimen: 14, penggal: 4, mesyuarat: 3, start: '2020-01-20', end: '2020-01-20' }, // Khas (early special session)
  { parlimen: 14, penggal: 5, mesyuarat: 1, start: '2022-02-28', end: '2022-03-24' },
  { parlimen: 14, penggal: 5, mesyuarat: 2, start: '2022-07-18', end: '2022-08-04' },
  { parlimen: 14, penggal: 5, mesyuarat: 3, start: '2022-10-03', end: '2022-10-07' },
  { parlimen: 14, penggal: 5, mesyuarat: 4, start: '2022-04-11', end: '2022-04-11' }, // Khas
  { parlimen: 15, penggal: 1, mesyuarat: 1, start: '2022-12-19', end: '2022-12-20' },
  { parlimen: 15, penggal: 2, mesyuarat: 1, start: '2023-02-13', end: '2023-04-04' },
  { parlimen: 15, penggal: 2, mesyuarat: 2, start: '2023-05-22', end: '2023-06-15' },
  { parlimen: 15, penggal: 2, mesyuarat: 3, start: '2023-10-09', end: '2023-11-30' },
  { parlimen: 15, penggal: 2, mesyuarat: 4, start: '2023-09-11', end: '2023-09-19' }, // Khas
  { parlimen: 15, penggal: 3, mesyuarat: 1, start: '2024-02-26', end: '2024-03-27' },
  { parlimen: 15, penggal: 3, mesyuarat: 2, start: '2024-06-24', end: '2024-07-18' },
  { parlimen: 15, penggal: 3, mesyuarat: 3, start: '2024-10-14', end: '2024-12-12' },
  { parlimen: 15, penggal: 4, mesyuarat: 1, start: '2025-02-03', end: '2025-03-06' },
  { parlimen: 15, penggal: 4, mesyuarat: 2, start: '2025-07-21', end: '2025-08-28' },
  { parlimen: 15, penggal: 4, mesyuarat: 3, start: '2025-10-06', end: '2025-12-04' },
  { parlimen: 15, penggal: 4, mesyuarat: 4, start: '2025-05-05', end: '2025-05-05' }, // Khas
  { parlimen: 15, penggal: 5, mesyuarat: 1, start: '2026-01-19', end: '2026-03-03' },
  { parlimen: 15, penggal: 5, mesyuarat: 2, start: '2026-06-22', end: '2026-07-16' },
  { parlimen: 15, penggal: 5, mesyuarat: 3, start: '2026-10-05', end: '2026-12-08' },
];

// ---------------------------------------------------------------------------
// Build lookup structures from SESSION_ROWS
// ---------------------------------------------------------------------------

/** termLookup[termNum] = { start: Date, end: Date, penggals: { [penggalNum]: { start, end } } } */
function buildTermLookup() {
  const lookup = {};
  for (const row of SESSION_ROWS) {
    const t = row.parlimen;
    const rowStart = new Date(row.start);
    const rowEnd = new Date(row.end);
    if (!lookup[t]) lookup[t] = { term: t, start: rowStart, end: rowEnd, penggals: {} };
    if (rowStart < lookup[t].start) lookup[t].start = rowStart;
    if (rowEnd > lookup[t].end) lookup[t].end = rowEnd;
    const p = row.penggal;
    if (!lookup[t].penggals[p]) {
      lookup[t].penggals[p] = { start: rowStart, end: rowEnd };
    } else {
      if (rowStart < lookup[t].penggals[p].start) lookup[t].penggals[p].start = rowStart;
      if (rowEnd > lookup[t].penggals[p].end) lookup[t].penggals[p].end = rowEnd;
    }
  }
  return lookup;
}

/** Given a Date, return the penggal number within the given term (or null). */
function getPenggalForDate(date, termEntry) {
  for (const [penggalNum, range] of Object.entries(termEntry.penggals)) {
    if (date >= range.start && date <= range.end) return parseInt(penggalNum, 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// MP name helpers
// ---------------------------------------------------------------------------

function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/\b(Yang\s+Berhormat|YB|Tuan|Puan|Dato'?s?|Datuk\s+Seri|Datuk|Datin|Dr\.?|Tan\s+Sri|Sri|Seri|Haji|Hajjah|Hj\.?|Hjh\.?|bin|binti|bt\.?|bte\.?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNameVariants(mp) {
  const name = mp.name && String(mp.name).trim();
  const fullName = mp.full_name_with_titles && String(mp.full_name_with_titles).trim();

  const base = [
    normalizeName(name),
    normalizeName(fullName),
    name,
    fullName,
  ];

  // Extra shorter variants for names that might appear truncated in Hansard:
  // 1. First-2-word prefix  (e.g. "Hannah Yeoh" from "Hannah Yeoh Tseow Suan")
  // 2. First-word standalone if it is very specific (≥ 9 chars), e.g. "Mahiaddin"
  // Note: last-2-word suffix is intentionally excluded — it can produce very short
  // variants (e.g. "Eric, Y.B." → "eric") that cause false positives.
  for (const raw of [normalizeName(name), normalizeName(fullName)]) {
    if (!raw) continue;
    const words = raw.split(/\s+/).filter(w => w.length > 1);
    if (words.length >= 3) {
      base.push(words.slice(0, 2).join(' '));   // first 2 words
    }
    if (words.length >= 2 && words[0].length >= 9) {
      base.push(words[0]);                       // highly specific first word alone
    }
  }

  // Handle "@"-alias names (e.g. "Enchin bin Majimbun @ Eric").
  // The alias is the part after "@". Combine it with the last word of the
  // base name so "Eric Majimbun" is a variant that matches the Hansard style
  // "Eric E. Majimbun" after normaliseForSearch strips the middle initial.
  for (const src of [name, fullName]) {
    if (!src || !src.includes('@')) continue;
    const [basePart, aliasPart] = src.split('@').map(s => s.trim());
    const baseWords = normalizeName(basePart).split(/\s+/).filter(w => w.length > 1);
    const aliasWords = normalizeName(aliasPart).split(/\s+/).filter(w => w.length > 1);
    const lastName = baseWords[baseWords.length - 1]; // e.g. "Majimbun"
    if (lastName && aliasWords.length > 0) {
      base.push(`${aliasWords[0]} ${lastName}`);  // e.g. "Eric Majimbun"
      base.push(`${lastName} ${aliasWords[0]}`);  // e.g. "Majimbun Eric" (reversed)
    }
  }

  return base.filter((n, i, a) => n && n.length >= 3 && a.indexOf(n) === i);
}

function parseTermNum(termStr) {
  if (!termStr) return null;
  const m = String(termStr).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** Return all parliament term numbers (unique, sorted desc) for an MP. */
function getMpTermNums(mp) {
  const terms = new Set();
  const cur = parseTermNum(mp.parliament_term);
  if (cur) terms.add(cur);
  if (Array.isArray(mp.parliamentary_history)) {
    for (const h of mp.parliamentary_history) {
      const n = h.term_number != null ? h.term_number : parseTermNum(h.parliament_term);
      if (n) terms.add(n);
    }
  }
  return [...terms].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Attendance parsing from Hansard text
//
// Four document formats are supported, tried in order:
//
//   FORMAT A (Term 15):    "Ahli-Ahli Yang Hadir:" / "Ahli-Ahli Yang Tidak Hadir:"
//   FORMAT B (Terms 12-14): Party blocks "AHLI-AHLI (BN)" / "AHLI-AHLI (PKR)" etc.
//   FORMAT C (Terms 3-5):  "YANG HADIR:" / "YANG TIDAK HADIR:" headers
//   FORMAT D (Terms 6-11): "AHLI-AHLI DEWAN RAKYAT" roster (no party blocks)
//
// Formats C and D need text normalisation before matching because older Hansard
// documents include "bin/binti/Dato'/Haji" particles inside the name line,
// breaking a simple substring search.
// ---------------------------------------------------------------------------

/**
 * Normalise a text fragment for searching in Hansard formats.
 * Strips common Malay/English honorifics, particles, punctuation, and
 * single-letter words (middle initials like "G." in "Jeffrey G. Kitingan")
 * so that normalised variants can be matched against normalised document text.
 *
 * Examples:
 *   "DATO' SERI DR MAHATHIR BIN MOHAMAD" → "mahathir mohamad"
 *   "Jeffrey G. Kitingan"                 → "jeffrey kitingan"
 *   "Hannah Yeoh (Segambut)"              → "hannah yeoh segambut"
 */
function normalizeForSearch(text) {
  return text
    .replace(/\b(Yang\s+Amat\s+Berhormat|Yang\s+Berhormat|Tuan\s+Yang\s+di-Pertua|YAB|YB|Tuan|Puan)\b/gi, ' ')
    .replace(/\b(Dato'?\s*Seri|Dato'?\s*Sri|Dato'?s?|Datuk\s+Seri|Datuk|Datin|Tun|Tan\s+Sri)\b/gi, ' ')
    .replace(/\b(Sri|Seri|Dr\.?|Prof\.?|Haji|Hajjah|Hj\.?|Hjh\.?|Brig\.?|Gen\.?|Col\.?|Lt\.?)\b/gi, ' ')
    .replace(/\b(bin|binti|bt\.?|bte\.?|ibni)\b/gi, ' ')
    .replace(/[^a-zA-Z\s]/g, ' ')   // strip punctuation / diacritics
    .replace(/\b[a-zA-Z]\b/g, ' ')  // remove single-letter words (middle initials: G, A, etc.)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Parse a Hansard document text to check if the MP was present or absent.
 * Returns: true (present), false (absent), null (format not detected → skip doc).
 */
function checkAttendanceInText(text, nameVariants) {
  if (!text || typeof text !== 'string') return null;

  // Pre-build normalised variants once (used by all formats).
  // Minimum length of 3 chars — single-letter words are already stripped
  // by normalizeForSearch, so very short fragments are naturally rare.
  // (The last-2-words suffix in buildNameVariants was removed to prevent
  // honorific-contaminated fragments like "Eric, Y.B." collapsing to "eric".)
  const normVariants = nameVariants
    .map(v => normalizeForSearch(v))
    .filter((v, i, a) => v.length >= 3 && a.indexOf(v) === i);

  // ── FORMAT A: "Ahli-Ahli Yang Hadir:" header (Term 15+) ──────────────────
  // Use normalised search so that "bin/binti" in the Hansard doesn't break
  // substring matching, and middle initials like "G." are ignored.
  const hadirHeaderMatch = text.match(/Ahli-Ahli\s+Yang\s+Hadir\s*:/i);
  if (hadirHeaderMatch) {
    const hadirStart = hadirHeaderMatch.index;

    const tidakHeaderMatch = text.slice(hadirStart).match(/Ahli-Ahli\s+Yang\s+Tidak\s+Hadir\s*:/i);

    const hadirSection = tidakHeaderMatch
      ? text.slice(hadirStart, hadirStart + tidakHeaderMatch.index)
      : text.slice(hadirStart, hadirStart + 10000);

    const normHadirA = normalizeForSearch(hadirSection);
    for (const v of normVariants) {
      if (normHadirA.includes(v)) return true;
    }

    if (tidakHeaderMatch) {
      const tidakStart = hadirStart + tidakHeaderMatch.index;
      const nextSection = text.slice(tidakStart + 10).match(/\n[A-Z][A-Z\s]{5,}/);
      const tidakSection = nextSection
        ? text.slice(tidakStart, tidakStart + 10 + nextSection.index)
        : text.slice(tidakStart, tidakStart + 10000);
      const normTidakA = normalizeForSearch(tidakSection);
      for (const v of normVariants) {
        if (normTidakA.includes(v)) return false;
      }
    }

    return null; // MP not in either section
  }

  // ── FORMAT B: "AHLI-AHLI (PARTY)" party blocks (Terms 12–14) ─────────────
  // Minister/deputy list appears BEFORE the first party block; both are searched.
  const searchWindow = text.slice(0, 25000);
  const partyBlockPattern = /AHLI-AHLI\s+\([A-Z][A-Z\s\-]*\)/g;
  const partyBlocks = [...searchWindow.matchAll(partyBlockPattern)];
  if (partyBlocks.length > 0) {
    const firstBlockStart = partyBlocks[0].index;

    const rosterEndMatch = searchWindow.slice(firstBlockStart).match(
      /AHLI-AHLI\s+YANG\s+TIDAK\s+HADIR|PETUGAS-PETUGAS|Ketua\s+Pentadbir\s+Parlimen|Setiausaha\s+Dewan\s+Rakyat/i
    );
    const partyRosterEnd = firstBlockStart + (rosterEndMatch ? rosterEndMatch.index : (searchWindow.length - firstBlockStart));

    const attendanceStart = Math.max(0, firstBlockStart - 8000);
    const fullAttendanceText = searchWindow.slice(attendanceStart, partyRosterEnd);
    const normAttendanceB = normalizeForSearch(fullAttendanceText);

    for (const v of normVariants) {
      if (normAttendanceB.includes(v)) return true;
    }

    if (fullAttendanceText.length > 200) return false;
    return null;
  }

  // ── FORMAT C: "YANG HADIR:" header (Terms 3–5) ───────────────────────────
  // Names appear with full honorifics: "DATO' SERI HUSSEIN BIN DATUK ONN (Sri Gading)"
  // Both "present" and "absent" sections are explicit.
  const hadirHeaderC = text.match(/YANG HADIR\s*:/i);
  if (hadirHeaderC) {
    const hadirStart = hadirHeaderC.index;
    const tidakHeaderC = text.slice(hadirStart).match(/YANG TIDAK HADIR\s*:|TIDAK HADIR\s*:/i);

    const hadirSection = tidakHeaderC
      ? text.slice(hadirStart, hadirStart + tidakHeaderC.index)
      : text.slice(hadirStart, hadirStart + 10000);

    const normHadir = normalizeForSearch(hadirSection);
    for (const v of normVariants) {
      if (normHadir.includes(v)) return true;
    }

    if (tidakHeaderC) {
      const tidakStart = hadirStart + tidakHeaderC.index;
      const tidakSection = text.slice(tidakStart, tidakStart + 10000);
      const normTidak = normalizeForSearch(tidakSection);
      for (const v of normVariants) {
        if (normTidak.includes(v)) return false;
      }
    }

    // Section found but name not in either list → not a member this day
    return null;
  }

  // ── FORMAT D: "AHLI-AHLI DEWAN RAKYAT" roster (Terms 6–11) ───────────────
  // Daily attendance list at document start; no explicit "tidak hadir" header.
  // Each entry: "Yang Berhormat … FULL NAME (Constituency)" or numbered list.
  // Absence is inferred if the section is well-populated but MP not found.
  //
  // Use a wide 30 000-char window because Term 11 with 220+ MPs fills ~20 000 chars.
  const searchWindowD = text.slice(0, 30000);
  const hadirHeaderD = searchWindowD.match(/AHLI-AHLI DEWAN RAKYAT/i);
  if (hadirHeaderD) {
    const sectionStart = hadirHeaderD.index;
    const remainder = searchWindowD.slice(sectionStart);

    // Find where the attendance list ends and the debate content begins
    const endMatch = remainder.slice(100).match(
      /BENTARA MESYUARAT|PERTANYAAN-PERTANYAAN|RANG UNDANG-UNDANG|USUL-USUL|TITAH UCAPAN|Mesyuarat dimulakan|PEMASYHURAN TUAN YANG DI-PERTUA|(?:Isnin|Selasa|Rabu|Khamis|Jumaat),\s*\d/i
    );
    const sectionText = endMatch
      ? remainder.slice(0, 100 + endMatch.index)
      : remainder.slice(0, 20000); // fallback cap

    const normSection = normalizeForSearch(sectionText);

    // MP found anywhere in the section → PRESENT
    for (const v of normVariants) {
      if (normSection.includes(v)) return true;
    }

    // Section must be substantial (≥ 3000 chars) before inferring absence,
    // to avoid false negatives from docs where the attendance page is missing.
    if (sectionText.length >= 3000) return false;

    return null;
  }

  return null; // No recognised format
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Effective "today" cap: today minus 3 days to allow Hansard processing lag. */
function getEffectiveCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Core computation for one MP
// ---------------------------------------------------------------------------

async function computeAttendanceForMp(db, mp, termLookup, verbose) {
  const nameVariants = buildNameVariants(mp);
  if (nameVariants.length === 0) return null;

  const termNums = getMpTermNums(mp);
  if (termNums.length === 0) return null;

  const col = db.collection('HansardDocument');
  const byTermResults = [];

  for (const termNum of termNums) {
    const termEntry = termLookup[termNum];
    if (!termEntry) {
      if (verbose) console.log(`    Term ${termNum}: no session range data, skip`);
      continue;
    }

    // Query HansardDocuments within this term's date range
    const docs = await col.find(
      { hansardDate: { $gte: termEntry.start, $lte: termEntry.end } },
      { projection: { content_text: 1, full_text: 1, hansardDate: 1, url: 1 } }
    ).sort({ hansardDate: 1 }).toArray();

    if (docs.length === 0) {
      if (verbose) console.log(`    Term ${termNum}: 0 Hansard docs in range ${termEntry.start.toISOString().slice(0, 10)} → ${termEntry.end.toISOString().slice(0, 10)}`);
      continue;
    }

    // Tally attendance per penggal
    const penggalMap = {}; // penggalNum → { attended, total }

    for (const doc of docs) {
      const text = doc.full_text || doc.content_text || '';
      const result = checkAttendanceInText(text, nameVariants);
      if (result === null) continue; // MP not mentioned in this doc's attendance list

      // Find which penggal this date belongs to
      const date = new Date(doc.hansardDate);
      const penggalNum = getPenggalForDate(date, termEntry);
      const key = penggalNum != null ? penggalNum : 0; // 0 = unknown penggal

      if (!penggalMap[key]) penggalMap[key] = { attended: 0, total: 0 };
      penggalMap[key].total += 1;
      if (result === true) penggalMap[key].attended += 1;
    }

    // Build byPenggal array (sorted by penggal number)
    const byPenggal = Object.entries(penggalMap)
      .map(([p, counts]) => ({
        penggal: parseInt(p, 10),
        attended: counts.attended,
        total: counts.total,
        rate: counts.total > 0 ? Math.round((counts.attended / counts.total) * 100) : 0,
      }))
      .sort((a, b) => a.penggal - b.penggal);

    const totalAttended = byPenggal.reduce((s, p) => s + p.attended, 0);
    const totalSessions = byPenggal.reduce((s, p) => s + p.total, 0);
    const termRate = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

    const termResult = {
      term: termNum,
      rate: termRate,
      attended: totalAttended,
      total: totalSessions,
      byPenggal,
    };

    byTermResults.push(termResult);

    if (verbose) {
      console.log(`    Term ${termNum}: ${termRate}% (${totalAttended}/${totalSessions} sessions, ${docs.length} docs scanned, ${byPenggal.length} penggals)`);
    }
  }

  if (byTermResults.length === 0) return null;

  const allAttended = byTermResults.reduce((s, t) => s + t.attended, 0);
  const allTotal = byTermResults.reduce((s, t) => s + t.total, 0);
  const overallRate = allTotal > 0 ? Math.round((allAttended / allTotal) * 100) : 0;

  return {
    rate: overallRate,
    byTerm: byTermResults,
  };
}

// ---------------------------------------------------------------------------
// Process one MP and write results to DB per term
// ---------------------------------------------------------------------------

async function processOneMp(db, mp, termLookup, index, total, verbose) {
  const label = `[${index + 1}/${total}] ${mp.name || mp._id}`;
  const nameVariants = buildNameVariants(mp);
  if (nameVariants.length === 0) {
    console.log(`${label} → skip (no name)`);
    return { ok: 0, fail: 0, skipped: 1 };
  }

  const termNums = getMpTermNums(mp);
  if (termNums.length === 0) {
    console.log(`${label} → skip (no terms)`);
    return { ok: 0, fail: 0, skipped: 1 };
  }

  if (verbose) {
    console.log(`${label} | terms: [${termNums.join(', ')}] | variants: [${nameVariants.join(' | ')}]`);
  }

  try {
    const col = db.collection('HansardDocument');
    const byTermResults = [];
    const cutoff = getEffectiveCutoff(); // today - 3 days

    for (const termNum of termNums) {
      const termEntry = termLookup[termNum];
      if (!termEntry) continue;

      // Cap future end dates at cutoff (ongoing sessions not yet fully processed)
      const effectiveEnd = termEntry.end > cutoff ? cutoff : termEntry.end;

      const docs = await col.find(
        { hansardDate: { $gte: termEntry.start, $lte: effectiveEnd } },
        { projection: { content_text: 1, full_text: 1, hansardDate: 1 } }
      ).sort({ hansardDate: 1 }).toArray();

      if (docs.length === 0) continue;

      // penggalMap[key] = { attended, total, latestDate }
      const penggalMap = {};

      for (const doc of docs) {
        const text = doc.full_text || doc.content_text || '';
        const result = checkAttendanceInText(text, nameVariants);
        if (result === null) continue;

        const date = new Date(doc.hansardDate);
        const penggalNum = getPenggalForDate(date, termEntry);
        const key = penggalNum != null ? penggalNum : 0;

        if (!penggalMap[key]) penggalMap[key] = { attended: 0, total: 0, latestDate: null };
        penggalMap[key].total += 1;
        if (result === true) penggalMap[key].attended += 1;
        // Track latest hansard date seen (for ongoing penggal display)
        if (!penggalMap[key].latestDate || date > penggalMap[key].latestDate) {
          penggalMap[key].latestDate = date;
        }
      }

      const byPenggal = Object.entries(penggalMap)
        .map(([p, counts]) => ({
          penggal: parseInt(p, 10),
          attended: counts.attended,
          total: counts.total,
          rate: counts.total > 0 ? Math.round((counts.attended / counts.total) * 100) : 0,
          latestDate: counts.latestDate ? counts.latestDate.toISOString().slice(0, 10) : null,
        }))
        .sort((a, b) => a.penggal - b.penggal);

      const totalAttended = byPenggal.reduce((s, p) => s + p.attended, 0);
      const totalSessions = byPenggal.reduce((s, p) => s + p.total, 0);
      const termRate = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

      const termResult = {
        term: termNum,
        rate: termRate,
        attended: totalAttended,
        total: totalSessions,
        byPenggal,
      };
      byTermResults.push(termResult);

      // Write this term's data to DB immediately
      const allAttendedSoFar = byTermResults.reduce((s, t) => s + t.attended, 0);
      const allTotalSoFar = byTermResults.reduce((s, t) => s + t.total, 0);
      const ratesSoFar = allTotalSoFar > 0 ? Math.round((allAttendedSoFar / allTotalSoFar) * 100) : 0;

      await mpCol.updateOne(
        { _id: mp._id },
        {
          $set: {
            'performance.attendanceRate': ratesSoFar,
            'performance.attendanceByTerm': byTermResults,
            'performance.attendanceComputedAt': new Date(),
          },
        }
      );

      if (verbose) {
        console.log(`    Term ${termNum}: ${termRate}% (${totalAttended}/${totalSessions}, ${docs.length} docs, ${byPenggal.length} penggals) → saved`);
      }
    }

    if (byTermResults.length === 0) {
      await mpCol.updateOne(
        { _id: mp._id },
        {
          $set: {
            'performance.attendanceRate': null,
            'performance.attendanceByTerm': [],
            'performance.attendanceComputedAt': new Date(),
          },
        }
      );
      console.log(`${label} → no Hansard data found`);
      return { ok: 1, fail: 0, skipped: 0 };
    }

    const allAttended = byTermResults.reduce((s, t) => s + t.attended, 0);
    const allTotal = byTermResults.reduce((s, t) => s + t.total, 0);
    const overallRate = allTotal > 0 ? Math.round((allAttended / allTotal) * 100) : 0;

    console.log(`${label} → ${overallRate}% (${allAttended}/${allTotal}) across ${byTermResults.length} term(s)`);
    return { ok: 1, fail: 0, skipped: 0 };
  } catch (err) {
    console.error(`${label} ERROR:`, err.message);
    return { ok: 0, fail: 1, skipped: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in backend/.env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
    || (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : null);
  const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;

  const concurrencyArg = args.find(a => a.startsWith('--concurrency='))?.split('=')[1]
    || (args.includes('--concurrency') ? args[args.indexOf('--concurrency') + 1] : null);
  const concurrency = Math.min(8, Math.max(1, parseInt(concurrencyArg, 10) || 2));

  const mpNameArg = args.find(a => a.startsWith('--mp='))?.split('=').slice(1).join('=')
    || (args.includes('--mp') ? args[args.indexOf('--mp') + 1] : null);

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  mpCol = db.collection('MP'); // raw collection to avoid ObjectId casting issues

  const termLookup = buildTermLookup();
  console.log(`Session ranges loaded: ${Object.keys(termLookup).length} parliament terms`);

  // Build MP query
  const rawQuery = {};
  if (mpNameArg) {
    rawQuery.name = { $regex: mpNameArg, $options: 'i' };
  }

  let mps = await mpCol.find(rawQuery, {
    projection: {
      _id: 1, name: 1, full_name_with_titles: 1,
      parliament_term: 1, parliamentary_history: 1,
      'performance.attendanceComputedAt': 1,
    }
  }).toArray();

  if (limit) mps = mps.slice(0, limit);

  if (!force) {
    const before = mps.length;
    mps = mps.filter(mp => !mp.performance?.attendanceComputedAt);
    const skippedCached = before - mps.length;
    if (skippedCached > 0) {
      console.log(`Skipping ${skippedCached} MP(s) already computed (use --force to recompute).`);
    }
  }

  const total = mps.length;
  console.log(`Processing ${total} MP(s) | concurrency: ${concurrency}${force ? ' | FORCE' : ''}${verbose ? ' | VERBOSE' : ''}`);
  let ok = 0, fail = 0, skipped = 0;

  for (let i = 0; i < mps.length; i += concurrency) {
    const chunk = mps.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((mp, j) => processOneMp(db, mp, termLookup, i + j, total, verbose))
    );
    for (const r of results) {
      ok += r.ok;
      fail += r.fail;
      skipped += r.skipped;
    }
  }

  await mongoose.connection.close();
  console.log(`\nDone. OK: ${ok}, Failed: ${fail}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
