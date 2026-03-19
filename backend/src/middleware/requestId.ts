import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export const requestIdMiddleware = (req : Request, res: Response, next: NextFunction) => {
  const incomingId = req.header("x-request-id");

  const requestId = incomingId || randomUUID();

  req.requestId = requestId;

  res.setHeader("x-request-id", requestId);

  next();
};