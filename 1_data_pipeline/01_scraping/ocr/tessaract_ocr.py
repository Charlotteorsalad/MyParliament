import os
import re
import requests
import subprocess
import tempfile
from datetime import datetime
from pymongo import MongoClient
from tqdm import tqdm
from dotenv import load_dotenv

# === CONFIG ===
lang = "eng+msa"
threads = "56"
load_dotenv("../../../3_app_system/backend/.env")
mongo_uri = os.getenv("MONGODB_URI")
db_name = "MyParliament"
collection_name = "HansardDocument"

client = MongoClient(mongo_uri)
collection = client[db_name][collection_name]

# === TEXT CLEANING FUNCTIONS ===

def clean_column_text(text):
    text = text.replace('\t', ' ')
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    text = re.sub(r'(?<![.!?:;])\n(?=\w)', ' ', text)
    text = re.sub(r'\s*\|\s*', ' | ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def reconstruct_paragraphs_from_layout(raw_text):
    pages = raw_text.split("\f")
    cleaned_pages = []

    for idx, page in enumerate(pages):
        lines = page.splitlines()
        left_col, right_col = [], []

        if idx == 0:
            cleaned_pages.append("\n".join(lines))
            continue

        for line in lines:
            if not line.strip():
                continue
            if len(line) > 60 and line[60:].strip():
                left = line[:60].rstrip()
                right = line[60:].strip()
                left_col.append(left)
                right_col.append(right)
            else:
                left_col.append(line.strip())

        merged = left_col + right_col
        cleaned_pages.append("\n".join(merged))

    full_text = "\n\n".join(cleaned_pages)
    full_text = clean_column_text(full_text)
    return full_text

# === OCR + EXTRACT FUNCTIONS ===

def download_pdf(url) -> str:
    response = requests.get(url)
    if response.status_code == 200:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(response.content)
            return tmp_file.name
    else:
        raise Exception(f"Failed to download PDF from {url}")

def run_ocr(input_path: str) -> str:
    output_path = input_path.replace(".pdf", "-ocr.pdf")
    subprocess.run([
        "ocrmypdf",
        "--force-ocr",
        "--rotate-pages",
        "--deskew",
        "--output-type", "pdfa",
        "-l", lang,
        "--jobs", threads,
        input_path, output_path
    ], check=True)
    return output_path

def extract_layout_text(pdf_path: str) -> str:
    txt_path = pdf_path.replace(".pdf", "-layout.txt")
    subprocess.run(["pdftotext", "-layout", pdf_path, txt_path], check=True)
    with open(txt_path, "r", encoding="utf-8") as f:
        return f.read()

# === PROCESSING LOOP ===

flagged_docs = list(collection.find({
    "text_quality": "bad",
    "ocr_status": {"$in": ["forced_ocr", "need_ocr"]},
    "ocr_text": {"$exists": False},
    "processable": False,
    "low_ocr_resol": {"$ne": True}
}, {"_id": 1, "hansardDate": 1}))

print(f"Total flagged for OCR: {len(flagged_docs)}")

for doc in tqdm(flagged_docs, desc="OCR Processing"):
    _id = doc["_id"]
    date = doc["hansardDate"]
    date_str = date.strftime("%d%m%Y")
    url = f"https://www.parlimen.gov.my/files/hindex/pdf/DR-{date_str}.pdf"

    try:
        local_pdf = download_pdf(url)
        ocr_pdf = run_ocr(local_pdf)
        layout_text = extract_layout_text(ocr_pdf)
        enhanced_text = reconstruct_paragraphs_from_layout(layout_text)

        collection.update_one({"_id": _id}, {
            "$set": {
                "ocr_text": enhanced_text,
                "processable": True
            }
        })

        print(f"[{date_str}]  Document inserted.")

        os.remove(local_pdf)
        os.remove(ocr_pdf)
        layout_txt = ocr_pdf.replace("-ocr.pdf", "-layout.txt")
        if os.path.exists(layout_txt):
            os.remove(layout_txt)

    except subprocess.CalledProcessError as e:
        # Flagging if it's a layout/image problem (safe generalization)
        collection.update_one({"_id": _id}, {
            "$set": {
                "low_ocr_resol": True
            }
        })
        print(f"[{date_str}]  OCR subprocess error. Flagged as low_ocr_resol.")

    except Exception as e:
        print(f"[{date_str}]  Unexpected error: {e}")
