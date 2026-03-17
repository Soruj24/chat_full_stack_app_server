import { Server } from "socket.io";
import { userManager } from "./utils/userManager";

export function registerSocketHandlers(io: Server) {
  const users = new Map<string, string>();
  io.on("connection", (socket) => {
    socket.on("join", (userId: string) => {
      socket.join(userId);
      users.set(userId, socket.id);
    });
    socket.on("call_user", ({ userToCall, signalData, from, type }) => {
      socket.to(userToCall).emit("incoming_call", {
        signal: signalData,
        from,
        type,
      });
    });
    socket.on("answer_call", ({ signal, to }) => {
      socket.to(to).emit("call_accepted", signal);
    });
    socket.on("end_call", ({ to }) => {
      socket.to(to).emit("call_ended");
    });
    socket.on("send_message", ({ chatId, message, receiverId }) => {
      socket.to(chatId).emit("receive_message", message);
      if (receiverId) {
        io.to(receiverId).emit("new_message_notification", { chatId, message });
      } else {
        socket.to(chatId).emit("new_message_notification", { chatId, message });
      }
    });
    socket.on("join_chat", (chatId: string) => {
      socket.join(chatId);
      let userId: string | undefined;
      for (const [id, sid] of users.entries()) {
        if (sid === socket.id) {
          userId = id;
          break;
        }
      }
      if (userId) {
        socket.to(chatId).emit("user_status_update", { userId, status: "online" });
      }
    });
    socket.on("typing", ({ chatId, userId, isTyping }) => {
      socket.to(chatId).emit("user_typing", { chatId, userId, isTyping });
    });
    socket.on("message_reaction", ({ chatId, messageId, reactions, userId }) => {
      socket.to(chatId).emit("message_reaction", { messageId, reactions, userId });
    });
    socket.on("message_pin", ({ chatId, messageId, isPinned }) => {
      socket.to(chatId).emit("message_pin", { messageId, isPinned });
    });
    socket.on("message_delete", ({ chatId, messageId }) => {
      socket.to(chatId).emit("message_delete", { chatId, messageId });
    });
    socket.on("new_chat", ({ chat, participants }) => {
      if (participants && Array.isArray(participants)) {
        participants.forEach((userId: string) => {
          io.to(userId).emit("new_chat_created", chat);
        });
      }
    });
    socket.on("leave_chat", (chatId: string) => {
      socket.leave(chatId);
    });
    socket.on("disconnect", (reason) => {
      const userData = userManager.get(socket.id);
      if (userData) {
        userManager.delete(socket.id);
        const onlineUsers = userManager.getAllUsernames();
        io.emit("users-update", {
          users: onlineUsers,
          onlineUsers: onlineUsers,
        });
      }
    });
  });
}

