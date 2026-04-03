import os
import io
import json
import numpy as np
import faiss
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn

app = FastAPI(title="NAMASTE-ICD11 AI Service")

ICD_DATA = [
    {"code": "1A00", "description": "Cholera"},
    {"code": "1A01", "description": "Intestinal infections due to Shigella"},
    {"code": "1A02", "description": "Intestinal infections due to Salmonella"},
    {"code": "1A03", "description": "Typhoid fever"},
    {"code": "1A04", "description": "Paratyphoid fever"},
    {"code": "1B10", "description": "Pulmonary tuberculosis"},
    {"code": "1B11", "description": "Extrapulmonary tuberculosis"},
    {"code": "1B50", "description": "Leprosy"},
    {"code": "1C00", "description": "Tetanus"},
    {"code": "1C10", "description": "Dengue fever"},
    {"code": "1C11", "description": "Dengue fever with warning signs"},
    {"code": "1C12", "description": "Severe dengue"},
    {"code": "1C20", "description": "Malaria due to Plasmodium falciparum"},
    {"code": "1C21", "description": "Malaria due to Plasmodium vivax"},
    {"code": "1D00", "description": "Measles"},
    {"code": "1D01", "description": "Mumps"},
    {"code": "1D02", "description": "Rubella"},
    {"code": "1D40", "description": "Varicella"},
    {"code": "1D60", "description": "Influenza due to identified seasonal influenza virus"},
    {"code": "1D61", "description": "Influenza with pneumonia"},
    {"code": "1F20", "description": "COVID-19"},
    {"code": "5A00", "description": "Type 1 diabetes mellitus"},
    {"code": "5A10", "description": "Type 2 diabetes mellitus"},
    {"code": "5A11", "description": "Type 2 diabetes mellitus with hyperglycaemia"},
    {"code": "5B55", "description": "Hypothyroidism"},
    {"code": "5B00", "description": "Hyperthyroidism"},
    {"code": "BA00", "description": "Essential hypertension"},
    {"code": "BA41", "description": "Acute myocardial infarction"},
    {"code": "BA80", "description": "Ischaemic heart disease"},
    {"code": "BA81", "description": "Angina pectoris"},
    {"code": "BB00", "description": "Heart failure"},
    {"code": "BB10", "description": "Pulmonary oedema"},
    {"code": "BC00", "description": "Atrial fibrillation"},
    {"code": "BC10", "description": "Ventricular fibrillation"},
    {"code": "CA06", "description": "Pneumonia due to Streptococcus pneumoniae"},
    {"code": "CA20", "description": "Acute upper respiratory infections"},
    {"code": "CA21", "description": "Acute pharyngitis"},
    {"code": "CA22", "description": "Acute tonsillitis"},
    {"code": "CA23", "description": "Acute laryngitis"},
    {"code": "CA40", "description": "Asthma"},
    {"code": "CA41", "description": "Acute asthma"},
    {"code": "CA23.0", "description": "Chronic obstructive pulmonary disease"},
    {"code": "CB24", "description": "Pleural effusion"},
    {"code": "DA01", "description": "Gastric ulcer"},
    {"code": "DA02", "description": "Duodenal ulcer"},
    {"code": "DA10", "description": "Gastritis"},
    {"code": "DA90", "description": "Irritable bowel syndrome"},
    {"code": "DA91", "description": "Crohn disease"},
    {"code": "DA92", "description": "Ulcerative colitis"},
    {"code": "DB30", "description": "Cirrhosis of liver"},
    {"code": "DB31", "description": "Alcoholic liver disease"},
    {"code": "EA90", "description": "Eczema"},
    {"code": "FA00", "description": "Rheumatoid arthritis"},
    {"code": "FA01", "description": "Psoriatic arthritis"},
    {"code": "FA10", "description": "Osteoarthritis"},
    {"code": "FB01", "description": "Fracture of femur"},
    {"code": "FB02", "description": "Fracture of spine"},
    {"code": "GA00", "description": "Urinary tract infection"},
    {"code": "GA01", "description": "Acute pyelonephritis"},
    {"code": "GA50", "description": "Chronic kidney disease"},
    {"code": "GA51", "description": "Acute kidney failure"},
    {"code": "HA00", "description": "Iron deficiency anaemia"},
    {"code": "HA01", "description": "Vitamin B12 deficiency anaemia"},
    {"code": "JA00", "description": "Epilepsy"},
    {"code": "JA20", "description": "Migraine"},
    {"code": "JA21", "description": "Tension-type headache"},
    {"code": "JA40", "description": "Ischaemic stroke"},
    {"code": "JA41", "description": "Haemorrhagic stroke"},
    {"code": "KA00", "description": "Depressive episode"},
    {"code": "KA01", "description": "Recurrent depressive disorder"},
    {"code": "KA20", "description": "Generalised anxiety disorder"},
    {"code": "KA21", "description": "Panic disorder"},
    {"code": "KA30", "description": "Schizophrenia"},
    {"code": "LA80", "description": "Carcinoma of breast"},
    {"code": "LA81", "description": "Carcinoma of lung"},
    {"code": "LA82", "description": "Carcinoma of cervix uteri"},
    {"code": "LA83", "description": "Carcinoma of colon"},
    {"code": "LA84", "description": "Carcinoma of prostate"},
    {"code": "LA85", "description": "Leukaemia"},
    {"code": "MG50", "description": "Fever of unknown origin"},
    {"code": "MG51", "description": "Fatigue"},
    {"code": "MG52", "description": "Chills and rigor"},
    {"code": "MG53", "description": "Headache"},
    {"code": "MG54", "description": "Chest pain"},
    {"code": "MG55", "description": "Abdominal pain"},
    {"code": "MG56", "description": "Nausea and vomiting"},
    {"code": "MG57", "description": "Diarrhoea"},
    {"code": "MG58", "description": "Cough"},
    {"code": "MG59", "description": "Dyspnoea"},
    {"code": "MG60", "description": "Oedema"},
    {"code": "MG61", "description": "Weight loss"},
    {"code": "MG62", "description": "Night sweats"},
    {"code": "MG63", "description": "Jaundice"},
    {"code": "MG64", "description": "Haematuria"},
    {"code": "MG65", "description": "Back pain"},
    {"code": "MG66", "description": "Joint pain"},
    {"code": "MG67", "description": "Skin rash"},
    {"code": "MG68", "description": "Anaemia"},
    {"code": "TA80", "description": "Head injury"},
    {"code": "NA00", "description": "Sepsis"},
    {"code": "NA01", "description": "Septic shock"},
]

