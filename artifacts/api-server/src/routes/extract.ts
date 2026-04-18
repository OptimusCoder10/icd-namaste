import { Router, type IRouter, type Response } from "express";
import { requireDoctor, type AuthRequest } from "../middlewares/auth.js";
import { createWorker } from "tesseract.js";

const router: IRouter = Router();

router.post(
  "/",
  requireDoctor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { image_b64, mime_type } = req.body as {
        image_b64?: string;
        mime_type?: string;
      };

      if (!image_b64 || typeof image_b64 !== "string" || image_b64.length === 0) {
        res.status(400).json({ error: "image_b64 is required" });
        return;
      }

      const mimeType = mime_type || "image/jpeg";
      const buffer = Buffer.from(image_b64, "base64");

      const worker = await createWorker("eng", 1, {
        logger: () => {},
      });

      try {
        const { data } = await worker.recognize(buffer);
        const text = data.text.trim();
        res.json({ text, chars: text.length });
      } finally {
        await worker.terminate();
      }
    } catch (err: unknown) {
      console.error("Extract text error:", err);
      res.status(500).json({ error: "OCR processing failed" });
    }
  }
);

export default router;
