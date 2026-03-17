 
import { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncHandler<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler =
  <
    P = any,
    ResBody = any,
    ReqBody = any,
    ReqQuery = any
  >(fn: AsyncHandler<P, ResBody, ReqBody, ReqQuery>): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
    (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
