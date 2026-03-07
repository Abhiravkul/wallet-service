import { AppError } from "./AppError";

export class SystemError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 500);
  }
}