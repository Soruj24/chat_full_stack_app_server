import { Router } from "express";
import {
    advancedIPController,
    ipRateLimit,
    addRequestStartTime,
    bulkIPController,
    debugIPMiddleware // Optional: for debugging only
} from "../controllers/ipController";

const ipRouter = Router();

// Production route (recommended)
ipRouter.get("/ipinfo", ipRateLimit, addRequestStartTime, advancedIPController);

// Bulk IP lookup route
ipRouter.post("/ipinfo/bulk", ipRateLimit, bulkIPController);

// Debug route (temporary - remove for production)
// ipRouter.get("/ipinfo/debug", debugIPMiddleware, ipRateLimit, addRequestStartTime, advancedIPController);

export default ipRouter;