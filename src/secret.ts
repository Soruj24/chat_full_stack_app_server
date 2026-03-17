import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ser_managegments";
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || "development";
const API_KEY = process.env.API_KEY;
const CLOUD_NAME = process.env.CLOUD_NAME;

// Use JWT_ACCESS_SECRET to match your JWT utility expectations
const jwtAccessKey = process.env.JWT_ACCESS_SECRET || 'f6bd99da70ad4d9853347c184bde6d77f412405e468df02b810be908c7ab86d6e24057c6a58d420349904a799499fd64f2028fd2fa6eefb7b30928d56fedca3e';
const jwtRefreshKey = process.env.JWT_REFRESH_SECRET || 'b5e8ba5b97fff098e1667679b61200b60eb4bc4bccc5541e618f1b208e04b60720d24c02a574ce74aa501e8f1dc76ace4b7c2f486b80598c20020109269312fe';

const smtp_user = process.env.SMTP_USER || 'sorujmahmudb2h@gmail.com';
const smtp_pass = process.env.SMTP_PASS || 'vwcwgxzgcweqtoyl';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';

export {
    PORT,
    mongoUri,
    CLIENT_URL,
    NODE_ENV,
    jwtAccessKey,
    jwtRefreshKey,
    smtp_user,
    smtp_pass,
    clientUrl,
    API_KEY,
    CLOUD_NAME,
    STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET,
    GOOGLE_CLIENT_ID,
    GITHUB_CLIENT_ID,
    FACEBOOK_APP_ID
};