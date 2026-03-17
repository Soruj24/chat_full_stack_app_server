import { Request, Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import createError from "http-errors";
import { SupportTicket } from "../models/SupportTicket";
import { successResponse } from "./responsControllers";
import { uploadToCloudinary } from "../utils/cloudinary";
import { AuthRequest } from "../types";
import Notification from "../models/Notification";

/**
 * @desc    Submit a support ticket
 * @route   POST /api/support/tickets
 * @access  Private
 */
export const handleSubmitTicket = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { subject, description, category, priority, logs } = req.body;

    if (!subject || !description || !category) {
      throw createError(400, "Subject, description, and category are required");
    }

    const attachments: string[] = [];
    const files = req.files as Express.Multer.File[];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const result: any = await uploadToCloudinary(
            file.buffer,
            "support-tickets"
          );
          attachments.push(result.secure_url);
        } catch (error) {
          console.error("Cloudinary upload error:", error);
          // Continue even if one file fails? Or throw?
        }
      }
    }

    const finalDescription = logs
      ? `${description}\n\n--- SECURITY LOGS ATTACHED ---\n${logs}`
      : description;

    const ticket = await SupportTicket.create({
      userId: req.user?._id,
      subject,
      description: finalDescription,
      category,
      priority: priority || "medium",
      attachments,
    });

    // Create notification for user
    await Notification.create({
      userId: req.user?._id,
      title: "Support Ticket Submitted",
      message: `Your ticket #${ticket.ticketNumber} has been submitted successfully.`,
      type: "success",
      category: "support",
      actionUrl: `/help?tab=tickets&ticketId=${ticket._id}`,
    });

    successResponse(res, {
      statusCode: 201,
      message: "Support ticket submitted successfully",
      payload: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        estimatedResponseTime: "24-48 hours",
      },
    });
  }
);

/**
 * @desc    Get all support tickets (Admin only)
 * @route   GET /api/support/tickets
 * @access  Private/Admin
 */
export const handleGetAllTickets = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status;
    const priority = req.query.priority;

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const totalTickets = await SupportTicket.countDocuments(filter);
    const tickets = await SupportTicket.find(filter)
      .populate("userId", "username email firstName lastName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    successResponse(res, {
      statusCode: 200,
      message: "Support tickets fetched successfully",
      payload: {
        tickets,
        pagination: {
          totalTickets,
          totalPages: Math.ceil(totalTickets / limit),
          currentPage: page,
        },
      },
    });
  }
);

/**
 * @desc    Get user's support tickets
 * @route   GET /api/support/my-tickets
 * @access  Private
 */
export const handleGetUserTickets = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tickets = await SupportTicket.find({ userId: req.user?._id }).sort({
      createdAt: -1,
    });

    successResponse(res, {
      statusCode: 200,
      message: "Your support tickets fetched successfully",
      payload: { tickets },
    });
  }
);

/**
 * @desc    Get ticket by ID
 * @route   GET /api/support/tickets/:id
 * @access  Private
 */
export const handleGetTicketById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("userId", "username email firstName lastName")
      .populate("comments.userId", "username email firstName lastName role");

    if (!ticket) {
      throw createError(404, "Support ticket not found");
    }

    // Check if user is admin or the owner of the ticket
    if (
      req.user?.role !== "admin" &&
      (ticket.userId as any)._id.toString() !== req.user?._id.toString()
    ) {
      throw createError(403, "You are not authorized to view this ticket");
    }

    successResponse(res, {
      statusCode: 200,
      message: "Support ticket fetched successfully",
      payload: { ticket },
    });
  }
);

/**
 * @desc    Update ticket status (Admin only)
 * @route   PATCH /api/support/tickets/:id/status
 * @access  Private/Admin
 */
export const handleUpdateTicketStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;

    if (!status) {
      throw createError(400, "Status is required");
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!ticket) {
      throw createError(404, "Support ticket not found");
    }

    // Create notification for user
    await Notification.create({
      userId: ticket.userId,
      title: "Ticket Status Updated",
      message: `Your ticket #${ticket.ticketNumber} status has been changed to ${status}.`,
      type: "info",
      category: "support",
      actionUrl: `/help?tab=tickets&ticketId=${ticket._id}`,
    });

    successResponse(res, {
      statusCode: 200,
      message: "Support ticket status updated successfully",
      payload: { ticket },
    });
  }
);

/**
 * @desc    Add comment to ticket
 * @route   POST /api/support/tickets/:id/comments
 * @access  Private
 */
export const handleAddTicketComment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { message } = req.body;

    if (!message) {
      throw createError(400, "Message is required");
    }

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      throw createError(404, "Support ticket not found");
    }

    // Check if user is admin or the owner of the ticket
    if (
      req.user?.role !== "admin" &&
      ticket.userId.toString() !== req.user?._id.toString()
    ) {
      throw createError(403, "You are not authorized to comment on this ticket");
    }

    const attachments: string[] = [];
    const files = req.files as Express.Multer.File[];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const result: any = await uploadToCloudinary(
            file.buffer,
            "support-tickets"
          );
          attachments.push(result.secure_url);
        } catch (error) {
          console.error("Cloudinary upload error:", error);
        }
      }
    }

    ticket.comments.push({
      userId: req.user?._id,
      message,
      attachments,
      createdAt: new Date(),
    });

    // If admin comments, set status to in-progress if it's open
    if (req.user?.role === "admin" && ticket.status === "open") {
      ticket.status = "in-progress";
    }

    await ticket.save();

    // Notify user if admin commented
    if (req.user?.role === "admin") {
      await Notification.create({
        userId: ticket.userId,
        title: "New Support Response",
        message: `An admin has replied to your ticket #${ticket.ticketNumber}.`,
        type: "info",
        category: "support",
        actionUrl: `/help?tab=tickets&ticketId=${ticket._id}`,
      });
    }

    successResponse(res, {
      statusCode: 201,
      message: "Comment added successfully",
      payload: { ticket },
    });
  }
);
