import express, {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
// @ts-ignore
import xss from "xss-clean";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import createError, { HttpError } from "http-errors";
import { CLIENT_URL, NODE_ENV } from "./secret";
import authRouter from "./routes/authRouter";
import ipRouter from "./routes/ipRouter";
import chatRouter from "./routes/chatRouter";
import messageRouter from "./routes/messageRouter";
import userRouter from "./routes/userRouter";
import { errorResponse } from "./controllers/responsControllers";
import seedRouter from "./routes/seedRouter";
import billingRouter from "./routes/billingRouter";
import analyticsRouter from "./routes/analyticsRouter";
import supportRouter from "./routes/supportRouter";
import aiRouter from "./routes/aiRouter";
import fileRouter from "./routes/fileRouter";
import notificationRouter from "./routes/notificationRouter";

const app = express();

app.use(cookieParser());

const allowedOrigins = [
  CLIENT_URL || "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // In development, allow all localhost origins
      if (NODE_ENV !== "production" && origin.includes("localhost")) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        return (
          origin === allowedOrigin ||
          origin === allowedOrigin.replace(/\/$/, "")
        );
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS Blocked: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Allow-Request-Method",
      "Access-Control-Allow-Request-Headers",
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 204,
  }),
);

// --------------------- Trust Proxy (for production behind reverse proxy) ---------------------
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  express.json({
    limit: "10mb",
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// Data sanitization against NoSQL query injection
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.query) mongoSanitize.sanitize(req.query);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// Prevent HTTP Parameter Pollution
app.use(hpp());

// --------------------- Rate Limiting ---------------------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === "production" ? 100 : 1000,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === "/api/health";
  },
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: NODE_ENV === "production" ? 20 : 100,
  message: {
    error:
      "Too many authentication attempts from this IP, please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: NODE_ENV === "production" ? 5 : 20,
  message: {
    error:
      "Too many password reset requests from this IP, please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", forgotPasswordLimiter);

// --------------------- Health Check Route ---------------------
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: "1.0.0",
  });
});

// --------------------- API Routes ---------------------
// app.use("/api/user", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/upload", fileRouter);
app.use("/api/chats", chatRouter);
app.use("/api/messages", messageRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/ip", ipRouter);
app.use("/api/seed", seedRouter);
app.use("/api/billing", billingRouter);
app.use("/api/support", supportRouter);
app.use("/api/ai", aiRouter);
app.use("/api/files", fileRouter);
app.use("/api/notifications", notificationRouter);

// --------------------- Root Route ---------------------
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Server is running",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});


app.use((req: Request, res: Response, next: NextFunction) => {
  const error = createError(404, `Route ${req.originalUrl} not found`);
  next(error);
});

// ---------------------- Error handler ---------------------
const errorHandler: ErrorRequestHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (NODE_ENV !== "test") {
    console.error(`Error ${err.status || 500}: ${err.message}`);
    if (NODE_ENV === "development") {
      console.error(err.stack);
    }
  }

  const isDevelopment = NODE_ENV === "development";
  const statusCode = err.status || err.statusCode || 500;

  errorResponse(res, {
    statusCode,
    message:
      statusCode === 500 && !isDevelopment
        ? "Internal Server Error"
        : err.message,
    ...(isDevelopment && { stack: err.stack }),
  });
};

app.use(errorHandler);

export default app;
