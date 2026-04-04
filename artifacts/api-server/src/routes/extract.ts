import { Router, type IRouter, type Response } from "express";
import multer from "multer";
import { requireDoctor, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();
const AI_SERVICE_URL = process.env["AI_SERVICE_URL"] || "http://localhost:8001";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Upload an image (JPEG, PNG, TIFF, BMP, WebP)."));
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
        res.status(400).json({ error: "No image uploaded" });
        return;
      }

      const image_b64 = req.file.buffer.toString("base64");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let aiRes: globalThis.Response;
      try {
        aiRes = await fetch(`${AI_SERVICE_URL}/extract-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_b64,
            filename: req.file.originalname || "upload.jpg",
          }),
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
