import os
import re
import requests
from tqdm import tqdm
from datetime import datetime
from pymongo import MongoClient
from google.cloud import vision
from google.cloud.vision_v1 import types
from dotenv import load_dotenv

# === CONFIG ===
lang_hint = ["en", "ms"]
load_dotenv("../../../3_app_system/backend/.env")
mongo_uri = os.getenv("MONGODB_URI")
client = MongoClient(mongo_uri)
collection = client["MyParliament"]["HansardDocument"]
vision_client = vision.ImageAnnotatorClient()

# === TEXT CLEANING ===
def clean_text(text):
    text = text.replace('\t', ' ')
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    text = re.sub(r'(?<![.!?:;])\n(?=\w)', ' ', text)
    text = re.sub(r'\s*\|\s*', ' | ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# === OCR USING GOOGLE VISION WITHOUT PAGE HEADERS ===
def ocr_with_vision(pdf_bytes):
    input_config = types.InputConfig(content=pdf_bytes, mime_type="application/pdf")
    feature = types.Feature(type_=types.Feature.Type.DOCUMENT_TEXT_DETECTION)

    request = types.AnnotateFileRequest(
        input_config=input_config,
        features=[feature],
        image_context=types.ImageContext(language_hints=lang_hint)
    )

    response = vision_client.batch_annotate_files(requests=[request])
    responses = response.responses[0].responses

    all_text = ""
    for page_response in responses:
        if page_response.error.message:
            raise Exception(f"OCR error: {page_response.error.message}")
        text = page_response.full_text_annotation.text.strip()
        if text:
            all_text += "\n" + text

    return all_text.strip()

# === DOWNLOAD PDF ===
def download_pdf(url) -> bytes:
    r = requests.get(url)
    if r.status_code != 200:
        raise Exception(f"Download failed: {url}")
    return r.content

# === GET LOW RESOL DOCS ===
docs = list(collection.find({
    "low_ocr_resol": True,
    "ocr_text": {"$exists": False}
}, {"_id": 1, "hansardDate": 1}))

print(f"Low resolution documents to process: {len(docs)}")

# === PROCESS LOOP ===
for doc in tqdm(docs, desc="Solving low_ocr_resol"):
    _id = doc["_id"]
    date = doc["hansardDate"]
    date_str = date.strftime("%d%m%Y")
    url = f"https://www.parlimen.gov.my/files/hindex/pdf/DR-{date_str}.pdf"

    try:
        pdf_bytes = download_pdf(url)
        raw_text = ocr_with_vision(pdf_bytes)
        cleaned = clean_text(raw_text)

        collection.update_one({"_id": _id}, {
            "$set": {
                "ocr_text": cleaned,
                "processable": True,
                "low_ocr_resol": "solved"
            }
        })

        print(f"[{date_str}]  OCR solved and updated")

    except Exception as e:
        print(f"[{date_str}]  Error: {e}")
