# Modern User Management System (MERN Stack)

A robust and modern User Management System built with the MERN stack (MongoDB, Express, React, Node.js). It features Role-Based Access Control (RBAC), real-time analytics, and multi-language support.

## 🚀 Key Features

- **Role-Based Access Control (RBAC):** Separate dashboards and access controls for Admins and Regular Users.
- **Real-time Dashboard:** A beautiful, responsive dashboard displaying user analytics and system status.
- **Report Generation:** Export user and revenue data directly in CSV or JSON formats.
- **Internationalization (i18n):** Support for both English and Bengali languages.
- **Security:** JWT authentication, password hashing, and secure API endpoints.
- **AI Assistant:** Integrated AI assistant for chatting directly within the dashboard.
- **Modern UI:** Modern design built with Tailwind CSS, Framer Motion, and Shadcn UI.

## 🛠 Technology Stack

### Frontend
- React 19 (TypeScript)
- Redux Toolkit & RTK Query
- Tailwind CSS & Shadcn UI
- Framer Motion (Animations)
- i18next (Multi-language)

### Backend
- Node.js & Express
- MongoDB & Mongoose
- Socket.io (Real-time communication)
- Stripe (Billing/Subscription)
- Cloudinary (File Management)

## 📦 Installation Guide

1. Clone the repository:
```bash
git clone <repository-url>
```

2. Backend Setup:
```bash
cd server
npm install
# Create .env based on .env.example
npm start
```

3. Frontend Setup:
```bash
cd client
npm install
# Create .env based on .env.example
npm run dev
```

## 🔑 Environment Variables (.env)

Essential variables for the backend:
- `MONGODB_URI`: Your MongoDB connection string.
- `JWT_SECRET`: Secure JWT token key.
- `CLOUDINARY_URL`: For image storage.
- `SMTP_USER` & `SMTP_PASS`: For sending emails.

## 📄 License
This project is under the ISC License.

---
Created by [Your Name/Team]
