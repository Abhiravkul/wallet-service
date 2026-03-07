import { AppError } from "./AppError";

export class ValidationError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 400);
  }
}