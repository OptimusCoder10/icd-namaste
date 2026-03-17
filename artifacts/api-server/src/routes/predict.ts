import { Router, type IRouter, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();
const AI_SERVICE_URL = process.env["AI_SERVICE_URL"] || "http://localhost:8001";

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    let results = [];
    let ai_available = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const aiRes = await fetch(`${AI_SERVICE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (aiRes.ok) {
        results = await aiRes.json();
        ai_available = true;
      }
    } catch (err) {
      console.warn("AI service unavailable, using fallback:", err);
      results = keywordFallback(text);
      ai_available = false;
    }

    res.json({ results, ai_available });
  } catch (err) {
    console.error("Predict error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function keywordFallback(text: string) {
  const ICD_FALLBACK = [
    { code: "ICD-11-MG50", description: "Fever of unknown origin" },
    { code: "ICD-11-1D60", description: "Influenza due to identified seasonal influenza virus" },
    { code: "ICD-11-1C10", description: "Dengue fever" },
    { code: "ICD-11-1F20", description: "COVID-19" },
    { code: "ICD-11-CA40", description: "Asthma" },
    { code: "ICD-11-BA00", description: "Essential hypertension" },
    { code: "ICD-11-5A10", description: "Type 2 diabetes mellitus" },
    { code: "ICD-11-JA20", description: "Migraine" },
    { code: "ICD-11-GA00", description: "Urinary tract infection" },
    { code: "ICD-11-KA00", description: "Depressive episode" },
    { code: "ICD-11-CA20", description: "Acute upper respiratory infections" },
    { code: "ICD-11-DA10", description: "Gastritis" },
    { code: "ICD-11-MG58", description: "Cough" },
    { code: "ICD-11-MG59", description: "Dyspnoea" },
    { code: "ICD-11-MG55", description: "Abdominal pain" },
  ];

  const textLower = text.toLowerCase();
  const words = new Set(textLower.split(/\s+/));
  
  const scored = ICD_FALLBACK.map(item => {
    const descWords = new Set(item.description.toLowerCase().split(/\s+/));
    const common = [...words].filter(w => descWords.has(w) || item.description.toLowerCase().includes(w));
    const score = Math.min(0.9, 0.3 + common.length * 0.15);
    return { ...item, score: parseFloat(score.toFixed(3)) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

export default router;
