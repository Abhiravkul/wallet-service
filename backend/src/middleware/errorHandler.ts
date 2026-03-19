import { AppError } from "../domain/errors/AppError";
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from "../utils/logger";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {

  const isAppError = err instanceof AppError;

  const errorCode = isAppError ? err.code : "INTERNAL_ERROR";
  const errorMessage = isAppError ? err.message : "Unexpected server error";

  if (isAppError) {
    logger.warn({
      event: errorCode,
      requestId: req.requestId,
      error: errorMessage,
      stack: err.stack
    });
    return res.status(err.statusCode).json({
      requestId: req.requestId,
      errorCode: errorCode,
      message: errorMessage
    });
  }

  logger.warn({
    event: errorCode,
    requestId: req.requestId,
    error: errorMessage
  });

  return res.status(500).json({
    errorCode: errorCode,
    message: errorMessage
  });
}