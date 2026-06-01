import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = exceptionResponse['message'] || message;
        errorDetails = exceptionResponse;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Log the full stack for non-HTTP exceptions
      this.logger.error(`Unhandled Exception: ${message}`, exception.stack);
    } else {
      this.logger.error('Unknown Exception', exception);
    }

    // Always log non-2xx errors for auditing
    if (status >= 400) {
      const request = ctx.getRequest();
      this.logger.warn(`${request.method} ${request.url} - Status: ${status} - Message: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      ...(errorDetails && { details: errorDetails }),
    });
  }
}
