import { io } from "../index";
import Notification, { INotification } from "../models/Notification";
import mongoose from "mongoose";

class NotificationService {
  /**
   * Create and send a notification to a specific user
   */
  async sendToUser(userId: string | mongoose.Types.ObjectId, data: Partial<INotification>) {
    try {
      const notification = await Notification.create({
        userId,
        ...data,
        sentAt: new Date(),
      });

      // Emit via socket
      // We assume user is joined to a room named after their userId
      io.to(userId.toString()).emit("notification", notification);
      
      return notification;
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  }

  /**
   * Send a notification to all connected users
   */
  async broadcast(data: Partial<INotification>) {
    try {
      // This is trickier because we need to create a notification record for EVERY user if we want it to be persistent
      // For now, let's just emit to everyone
      io.emit("notification:broadcast", data);
    } catch (error) {
      console.error("Error broadcasting notification:", error);
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string) {
    return await Notification.find({ userId }).sort({ sentAt: -1 }).limit(50);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    return await Notification.findByIdAndUpdate(
      notificationId,
      { read: true, readAt: new Date() },
      { new: true }
    );
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    return await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );
  }
}

export const notificationService = new NotificationService();
