import { AppError } from "../domain/errors/AppError";
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      errorCode: err.code,
      message: err.message
    });
  }

 console.error(err);


  return res.status(500).json({
    errorCode: "INTERNAL_ERROR",
    message: "Unexpected server error"
  });
}