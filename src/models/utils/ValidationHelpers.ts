// models/utils/ValidationHelpers.ts
import validator from "validator";
import { USER_CONSTANTS } from "../constants/UserConstants";
import { isStrongPassword } from "./UserUtils";

export const ValidationHelpers = {
  isValidUsername: (username: string): boolean => {
    return username.length >= USER_CONSTANTS.USERNAME.MIN_LENGTH &&
      username.length <= USER_CONSTANTS.USERNAME.MAX_LENGTH &&
      /^[a-zA-Z0-9_.-]+$/.test(username) &&
      !USER_CONSTANTS.USERNAME.RESERVED.includes(username.toLowerCase() as any);
  },

  isStrongPassword: (password: string): boolean => {
    return isStrongPassword(password);
  },

  sanitizeUserInput: (input: string): string => {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  },

  validateProfileData: (profileData: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (profileData.firstName && profileData.firstName.length > USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH) {
      errors.push(`First name cannot exceed ${USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH} characters`);
    }

    if (profileData.lastName && profileData.lastName.length > USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH) {
      errors.push(`Last name cannot exceed ${USER_CONSTANTS.LIMITS.NAME_MAX_LENGTH} characters`);
    }

    if (profileData.bio && profileData.bio.length > USER_CONSTANTS.LIMITS.BIO_MAX_LENGTH) {
      errors.push(`Bio cannot exceed ${USER_CONSTANTS.LIMITS.BIO_MAX_LENGTH} characters`);
    }

    if (profileData.website && !validator.isURL(profileData.website)) {
      errors.push('Website must be a valid URL');
    }

    if (profileData.phone && !validator.isMobilePhone(profileData.phone, 'any', { strictMode: false })) {
      errors.push('Phone number is not valid');
    }

    if (profileData.dateOfBirth) {
      const dob = new Date(profileData.dateOfBirth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 13 || age > 120) {
        errors.push('You must be at least 13 years old and not older than 120 years');
      }
    }

    return { isValid: errors.length === 0, errors };
  },

  validateEmail: (email: string): boolean => {
    return validator.isEmail(email);
  },

  validatePhone: (phone: string): boolean => {
    return validator.isMobilePhone(phone, 'any', { strictMode: false });
  },

  validateTimezone: (timezone: string): boolean => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },

  validateSocialLinks: (socialLinks: Record<string, string>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const validPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'github', 'youtube', 'website'];

    if (socialLinks) {
      Object.entries(socialLinks).forEach(([platform, url]) => {
        if (!validPlatforms.includes(platform.toLowerCase())) {
          errors.push(`Invalid social platform: ${platform}`);
        }
        if (!validator.isURL(url)) {
          errors.push(`Invalid URL for ${platform}: ${url}`);
        }
      });
    }

    return { isValid: errors.length === 0, errors };
  }
};