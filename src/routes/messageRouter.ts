import { Router } from "express";
import { createMessage, deleteMessage, pinMessage, reactMessage, starMessage } from "../controllers/messageController";
import { isLoggedIn } from "../middleware/auth";

const messageRouter = Router();

messageRouter.post("/", isLoggedIn, createMessage);
messageRouter.delete("/:id", isLoggedIn, deleteMessage);
messageRouter.patch("/:id/pin", isLoggedIn, pinMessage);
messageRouter.post("/react", isLoggedIn, reactMessage);
messageRouter.patch("/:id/star", isLoggedIn, starMessage);

export default messageRouter;
