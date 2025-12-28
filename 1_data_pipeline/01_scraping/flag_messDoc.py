from pymongo import MongoClient
import re
from datetime import datetime
from dotenv import load_dotenv
import os

# MongoDB connection
load_dotenv("../../3_app_system/backend/.env")
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["MyParliament"]
collection = db["HansardDocument"]

# Heuristic OCR quality checker for 1981 and above
def is_ocr_needed(text):
    if not text or not text.strip():
        return True
    
    lines = text.splitlines()
    if len(lines) < 5:  
        return True
        
    bad_lines = 0
    for line in lines:
        if len(line.strip()) < 10:
            continue
            
        space_ratio = sum(w.count(" ") for w in line.split()) / max(len(line), 1)
        gibberish = re.search(r'[a-zA-Z]{3,}[0-9]{2,}', line) or re.search(r'[a-z]{2,}[A-Z]{2,}[a-z]{2,}', line)
        weird_symbols = re.search(r'[·•©®±§\u2013\u2014\u2019\u201C\u201D]', line)
        bad_unicode = re.search(r'\\x|\\u|[\uFFFD]', line)
        honorifics = len(re.findall(r'(TUNKU|DATO|TUAN|ENCHE|MR\.|DR\.)', line.upper()))
        
        issues = 0
        if space_ratio > 0.2: 
            issues += 1
        if gibberish:
            issues += 1
        if weird_symbols:
            issues += 1
        if bad_unicode:
            issues += 1
        if honorifics >= 4:  
            issues += 1
            
        if issues >= 2:  
            bad_lines += 1
    
    bad_ratio = bad_lines / len(lines) if lines else 1.0
    return bad_lines > 5 or bad_ratio > 0.05  

# Counters
processed_count = 0
forced_ocr = 0
need_ocr = 0
no_need_ocr = 0

# Reset and reprocess all documents
print("Resetting all text_quality fields for reprocessing...")
collection.update_many({}, {"$unset": {"text_quality": "", "ocr_status": "", "processable": ""}})

# Make sure process ALL documents
total_docs = collection.count_documents({})
print(f"Total documents in database: {total_docs}")

# Count documents that need processing
unprocessed_docs = collection.count_documents({"text_quality": {"$exists": False}})
print(f"Unprocessed documents: {unprocessed_docs}")

# Process in batches
batch_size = 1000  

for skip in range(0, total_docs, batch_size):
    # Only get documents that haven't been processed yet
    docs = list(collection.find(
        {"text_quality": {"$exists": False}},
        {"_id": 1, "content_text": 1, "hansardDate": 1}
    ).limit(batch_size))
    
    batch_count = len(docs)
    if batch_count == 0:
        print("No more documents to process. Exiting batch processing.")
        break
        
    print(f"Processing batch of {batch_count} documents...")
    
    for doc in docs:
        _id = doc["_id"]
        text = doc.get("content_text", "")
        hansard_date = doc.get("hansardDate")
        
        # Forced OCR for 1959–1980
        if hansard_date and hansard_date.year <= 1980:
            ocr_status = "forced_ocr"
            text_quality = "bad"  # "bad" means needs OCR (poor quality text)
            forced_ocr += 1
        # Heuristic check for 1981–2025
        else:
            needs_ocr = is_ocr_needed(text)
            if needs_ocr:
                ocr_status = "need_ocr"
                text_quality = "bad"  # "bad" means needs OCR (poor quality text)
                need_ocr += 1
            else:
                ocr_status = "no_need_ocr"
                text_quality = "ok"  # "ok" means no need for OCR (good quality text)
                no_need_ocr += 1
        
        # Update MongoDB - always set processable to false initially
        collection.update_one(
            {"_id": _id},
            {"$set": {
                "ocr_status": ocr_status,
                "text_quality": text_quality,
                "processable": False  # Set to false initially, post OCR will be set to true
            }}
        )
        processed_count += 1
    
    print(f"Batch complete: Processed {processed_count} / {unprocessed_docs} documents")

# Check if any documents were missed
unprocessed_remaining = collection.count_documents({"text_quality": {"$exists": False}})
print(f"Checking for missed documents: {unprocessed_remaining} documents still unprocessed")

# If any documents were missed, process them now
if unprocessed_remaining > 0:
    print(f"Processing {unprocessed_remaining} remaining documents...")
    
    remaining_docs = list(collection.find(
        {"text_quality": {"$exists": False}},
        {"_id": 1, "content_text": 1, "hansardDate": 1}
    ))
    
    for doc in remaining_docs:
        _id = doc["_id"]
        text = doc.get("content_text", "")
        hansard_date = doc.get("hansardDate")
        
        # Forced OCR for 1959–1980
        if hansard_date and hansard_date.year <= 1980:
            ocr_status = "forced_ocr"
            text_quality = "bad"  # "bad" means needs OCR (poor quality text)
            forced_ocr += 1
        # Heuristic check for 1981–2025
        else:
            needs_ocr = is_ocr_needed(text)
            if needs_ocr:
                ocr_status = "need_ocr"
                text_quality = "bad"  # "bad" means needs OCR (poor quality text)
                need_ocr += 1
            else:
                ocr_status = "no_need_ocr"
                text_quality = "ok"  # "ok" means no need for OCR (good quality text)
                no_need_ocr += 1
        
        # Update MongoDB
        collection.update_one(
            {"_id": _id},
            {"$set": {
                "ocr_status": ocr_status,
                "text_quality": text_quality,
                "processable": False
            }}
        )
        processed_count += 1

# Final Summary
print("\nOCR Flagging Completed")
print(f"Total documents processed: {processed_count}")
print(f"Forced OCR (1959–1980): {forced_ocr}")
print(f"Need OCR (heuristic 1981–2025): {need_ocr}")
print(f"No need OCR: {no_need_ocr}")

# Final verification
final_check = collection.count_documents({"text_quality": {"$exists": False}})
print(f"Final verification - Documents without text_quality field: {final_check}")

if final_check > 0:
    print("WARNING: Some documents were not processed. Please run the script again.")
else:
    print("SUCCESS: All documents have been processed.")

# Print total counts for each category
total_bad = collection.count_documents({"text_quality": "bad"})
total_ok = collection.count_documents({"text_quality": "ok"})
print(f"Total documents marked as 'bad' (needs OCR): {total_bad}")
print(f"Total documents marked as 'ok' (no OCR needed): {total_ok}")