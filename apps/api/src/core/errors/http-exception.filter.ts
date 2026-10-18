import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

/** The error body every client can rely on (docs/README_ARCHITECTURE.md, "Error contract"). */
export type ErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  issues?: { path: string; code: string; message: string }[];
};

const CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_FAILED",
  429: "TOO_MANY_REQUESTS",
  503: "SERVICE_UNAVAILABLE",
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const detail = typeof payload === "object" && payload !== null ? payload : {};
      const body: ErrorBody = {
        statusCode,
        code: (detail as { code?: string }).code ?? CODES[statusCode] ?? "ERROR",
        message: exception.message,
        ...((detail as { issues?: ErrorBody["issues"] }).issues
          ? { issues: (detail as { issues: ErrorBody["issues"] }).issues }
          : {}),
      };
      response.status(statusCode).json(body);
      return;
    }

    // Unknown errors never leak details to the client.
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : exception,
    );
    const body: ErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
