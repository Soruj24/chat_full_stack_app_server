import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { jwtAccessKey } from "../secret";
import { createJSONWebToken, verifyJSONWebToken } from "../helper/jsonwebtoken";
import User from "../models/schemas/User";
import { UserRole, Permission } from "../models/interfaces/IUser";
import Subscription from "../models/Subscription";

// Extend Request type to include user data
export interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        email: string;
        role: UserRole;
        permissions: Permission[];
        isAdmin: boolean;
    };
}

// Cookie configuration
const cookieConfig = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: process.env.COOKIE_DOMAIN || undefined
};

const extractToken = (req: Request): string | null => {
    try {
        // 1. Check cookies first (since you're using cookie-based auth)
        if (req?.cookies?.accessToken) {
            const token = req.cookies.accessToken;
            if (token && token.trim() !== '') {
                return token;
            }
        }

        // 2. Fallback to Authorization header (for flexibility)
        if (req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                return token ? token : null;
            }
            return authHeader;
        }

        return null;
    } catch (error) {
        return null;
    }
};

// Helper function to set auth cookie
export const setAuthCookie = (res: Response, token: string): void => {
    res.cookie('accessToken', token, cookieConfig);
};

// Helper function to clear auth cookie
export const clearAuthCookie = (res: Response): void => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: process.env.COOKIE_DOMAIN || undefined
    });
};

export const isLoggedIn = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {

        const token = extractToken(req);

        if (!token) {
            if (req?.cookies?.accessToken) {
                clearAuthCookie(res);
            }
            throw createHttpError(401, "Please login first");
        }

        if (!jwtAccessKey) {
            throw createHttpError(500, "JWT secret key is not configured");
        }
 
        const decoded = verifyJSONWebToken(token, jwtAccessKey);
        
        const userId = decoded.id || decoded.userId;
        if (!userId) {
            clearAuthCookie(res);  
            throw createHttpError(401, "Invalid user identifier in token");
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            clearAuthCookie(res);  
            throw createHttpError(404, "User not found");
        }

        req.user = {
            _id: user.id.toString(),
            email: user.email || '',
            role: user.role as UserRole,
            permissions: user.permissions || [],
            isAdmin: user.isAdmin || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN
        };
 
        next();
    } catch (error) {
        if (error instanceof createHttpError.HttpError && error.statusCode === 401) {
            clearAuthCookie(res);
        }
        next(error);
    }
};

export const isLoggedOut = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const token = extractToken(req);

        if (!token) {
            return next();  
        }

        if (!jwtAccessKey) {
            return next(); 
        }

        try {
            verifyJSONWebToken(token, jwtAccessKey);
            return next(createHttpError(400, "User is already logged in"));
        } catch (error) {
            clearAuthCookie(res);

            if (error instanceof createHttpError.HttpError && error.statusCode === 400) {
                throw error;
            }
            next();
        }
    } catch (error) {
        next(error);
    }
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
        if (!req.user) {
            throw createHttpError(401, "User not authenticated");
        }

        if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
            throw createHttpError(403, "Access denied: Administrator privileges required");
        }

        next();
    } catch (error) {
        next(error);
    }
};

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = extractToken(req);

        if (!token) {
            throw createHttpError(401, "Unauthorized access, please login first");
        }

        if (!jwtAccessKey) {
            throw createHttpError(500, "JWT secret key is not configured");
        }

        const decoded = verifyJSONWebToken(token, jwtAccessKey);

        const userId = decoded.id || decoded.userId;
        if (!userId) {
            clearAuthCookie(res);
            throw createHttpError(401, "Invalid authorization token");
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            clearAuthCookie(res);
            throw createHttpError(404, "User not found or has been deleted");
        }

        req.user = {
            _id: user.id.toString(),
            email: user.email || '',
            role: user.role as UserRole,
            permissions: user.permissions || [],
            isAdmin: user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN
        };

        next();
    } catch (error) {
        if (error instanceof createHttpError.HttpError && error.statusCode === 401) {
            clearAuthCookie(res);
        }
        next(error);
    }
};

// Add automatic token refresh middleware
export const refreshTokenIfNeeded = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = extractToken(req);

        if (!token || !jwtAccessKey) {
            return next();
        }

        try {
            const decoded = verifyJSONWebToken(token, jwtAccessKey);
            const now = Math.floor(Date.now() / 1000);
            const tokenExp = decoded.exp;

            // Refresh token if it expires in less than 30 minutes
            if (tokenExp && (tokenExp - now) < 1800) {
                const newToken = createJSONWebToken({ id: decoded.id || decoded.userId }, jwtAccessKey, '7d');
                setAuthCookie(res, newToken);
            }
        } catch (error) {
            next(error)
        }

        next();
    } catch (error) {
        next(error);
    }
};

