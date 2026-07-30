export class ParasutError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
  }
}

export class ParasutAuthError extends ParasutError {}
export class ParasutRateLimitError extends ParasutError {}
export class ParasutValidationError extends ParasutError {}
export class ParasutJobError extends ParasutError {}
/** A concurrent request for the same idempotency key is already in flight (not a replay, not a validation failure). */
export class ParasutInProgressError extends ParasutError {
  constructor(message = "A request for this operation is already in progress", details?: unknown) {
    super(message, 409, details);
  }
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
