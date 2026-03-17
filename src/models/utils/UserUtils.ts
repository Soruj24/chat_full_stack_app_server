// models/utils/UserUtils.ts
import crypto from "crypto";
import validator from "validator";
import { USER_CONSTANTS } from "../constants/UserConstants";

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const isStrongPassword = (password: string): boolean => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
};

export const sanitizeUserAgent = (userAgent: string): string => {
  return userAgent.substring(0, 255);
};

export const getDeviceInfo = (userAgent: string): string => {
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    return 'Mobile';
  } else if (/Tablet/.test(userAgent)) {
    return 'Tablet';
  }
  return 'Desktop';
};

export const validateTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const calculateAge = (dateOfBirth: Date): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

export const getPasswordStrengthScore = (password: string): { score: number; feedback: string[] } => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score += 20;
  else feedback.push('Password should be at least 8 characters long');

  if (password.length >= 12) score += 10;
  else feedback.push('Consider using 12+ characters for better security');

  if (/[a-z]/.test(password)) score += 15;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 15;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 15;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 25;
  else feedback.push('Include special characters');

  return { score, feedback };
};