export const hasActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?._id;
    
    if (!userId) {
      return next(createHttpError(401, "Authentication required"));
    }

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "trialing"] },
      currentPeriodEnd: { $gt: new Date() },
    });

    if (!subscription) {
      return next(createHttpError(403, "Active subscription required"));
    }

    (req as any).subscription = subscription;
    next();
  } catch (error) {
    next(createHttpError(500, "Failed to check subscription status"));
  }
};

// Middleware to check if user has specific plan
export const hasPlan = (requiredPlanId: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?._id;
      
      if (!userId) {
        return next(createHttpError(401, "Authentication required"));
      }

      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
        currentPeriodEnd: { $gt: new Date() },
      }).populate("planId");

      if (!subscription) {
        return next(createHttpError(403, "Active subscription required"));
      }

      if (subscription.planId?.toString() !== requiredPlanId) {
        return next(createHttpError(403, `Plan ${requiredPlanId} required`));
      }

      (req as any).subscription = subscription;
      next();
    } catch (error) {
      next(createHttpError(500, "Failed to check plan access"));
    }
  };
};

// Middleware to check subscription feature access
export const hasFeature = (feature: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?._id;
      
      if (!userId) {
        return next(createHttpError(401, "Authentication required"));
      }

      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
        currentPeriodEnd: { $gt: new Date() },
      }).populate("planId");

      if (!subscription) {
        return next(createHttpError(403, "Active subscription required"));
      }

      // Check if plan has the feature
      // You'll need to define your feature checking logic here
      // This is just an example
      const planFeatures = (subscription.planId as any)?.features || [];
      
      if (!planFeatures.includes(feature)) {
        return next(createHttpError(403, `Feature "${feature}" not available in your plan`));
      }

      (req as any).subscription = subscription;
      next();
    } catch (error) {
      next(createHttpError(500, "Failed to check feature access"));
    }
  };
};

// Middleware to check storage limits
export const checkStorageLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?._id;
    const fileSize = parseInt(req.headers["content-length"] || "0", 10);
    
    if (!userId || fileSize === 0) {
      return next();
    }

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "trialing"] },
    }).populate("planId");

    if (!subscription) {
      return next(createHttpError(403, "Active subscription required"));
    }

    const storageLimit = (subscription.planId as any)?.storageLimit || 0;
    // You need to implement storage usage calculation based on your system
    const currentUsage = 0; // Get current storage usage for user
    
    if (currentUsage + fileSize > storageLimit) {
      return next(createHttpError(403, "Storage limit exceeded"));
    }

    (req as any).subscription = subscription;
    next();
  } catch (error) {
    next(createHttpError(500, "Failed to check storage limit"));
  }
};

// Middleware to check API rate limits based on plan
export const planBasedRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?._id;
    
    if (!userId) {
      return next();
    }

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "trialing"] },
    }).populate("planId");

    if (!subscription) {
      return next();
    }

    const planId = (subscription.planId as any)?.id;
    const apiCallLimit = (subscription.planId as any)?.apiCallLimit || 1000;
    
    // Implement plan-specific rate limiting logic here
    // This would integrate with your rate limiter (redis, etc.)
    
    (req as any).subscription = subscription;
    next();
  } catch (error) {
    next(createHttpError(500, "Failed to apply rate limits"));
  }
};

/**
 * Advanced Role-Based Access Control (RBAC) middleware
 * Allows access if the user has any of the required roles.
 * 
 * @param allowedRoles - Array of roles that are permitted to access the route
 */
export const authorize = (allowedRoles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw createHttpError(401, "User not authenticated");
            }

            if (!allowedRoles.includes(req.user.role)) {
                throw createHttpError(403, `Access denied: ${req.user.role} role does not have permission to access this resource`);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Permission-based access control middleware
 * Allows access if the user has the required permission OR is a SUPER_ADMIN.
 * 
 * @param requiredPermission - The permission string required to access the route
 */
export const hasPermission = (requiredPermission: Permission) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw createHttpError(401, "User not authenticated");
            }

            // Super Admin always has all permissions
            if (req.user.role === UserRole.SUPER_ADMIN) {
                return next();
            }

            if (!req.user.permissions.includes(requiredPermission)) {
                throw createHttpError(403, `Access denied: missing required permission "${requiredPermission}"`);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Multiple Permissions check middleware
 * Allows access if the user has ALL of the required permissions OR is a SUPER_ADMIN.
 * 
 * @param requiredPermissions - Array of permission strings
 */
export const hasAllPermissions = (requiredPermissions: Permission[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw createHttpError(401, "User not authenticated");
            }

            // Super Admin always has all permissions
            if (req.user.role === UserRole.SUPER_ADMIN) {
                return next();
            }

            const hasAll = requiredPermissions.every(perm => req.user?.permissions.includes(perm));
            
            if (!hasAll) {
                throw createHttpError(403, "Access denied: missing one or more required permissions");
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

