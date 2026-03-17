// models/constants/UserConstants.ts
export const USER_CONSTANTS = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 120,
    RESERVED: [
      'administrator', 'root', 'system', 'null', 'undefined',
      'api', 'www', 'support', 'help', 'contact', 'test', 'moderator',
      'guest', 'anonymous', 'user', 'users', 'settings', 'config'
    ]
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    SALT_ROUNDS: 12,
    RESET_TOKEN_EXPIRY: 10 * 60 * 1000, // 10 minutes
    CHANGED_THRESHOLD: 2 * 60 * 1000 // 2 minutes
  },
  LOCKOUT: {
    MAX_ATTEMPTS: 5,
    DURATION: 30 * 60 * 1000, // 30 minutes
    PROGRESSIVE_DELAYS: [1, 2, 5, 10, 30] // minutes
  },
  VERIFICATION: {
    EMAIL_TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    PHONE_TOKEN_EXPIRY: 5 * 60 * 1000, // 5 minutes
    MAX_RESEND_ATTEMPTS: 3
  },
  LIMITS: {
    MAX_LOGIN_HISTORY: 50,
    MAX_ADDRESSES: 5,
    MAX_BACKUP_CODES: 10,
    BIO_MAX_LENGTH: 500,
    NAME_MAX_LENGTH: 50
  }
} as const;