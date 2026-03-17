import { Router } from "express";
import { getChats, createChat, getChatMessages } from "../controllers/chatController";
import { isLoggedIn } from "../middleware/auth";

const chatRouter = Router();

chatRouter.get("/", isLoggedIn, getChats);
chatRouter.post("/", isLoggedIn, createChat);
chatRouter.get("/:id/messages", isLoggedIn, getChatMessages);

export default chatRouter;
