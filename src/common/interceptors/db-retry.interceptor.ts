import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, mergeMap, retryWhen } from 'rxjs/operators';

const RETRYABLE_MESSAGES = [
  'Connection terminated unexpectedly',
  'terminating connection due to administrator command',
  'Connection terminated',
  'connect ECONNREFUSED',
  'the database system is starting up',
  'SSL connection has been closed unexpectedly',
];

function isRetryableDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return RETRYABLE_MESSAGES.some((msg) => err.message.includes(msg));
}

/**
 * Retries database operations that fail due to transient connection drops
 * (common with Supabase PgBouncer which recycles connections aggressively).
 */
@Injectable()
export class DbRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DbRetryInterceptor.name);
  private readonly maxRetries = 3;
  private readonly delayMs = 500;

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      retryWhen((errors) =>
        errors.pipe(
          mergeMap((err, attempt) => {
            if (attempt >= this.maxRetries || !isRetryableDbError(err)) {
              return throwError(() => err);
            }
            this.logger.warn(
              `Transient DB error on attempt ${attempt + 1}/${this.maxRetries}: ${err.message} — retrying in ${this.delayMs}ms`,
            );
            return timer(this.delayMs);
          }),
        ),
      ),
      catchError((err) => {
        if (isRetryableDbError(err)) {
          this.logger.error(`DB unavailable after ${this.maxRetries} retries: ${err.message}`);
          return throwError(
            () =>
              new ServiceUnavailableException(
                'Database connection is temporarily unavailable. Please try again in a moment.',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
