import { Router, type IRouter, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { requireDoctor, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/search", requireDoctor, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query["q"] ?? "").trim();
    if (!q || q.length < 2) {
      res.json({ patients: [] });
      return;
    }
    const pattern = `%${q}%`;
    const patients = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(and(ilike(usersTable.name, pattern), eq(usersTable.role, "patient")))
      .limit(10);

    res.json({ patients });
  } catch (err) {
    console.error("Patient search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
