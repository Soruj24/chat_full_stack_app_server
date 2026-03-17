import { Response } from 'express';

interface ResponseOptions {
    statusCode?: number;
    message?: string;
    payload?: any;
}

const errorResponse = (
    res: Response,
    { statusCode = 500, message = "Internal Error" }: ResponseOptions
) => {
    return res.status(statusCode).json({
        success: false,
        message: message,
    });
};

const successResponse = (
    res: Response,
    { statusCode = 200, message = "Success", payload = {} }: ResponseOptions
) => {
    return res.status(statusCode).json({
        success: true,
        message: message,
        payload,
    });
};

const getDefaultError = (statusCode: number): string => {
    const errors: { [key: number]: string } = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        429: 'RATE_LIMIT_EXCEEDED',
        500: 'INTERNAL_SERVER_ERROR',
        503: 'SERVICE_UNAVAILABLE'
    };

    return errors[statusCode] || 'UNKNOWN_ERROR';
};

export { errorResponse, successResponse, getDefaultError };