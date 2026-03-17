import { Router, type IRouter, type Response } from "express";
import { db, recordsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { input_text, selected_icd, icd_description, confidence_score } = req.body;
    if (!input_text || !selected_icd || !icd_description || confidence_score === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const userId = req.userId!;
    const fhir_json = {
      resourceType: "Condition",
      subject: { reference: `Patient/${userId}` },
      code: {
        coding: [{
          system: "ICD-11",
          code: selected_icd.replace("ICD-11-", ""),
          display: icd_description
        }]
      },
      recordedDate: new Date().toISOString()
    };

    const [record] = await db.insert(recordsTable).values({
      user_id: userId,
      input_text,
      selected_icd,
      icd_description,
      confidence_score,
      fhir_json,
    }).returning();

    res.status(201).json({
      ...record,
      created_at: record.created_at.toISOString(),
      fhir_json: record.fhir_json
    });
  } catch (err) {
    console.error("Save record error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const records = await db.select()
      .from(recordsTable)
      .where(eq(recordsTable.user_id, userId))
      .orderBy(desc(recordsTable.created_at));

    res.json({
      records: records.map(r => ({
        ...r,
        created_at: r.created_at.toISOString(),
      }))
    });
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
