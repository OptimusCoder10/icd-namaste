import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import predictRouter from "./predict.js";
import recordsRouter from "./records.js";
import patientsRouter from "./patients.js";
import extractRouter from "./extract.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/predict", predictRouter);
router.use("/records", recordsRouter);
router.use("/patients", patientsRouter);
router.use("/extract-text", extractRouter);

export default router;
