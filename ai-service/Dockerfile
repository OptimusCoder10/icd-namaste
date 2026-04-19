FROM python:3.11-slim

WORKDIR /app

# System deps: curl (healthcheck) + Tesseract OCR engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install base packages
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    uvicorn==0.32.0 \
    pydantic==2.9.2 \
    "numpy<2" \
    faiss-cpu \
    pytesseract \
    Pillow \
    sentencepiece \
    protobuf \
    huggingface-hub

# Install PyTorch CPU (smaller than full CUDA build)
RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cpu

# Install transformers + tokenizers after torch
RUN pip install --no-cache-dir transformers tokenizers

COPY main.py .

EXPOSE 8001

CMD ["python", "main.py"]
