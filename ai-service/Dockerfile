FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir fastapi uvicorn pydantic numpy faiss-cpu

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir transformers huggingface-hub || \
    echo "WARNING: torch/transformers install failed, keyword fallback will be used"

COPY main.py .

EXPOSE 8001

CMD ["python", "main.py"]
