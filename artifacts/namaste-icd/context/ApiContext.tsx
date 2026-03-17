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

interface Record {
  id: number;
  user_id: number;
  input_text: string;
  selected_icd: string;
  icd_description: string;
  confidence_score: number;
  fhir_json: object;
  created_at: string;
}

interface ApiContextType {
  predict: (text: string) => Promise<PredictResponse>;
  saveRecord: (data: {
    input_text: string;
    selected_icd: string;
    icd_description: string;
    confidence_score: number;
  }) => Promise<Record>;
  getHistory: () => Promise<Record[]>;
}

const ApiContext = createContext<ApiContextType | null>(null);

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
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
  }): Promise<Record> => {
    const res = await fetch(`${BASE_URL}/records`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    return data;
  };

  const getHistory = async (): Promise<Record[]> => {
    const res = await fetch(`${BASE_URL}/records`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch history");
    return data.records;
  };

  return (
    <ApiContext.Provider value={{ predict, saveRecord, getHistory }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used within ApiProvider");
  return ctx;
}
