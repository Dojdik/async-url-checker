import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {

    logger = new Logger(LoggingInterceptor.name)

    intercept(context: ExecutionContext, next: CallHandler): Observable<Response> {
        const ctx = context.switchToHttp()
        const req = ctx.getRequest()
        const url = req.url || "unknown"
        const status = ctx.getResponse().statusCode
        const now = Date.now();
        return next.handle().pipe(
            tap(() => {
                const latency = Date.now() - now
                this.logger.debug(`method:${req.url} url:${url} status:${status} ${latency}ms`)
            }),
        );
    }
}