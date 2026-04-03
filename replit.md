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
- `POST /api/records` — Save a confirmed FHIR record with optional patient_id (doctor only)
- `GET /api/records` — Get history; doctors see their records with patient_name, patients see only records linked to them
- `GET /api/records/search?q=` — Search records; patients only search within their own linked records
- `GET /api/patients/search?q=` — Search patients by name for doctor linking (doctor only, returns id+name only)

## AI Service

- Runs on port 8001 (internal)
- FastAPI + FAISS index with 100+ ICD-11 entries
- Tries BioBERT embeddings first; falls back to keyword matching
- Backend proxies to AI service with 10s timeout

## Database Schema

- `users` — id, email, name, password_hash, role, created_at
- `records` — id, user_id, patient_id (FK nullable), input_text, selected_icd, icd_description, confidence_score, doctor_confidence, fhir_json (JSONB), created_at
- `icd_codes` — code, description (reference table)

## Doctor-Patient Matching

- Doctors can optionally link a diagnosis to a registered patient by searching their name
- Patient names are returned for search (id + name only, no email for privacy)
- When a patient logs in, they only see diagnoses explicitly linked to them via patient_id
- Patient search in history only searches within their own records (ICD codes/descriptions, no patient names exposed)
- Doctors see patient name badge on each record in their history
- FHIR JSON uses the linked patient's ID as the subject reference

## Mobile App Screens

1. **Auth** — Login / Register with JWT, role selection (Doctor / Patient)
2. **Diagnose (Input)** — Doctor: search & link patient, enter symptoms, view ICD-11 results, set confidence & save to FHIR. Patient: portal redirect screen.
3. **History** — Doctor: records with patient name badges, searchable. Patient: only their own linked diagnoses, searchable by ICD code/description, ranked by doctor confidence.

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
