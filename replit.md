# NAMASTE–ICD11 Clinical Mapper

## Overview

Intelligent Mobile Application for Real-Time NAMASTE–ICD-11 Clinical Mapping. Maps clinical input (symptoms / NAMASTE terms) to ICD-11 codes using semantic similarity powered by keyword-based matching and FAISS-ready architecture with BioBERT fallback.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI Service**: FastAPI (Python) with FAISS + keyword fallback
- **Mobile**: Expo React Native (Expo Router)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Output**: FHIR-formatted JSON stored in PostgreSQL

## Architecture

```text
artifacts/namaste-icd/   # Expo React Native mobile app
artifacts/api-server/    # Express backend API
ai-service/             # FastAPI Python AI service (BioBERT + FAISS)
lib/
  api-spec/             # OpenAPI spec + Orval codegen config
  api-client-react/     # Generated React Query hooks
  api-zod/              # Generated Zod schemas
  db/                   # Drizzle ORM schema + DB connection
```

## API Routes

- `POST /api/auth/login` — JWT login
- `POST /api/auth/register` — Register new user
- `POST /api/predict` — Predict ICD-11 codes from clinical text (auth required)
- `POST /api/records` — Save a confirmed FHIR record (auth required)
- `GET /api/records` — Get history of saved records (auth required)

## AI Service

- Runs on port 8001 (internal)
- FastAPI + FAISS index with 100+ ICD-11 entries
- Tries BioBERT embeddings first; falls back to keyword matching
- Backend proxies to AI service with 10s timeout

## Database Schema

- `users` — id, email, name, password_hash, created_at
- `records` — id, user_id, input_text, selected_icd, icd_description, confidence_score, fhir_json (JSONB), created_at
- `icd_codes` — code, description (reference table)

## Mobile App Screens

1. **Auth** — Login / Register with JWT
2. **Diagnose (Input)** — Enter symptoms, view ICD-11 results, confirm & save to FHIR
3. **History** — View all saved FHIR records, tap to view full FHIR JSON

## FHIR Output Format

```json
{
  "resourceType": "Condition",
  "subject": { "reference": "Patient/123" },
  "code": {
    "coding": [{ "system": "ICD-11", "code": "XXXX", "display": "Disease Name" }]
  },
  "recordedDate": "timestamp"
}
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT signing (defaults to built-in key)
- `AI_SERVICE_URL` — URL of Python AI service (defaults to http://localhost:8001)