model = None
tokenizer = None
index = None
icd_embeddings = None
USE_AI = False

def get_embeddings_from_texts(texts):
    import torch
    inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
    embeddings = outputs.last_hidden_state[:, 0, :].numpy()
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings / (norms + 1e-8)

def load_model_and_index():
    global model, tokenizer, index, icd_embeddings, USE_AI
    try:
        print("Loading BioBERT model...")
        from transformers import AutoTokenizer, AutoModel
        import torch
        tokenizer = AutoTokenizer.from_pretrained("dmis-lab/biobert-base-cased-v1.1")
        model = AutoModel.from_pretrained("dmis-lab/biobert-base-cased-v1.1")
        model.eval()
        print("BioBERT loaded. Building FAISS index...")
        descriptions = [item["description"] for item in ICD_DATA]
        batch_size = 16
        all_embeddings = []
        for i in range(0, len(descriptions), batch_size):
            batch = descriptions[i:i+batch_size]
            embs = get_embeddings_from_texts(batch)
            all_embeddings.append(embs)
        icd_embeddings = np.vstack(all_embeddings).astype("float32")
        dim = icd_embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(icd_embeddings)
        USE_AI = True
        print(f"FAISS index built with {index.ntotal} entries. AI is ready.")
    except Exception as e:
        print(f"Could not load BioBERT: {e}. Using keyword fallback.")
        USE_AI = False

def keyword_search(text: str, top_k: int = 5):
    text_lower = text.lower()
    scores = []
    words = set(text_lower.split())
    for item in ICD_DATA:
        desc_words = set(item["description"].lower().split())
        common = words & desc_words
        score = len(common) / (len(words) + 1)
        bonus_terms = ["fever", "pain", "infection", "disorder", "syndrome", "acute", "chronic",
                       "cough", "diarrhea", "diarrhoea", "nausea", "vomiting", "headache",
                       "diabetes", "hypertension", "cancer", "heart", "lung", "kidney",
                       "rash", "fatigue", "chills", "breathing", "chest"]
        for term in bonus_terms:
            if term in text_lower and term in item["description"].lower():
                score += 0.3
        scores.append((item, score))
    scores.sort(key=lambda x: x[1], reverse=True)
    results = []
    for item, score in scores[:top_k]:
        confidence = min(0.95, max(0.1, score + 0.3))
        results.append({
            "code": f"ICD-11-{item['code']}",
            "description": item["description"],
            "score": round(confidence, 3)
        })
    return results

class PredictRequest(BaseModel):
    text: str

class IcdMatch(BaseModel):
    code: str
    description: str
    score: float

@app.on_event("startup")
async def startup_event():
    import threading
    t = threading.Thread(target=load_model_and_index, daemon=True)
    t.start()

@app.get("/health")
def health():
    return {"status": "ok", "ai_available": USE_AI}

@app.post("/predict")
def predict(req: PredictRequest) -> List[IcdMatch]:
    if USE_AI and model is not None and index is not None:
        try:
            emb = get_embeddings_from_texts([req.text]).astype("float32")
            distances, indices = index.search(emb, k=5)
            results = []
            for dist, idx in zip(distances[0], indices[0]):
                item = ICD_DATA[idx]
                score = float(1.0 / (1.0 + dist))
                score = min(0.99, max(0.01, score))
                results.append(IcdMatch(
                    code=f"ICD-11-{item['code']}",
                    description=item["description"],
                    score=round(score, 3)
                ))
            return results
        except Exception as e:
            print(f"AI prediction failed: {e}, falling back to keyword search")
    kw_results = keyword_search(req.text, top_k=5)
    return [IcdMatch(**r) for r in kw_results]

@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    content = await file.read()
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    extracted = ""

    if "pdf" in content_type or filename.endswith(".pdf"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                pages_text = []
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        pages_text.append(t.strip())
                extracted = "\n\n".join(pages_text)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"PDF extraction failed: {str(e)}")
    elif any(x in content_type for x in ["image/", "jpeg", "jpg", "png", "tiff", "bmp", "webp"]) or \
         any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"]):
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(io.BytesIO(content))
            extracted = pytesseract.image_to_string(img, lang="eng")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Image OCR failed: {str(e)}")
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload a PDF or image (JPEG, PNG, TIFF).")

    extracted = extracted.strip()
    if not extracted:
        raise HTTPException(status_code=422, detail="No text could be extracted from the file.")

    return {"text": extracted, "chars": len(extracted)}


if __name__ == "__main__":
    port = int(os.environ.get("AI_SERVICE_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
