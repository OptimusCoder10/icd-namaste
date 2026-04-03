import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface IcdMatch {
  code: string;
  description: string;
  score: number;
}

interface PredictResponse {
  results: IcdMatch[];
  ai_available: boolean;
}

export interface PatientSuggestion {
  id: number;
  name: string;
}

export interface RecordItem {
  id: number;
  user_id: number;
  patient_id: number | null;
  input_text: string;
  selected_icd: string;
  icd_description: string;
  confidence_score: number;
  doctor_confidence: number | null;
  fhir_json: object;
  created_at: string;
  doctor_name?: string;
  patient_name?: string;
}

interface ApiContextType {
  predict: (text: string) => Promise<PredictResponse>;
  saveRecord: (data: {
    input_text: string;
    selected_icd: string;
    icd_description: string;
    confidence_score: number;
    doctor_confidence: number;
    patient_id?: number | null;
  }) => Promise<RecordItem>;
  getHistory: () => Promise<RecordItem[]>;
  searchRecords: (query: string) => Promise<RecordItem[]>;
  searchPatients: (query: string) => Promise<PatientSuggestion[]>;
  extractText: (file: { uri: string; name: string; mimeType: string }) => Promise<string>;
}

const ApiContext = createContext<ApiContextType | null>(null);

const domain = process.env["EXPO_PUBLIC_DOMAIN"];
const BASE_URL = domain
  ? domain.includes("localhost") || domain.includes("127.0.0.1")
    ? `http://${domain}/api`
    : `https://${domain}/api`
  : "/api";

export function ApiProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const predict = async (text: string): Promise<PredictResponse> => {
    const res = await fetch(`${BASE_URL}/predict`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Prediction failed");
    return data;
  };

  const saveRecord = async (body: {
    input_text: string;
    selected_icd: string;
    icd_description: string;
    confidence_score: number;
    doctor_confidence: number;
    patient_id?: number | null;
  }): Promise<RecordItem> => {
    const res = await fetch(`${BASE_URL}/records`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    return data;
  };

  const getHistory = async (): Promise<RecordItem[]> => {
    const res = await fetch(`${BASE_URL}/records`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch history");
    return data.records;
  };

  const searchRecords = async (query: string): Promise<RecordItem[]> => {
    const res = await fetch(`${BASE_URL}/records/search?q=${encodeURIComponent(query)}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Search failed");
    return data.records;
  };

  const searchPatients = async (query: string): Promise<PatientSuggestion[]> => {
    if (!query || query.length < 2) return [];
    const res = await fetch(`${BASE_URL}/patients/search?q=${encodeURIComponent(query)}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Patient search failed");
    return data.patients;
  };

  const extractText = async (file: { uri: string; name: string; mimeType: string }): Promise<string> => {
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    const res = await fetch(`${BASE_URL}/extract-text`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Text extraction failed");
    return data.text as string;
  };

  return (
    <ApiContext.Provider value={{ predict, saveRecord, getHistory, searchRecords, searchPatients, extractText }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used within ApiProvider");
  return ctx;
}
