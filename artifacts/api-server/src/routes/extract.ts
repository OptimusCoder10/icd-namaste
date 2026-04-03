import { Router, type IRouter, type Response } from "express";
import multer from "multer";
import { requireDoctor, type AuthRequest } from "../middlewares/auth.js";
import FormData from "form-data";

const router: IRouter = Router();
const AI_SERVICE_URL = process.env["AI_SERVICE_URL"] || "http://localhost:8001";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/tiff",
      "image/bmp",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Upload a PDF or image (JPEG, PNG, TIFF)."));
    }
  },
});

router.post(
  "/",
  requireDoctor,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: req.file.originalname || "upload",
        contentType: req.file.mimetype,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let aiRes: globalThis.Response;
      try {
        aiRes = await fetch(`${AI_SERVICE_URL}/extract-text`, {
          method: "POST",
          body: form as unknown as BodyInit,
          headers: form.getHeaders(),
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
