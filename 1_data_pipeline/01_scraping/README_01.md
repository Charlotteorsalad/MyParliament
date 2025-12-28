# 01_scraping
## Scraping & OCR Pipeline Overview

This folder contains scripts and data files related to the scraping of Malaysian Hansard documents and Member of Parliament (MP) metadata, covering both historical and current parliaments.
----------------------------------------------------------------------------------------------
## Key Components

1. HistoricalScraper.py: Scrapes Hansard URLs and metadata for Parliament Terms 1–14. Includes fuzzy matching for historical MPs and writes directly to MongoDB. 
2. flag_messDoc.txt: List of Hansard files that failed to extract clean text using pdfplumber (e.g., scanned or malformed PDFs). 
3. tessaract_ocr.py: Processes files in `flag_messDoc.txt` using Tesseract OCR as the first fallback method. 
4. googlevision_ocr.txt: List of files that failed Tesseract OCR and require Google Vision OCR (used as second fallback).
5. mp_and_honorific.txt: Scraped metadata for the 15th Parliament MPs, including honorifics. 
6. history_mp_honorific.txt: Fuzzy-matched historical MP list (1st to 14th Parliament) with corresponding honorific data.
-----------------------------------------------------------------------------------------------
## Pipeline Flow

[HistoricalScraper.py]
	↓
[Clean success] → MongoDB 
[Parse fail] → flag_messDoc.txt
			↓
		[tessaract_ocr.py]
			↓ (fail)
		[googlevision_ocr.txt]

------------------------------------------------------------------------------------------------
## Output Destination

- All successful Hansard documents are stored in the MongoDB collection: `HansardDocument`.
- Metadata is updated in the collection: `MP`.
------------------------------------------------------------------------------------------------
## Proof of Execution

- MongoDB Compass screenshots are provided to verify total documents scraped.
- `flag_messDoc.txt` and OCR logs are available for review.
- No output cells exist for these scripts, as they are executed in `.py` format within a local Ubuntu VM.
-------------------------------------------------------------------------------------------------
## Notes

- Scripts in this folder are **not designed for notebook environments** and will not display output unless explicitly printed.
