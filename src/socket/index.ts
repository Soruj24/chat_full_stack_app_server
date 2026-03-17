import { Server } from "socket.io";
import {  userManager } from "./utils/userManager";


export const initSocket = (io: Server) => {

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`🔗 New connection: ${socket.id}`);

    // Initialize all handlers
    // initAuthHandlers(io, socket);

    // Join room for user-specific notifications
    socket.on('join', (userId: string) => {
      if (userId) {
        socket.join(userId);
        console.log(`👤 User ${userId} joined their notification room`);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Connection closed: ${socket.id}`, reason);

      const userData = userManager.get(socket.id);
      if (userData) {
        userManager.delete(socket.id);
        console.log(`📝 Removed ${userData.username} from connected users`);

        // Update online users list
        const onlineUsers = userManager.getAllUsernames();
        io.emit('users-update', {
          users: onlineUsers,
          onlineUsers: onlineUsers
        });
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });
};