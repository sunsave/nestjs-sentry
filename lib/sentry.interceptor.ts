// Nestjs imports
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  ContextType,
  HttpArgumentsHost,
  RpcArgumentsHost,
  WsArgumentsHost,
} from '@nestjs/common/interfaces';
// Rxjs imports
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
// Sentry imports
import { Scope, addRequestDataToEvent } from '@sentry/node';

import { SentryInterceptorOptions, SentryInterceptorOptionsFilter } from './sentry.interfaces';
import { SentryService } from './sentry.service';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  protected readonly client: SentryService = SentryService.SentryServiceInstance();
  constructor(private readonly options?: SentryInterceptorOptions) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // first param would be for events, second is for errors
    return next.handle().pipe(
      tap(null, (exception: HttpException) => {
        if (this.shouldReport(exception)) {
          this.client.instance().withScope((scope) => {
            return this.captureException(context, scope, exception);
          });
        }
      }),
    );
  }

  protected captureException(context: ExecutionContext, scope: Scope, exception: HttpException) {
    switch (context.getType<ContextType>()) {
      case 'http':
        return this.captureHttpException(scope, context.switchToHttp(), exception);
      case 'rpc':
        return this.captureRpcException(scope, context.switchToRpc(), exception);
      case 'ws':
        return this.captureWsException(scope, context.switchToWs(), exception);
    }
  }

  private captureHttpException(
    scope: Scope,
    http: HttpArgumentsHost,
    exception: HttpException,
  ): void {
    const data = addRequestDataToEvent(<any>{}, http.getRequest(), this.options);

    scope.setExtra('req', data.request);

    if (data.extra) scope.setExtras(data.extra);
    if (data.user) scope.setUser(data.user);

    this.client.instance().captureException(exception);
  }

  private captureRpcException(scope: Scope, rpc: RpcArgumentsHost, exception: any): void {
    scope.setExtra('rpc_data', rpc.getData());

    this.client.instance().captureException(exception);
  }

  private captureWsException(scope: Scope, ws: WsArgumentsHost, exception: any): void {
    scope.setExtra('ws_client', ws.getClient());
    scope.setExtra('ws_data', ws.getData());

    this.client.instance().captureException(exception);
  }

  private shouldReport(exception: any) {
    if (this.options && !this.options.filters) return true;

    // If any filter passes, then we do not report
    if (this.options) {
      const opts: SentryInterceptorOptions = this.options as object;
      if (opts.filters) {
        const exclusionFilters: SentryInterceptorOptionsFilter[] = opts.filters;

        const hasApplicableExclusions = exclusionFilters.some(({ type, filter }) => {
          const isInstance = exception instanceof type;
          const hasFilter = filter !== undefined;
          return (isInstance && !hasFilter) || (isInstance && hasFilter && filter(exception));
        });

        return hasApplicableExclusions === false;
      }
    } else {
      return true;
    }
  }
}
