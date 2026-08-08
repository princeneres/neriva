import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

// Guarantees the { data, meta } success envelope. Controllers that already
// return an envelope (lists with meta) pass through untouched; anything else
// is wrapped. 204/empty responses stay empty.
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value === undefined || value === null) {
          return value;
        }
        if (typeof value === 'object' && 'data' in value) {
          return value;
        }
        return { data: value };
      }),
    );
  }
}
