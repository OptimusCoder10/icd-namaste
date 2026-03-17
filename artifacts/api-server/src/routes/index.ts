import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import predictRouter from "./predict.js";
import recordsRouter from "./records.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/predict", predictRouter);
router.use("/records", recordsRouter);

export default router;
