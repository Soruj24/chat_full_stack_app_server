import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import createHttpError from "http-errors";

interface CustomJWTPayload extends JwtPayload {
    id: string;
    email: string;
    role?: string;
    userId?: string; // Add userId for backward compatibility
}

export const createJSONWebToken = (
    payload: Record<string, unknown>,
    secretKey: string,
    expiresIn: string | number
): string => {
    if (typeof payload !== "object" || !payload) {
        throw createHttpError(400, "Payload must be an object");
    }

    if (typeof secretKey !== "string" || secretKey.trim() === "") {
        throw createHttpError(400, "SecretKey must be a non-empty string");
    }

    try {
        const token = jwt.sign(payload, secretKey, {
            expiresIn,
            algorithm: 'HS256'
        } as SignOptions);
        return token;
    } catch (error) {
        throw createHttpError(500, "Failed to create token");
    }
};

export const verifyJSONWebToken = (
    token: string,
    jwtAccessKey: string
): CustomJWTPayload => {
    if (!token) {
        throw createHttpError(401, "Token is required");
    }

    const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

    if (!cleanToken) {
        throw createHttpError(401, "Invalid token format");
    }


    try {
        const decoded = jwt.verify(cleanToken, jwtAccessKey) as any;


        // Handle both "id" and "userId" for backward compatibility
        if (!decoded.id && !decoded.userId) {
            throw createHttpError(401, "Invalid token payload: missing user identifier");
        }

        // Normalize the payload to always use "id"
        const normalizedPayload: CustomJWTPayload = {
            ...decoded,
            id: decoded.id || decoded.userId, // Use id if present, otherwise fallback to userId
            email: decoded.email || '',
            role: decoded.role || 'user'
        };

        return normalizedPayload;

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw createHttpError(401, "Token has expired");
        }
        if (error instanceof jwt.JsonWebTokenError) {
            if (error.message === "invalid signature") {
                throw createHttpError(401, "Token validation failed - please login again");
            }
            throw createHttpError(401, "Invalid token");
        }
        throw createHttpError(401, "Token verification failed");
    }
};

export const extractToken = (authHeader: string | undefined): string => {
    if (!authHeader) {
        throw createHttpError(401, "Authorization header is missing");
    }

    if (!authHeader.startsWith('Bearer ')) {
        throw createHttpError(401, "Invalid token format. Use 'Bearer <token>'");
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        throw createHttpError(401, "Token is missing");
    }

    return token;
};

export const refreshToken = (
    oldToken: string,
    secretKey: string,
    expiresIn: string | number
): string => {
    if (!oldToken || !secretKey) {
        throw createHttpError(400, "Token and secret key are required");
    }

    try {
        const decoded = verifyJSONWebToken(oldToken, secretKey);
        const { iat, exp, ...payload } = decoded;
        return createJSONWebToken(payload, secretKey, expiresIn);
    } catch (error) {
        if (error instanceof createHttpError.HttpError) {
            throw error;
        }
        throw createHttpError(401, "Invalid refresh token");
    }
};