import { Router, type IRouter, type Response } from "express";
import { db, recordsTable, usersTable } from "@workspace/db";
import { eq, desc, ilike, or } from "drizzle-orm";
import { requireAuth, requireDoctor, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.post("/", requireDoctor, async (req: AuthRequest, res: Response) => {
  try {
    const { input_text, selected_icd, icd_description, confidence_score, doctor_confidence } = req.body;
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
      extension: [{
        url: "doctor-confidence",
        valueInteger: doctor_confidence ?? null
      }],
      recordedDate: new Date().toISOString()
    };

    const [record] = await db.insert(recordsTable).values({
      user_id: userId,
      input_text,
      selected_icd,
      icd_description,
      confidence_score,
      doctor_confidence: typeof doctor_confidence === "number" ? doctor_confidence : null,
      fhir_json,
    }).returning();

    res.status(201).json({
      ...record,
      created_at: record.created_at.toISOString(),
    });
  } catch (err) {
    console.error("Save record error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query["q"] ?? "").trim();
    if (!q) {
      res.json({ records: [] });
      return;
    }
    const pattern = `%${q}%`;
    const records = await db.select({
      id: recordsTable.id,
      user_id: recordsTable.user_id,
      input_text: recordsTable.input_text,
      selected_icd: recordsTable.selected_icd,
      icd_description: recordsTable.icd_description,
      confidence_score: recordsTable.confidence_score,
      doctor_confidence: recordsTable.doctor_confidence,
      fhir_json: recordsTable.fhir_json,
      created_at: recordsTable.created_at,
      doctor_name: usersTable.name,
    })
      .from(recordsTable)
      .leftJoin(usersTable, eq(recordsTable.user_id, usersTable.id))
      .where(
        or(
          ilike(recordsTable.selected_icd, pattern),
          ilike(recordsTable.icd_description, pattern),
          ilike(recordsTable.input_text, pattern)
        )
      )
      .orderBy(desc(recordsTable.doctor_confidence));

    res.json({
      records: records.map(r => ({
        ...r,
        created_at: r.created_at.toISOString(),
      }))
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const role = req.userRole;

    if (role === "patient") {
      const records = await db.select({
        id: recordsTable.id,
        user_id: recordsTable.user_id,
        input_text: recordsTable.input_text,
        selected_icd: recordsTable.selected_icd,
        icd_description: recordsTable.icd_description,
        confidence_score: recordsTable.confidence_score,
        doctor_confidence: recordsTable.doctor_confidence,
        fhir_json: recordsTable.fhir_json,
        created_at: recordsTable.created_at,
        doctor_name: usersTable.name,
      })
        .from(recordsTable)
        .leftJoin(usersTable, eq(recordsTable.user_id, usersTable.id))
        .orderBy(desc(recordsTable.doctor_confidence));

      res.json({
        records: records.map(r => ({
          ...r,
          created_at: r.created_at.toISOString(),
        }))
      });
    } else {
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
    }
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
