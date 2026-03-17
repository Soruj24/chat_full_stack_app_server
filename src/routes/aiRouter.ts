import { Router } from "express";
import { handleAiChat } from "../controllers/aiController";
import { isLoggedIn } from "../middleware/auth";

const aiRouter = Router();

// AI Chat route - protected by login
aiRouter.post("/chat", isLoggedIn, handleAiChat);

export default aiRouter;
