import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { validationResult } from "express-validator";

export const runValidation = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const errors = validationResult(req);

        // If there are validation errors, dynamically create the error message
        if (!errors.isEmpty()) {
            const errorMessage = errors.array().map(error => {
                return `${error.msg}`;
            }).join(", ");
            return next(createError(400, errorMessage, { errors: errors.array() }));
        }

        // Proceed to the next middleware if no validation errors
        next();
    } catch (error) {
        next(error);
    }
};