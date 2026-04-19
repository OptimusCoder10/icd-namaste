import { Router, type IRouter, type Response } from "express";
import { requireDoctor, type AuthRequest } from "../middlewares/auth.js";
import { createWorker, PSM } from "tesseract.js";
// jimp-compact: pure-JS image lib (transitive dep of tesseract.js), no native build needed
import Jimp from "jimp-compact";

const router: IRouter = Router();

async function preprocessImage(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const image = await Jimp.read(inputBuffer);

    const width: number = image.getWidth();
    const height: number = image.getHeight();

    // Scale up small images — Tesseract works best at ~300 DPI (≈1500–3000px wide)
    const targetWidth = 2000;
    if (width < targetWidth) {
      const scale = Math.min(targetWidth / width, 4); // cap at 4×
      image.scale(scale);
    }

    // Convert to grayscale, normalize contrast, then sharpen
    image
      .grayscale()
      .normalize()
      .contrast(0.3);

    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch {
    // If preprocessing fails, return original buffer unchanged
    return inputBuffer;
  }
}

async function runOcr(buffer: Buffer, psm: PSM): Promise<string> {
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      // Boost confidence for common clinical / alphanumeric chars
      tessedit_char_whitelist: "",
      preserve_interword_spaces: "1",
    });
    const { data } = await worker.recognize(buffer);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

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

      const raw = Buffer.from(image_b64, "base64");

      // Preprocess: grayscale + normalize + upscale → cleaner input for Tesseract
      const processed = await preprocessImage(raw);

      // Try AUTO layout detection first (best for most documents / screenshots)
      // Fall back to SPARSE_TEXT which finds text anywhere (good for photos)
      let text = await runOcr(processed, PSM.AUTO);

      if (!text || text.length < 3) {
        text = await runOcr(processed, PSM.SPARSE_TEXT);
      }

      // Strip common Tesseract garbage lines (lone box-drawing chars, single symbols)
      const cleaned = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0 && !/^[\W_]{1,2}$/.test(line))
        .join("\n")
        .trim();

      res.json({ text: cleaned, chars: cleaned.length });
    } catch (err: unknown) {
      console.error("Extract text error:", err);
      res.status(500).json({ error: "OCR processing failed" });
    }
  }
);

export default router;
