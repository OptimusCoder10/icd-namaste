FROM python:3.11-slim

WORKDIR /app

# System deps: curl (healthcheck) + Tesseract OCR engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Optional: BioBERT / transformers (large download - skipped for keyword fallback mode)
# Uncomment the next two lines to enable full AI embeddings:
# RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
# RUN pip install --no-cache-dir transformers huggingface-hub

COPY main.py .

EXPOSE 8001

CMD ["python", "main.py"]
