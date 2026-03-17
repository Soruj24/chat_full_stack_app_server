import express from "express";
import { isLoggedIn } from "../middleware/auth";
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead 
} from "../controllers/notificationController";

const notificationRouter = express.Router();

notificationRouter.get("/", isLoggedIn, getNotifications);
notificationRouter.patch("/:id/read", isLoggedIn, markAsRead);
notificationRouter.patch("/read-all", isLoggedIn, markAllAsRead);

export default notificationRouter;
