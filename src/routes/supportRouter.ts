import { Router } from "express";
import {
  handleSubmitTicket,
  handleGetAllTickets,
  handleGetUserTickets,
  handleGetTicketById,
  handleUpdateTicketStatus,
  handleAddTicketComment,
} from "../controllers/supportController";
import { isLoggedIn, isAdmin, hasPermission } from "../middleware/auth";
import { Permission } from "../models/interfaces/IUser";
import upload from "../config/multer.config";

const supportRouter = Router();

// ==================== PROTECTED ROUTES ====================
supportRouter.use(isLoggedIn);

// Submit a ticket
supportRouter.post("/tickets", upload.array("attachments", 5), handleSubmitTicket);

// Get user's tickets
supportRouter.get("/my-tickets", handleGetUserTickets);

// Get ticket by ID
supportRouter.get("/tickets/:id", handleGetTicketById);

// Add comment to ticket
supportRouter.post(
  "/tickets/:id/comments",
  upload.array("attachments", 5),
  handleAddTicketComment
);

// ==================== ADMIN/STAFF ROUTES ====================

// Get all tickets
supportRouter.get("/tickets", hasPermission(Permission.TICKETS_VIEW), handleGetAllTickets);

// Update ticket status
supportRouter.patch("/tickets/:id/status", hasPermission(Permission.TICKETS_EDIT), handleUpdateTicketStatus);

export default supportRouter;
