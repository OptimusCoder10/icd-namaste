import { Router, type IRouter, type Response } from "express";
import { requireDoctor, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();
const AI_SERVICE_URL = process.env["AI_SERVICE_URL"] || "http://localhost:8001";

router.post(
  "/",
  requireDoctor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { image_b64, mime_type } = req.body as { image_b64?: string; mime_type?: string };

      if (!image_b64 || typeof image_b64 !== "string" || image_b64.length === 0) {
        res.status(400).json({ error: "image_b64 is required" });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let aiRes: globalThis.Response;
      try {
        aiRes = await fetch(`${AI_SERVICE_URL}/extract-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_b64, filename: "upload.jpg" }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await aiRes.json() as { text?: string; chars?: number; detail?: string };

      if (!aiRes.ok) {
        res.status(aiRes.status).json({ error: data.detail || "Extraction failed" });
        return;
      }

      res.json({ text: data.text, chars: data.chars });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        res.status(504).json({ error: "OCR service timed out" });
        return;
      }
      console.error("Extract text error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
