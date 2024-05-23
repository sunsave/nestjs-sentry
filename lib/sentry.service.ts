import { Inject, Injectable, ConsoleLogger, Optional } from '@nestjs/common';
import { OnApplicationShutdown } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { SENTRY_MODULE_OPTIONS } from './sentry.constants';
import { SentryModuleOptions } from './sentry.interfaces';

@Injectable()
export class SentryService extends ConsoleLogger implements OnApplicationShutdown {
  app = '@sunsave/nestjs-sentry: ';
  private static serviceInstance: SentryService;
  constructor(@Optional() @Inject(SENTRY_MODULE_OPTIONS) readonly opts?: SentryModuleOptions) {
    super();
    if (!(opts && opts.dsn)) {
      // console.log('options not found. Did you use SentryModule.forRoot?');
      return;
    }
    const { integrations = [], ...sentryOptions } = opts;
    Sentry.init({
      ...sentryOptions,
      integrations: [
        Sentry.onUncaughtExceptionIntegration({
          onFatalError: async (err) => {
            if (err.name === 'SentryError') {
              console.log(err);
            } else {
              Sentry.getClient()?.captureException(err);
              process.exit(1);
            }
          },
        }),
        Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
        ...integrations,
      ],
    });
  }

  public static SentryServiceInstance(): SentryService {
    if (!SentryService.serviceInstance) {
      SentryService.serviceInstance = new SentryService();
    }
    return SentryService.serviceInstance;
  }

  log(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.log(message, context);
      asBreadcrumb
        ? Sentry.addBreadcrumb({
            message,
            level: 'log',
            data: {
              context,
            },
          })
        : Sentry.captureMessage(message, 'log');
    } catch (_err) {
      /* empty */
    }
  }

  error(message: string, trace?: string, context?: string) {
    message = `${this.app} ${message}`;
    try {
      super.error(message, trace, context);
      Sentry.captureMessage(message, 'error');
    } catch (_err) {
      /* empty */
    }
  }

  warn(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.warn(message, context);
      asBreadcrumb
        ? Sentry.addBreadcrumb({
            message,
            level: 'warning',
            data: {
              context,
            },
          })
        : Sentry.captureMessage(message, 'warning');
    } catch (_err) {
      /* empty */
    }
  }

  debug(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.debug(message, context);
      asBreadcrumb
        ? Sentry.addBreadcrumb({
            message,
            level: 'debug',
            data: {
              context,
            },
          })
        : Sentry.captureMessage(message, 'debug');
    } catch (_err) {
      /* empty */
    }
  }

  verbose(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.verbose(message, context);
      asBreadcrumb
        ? Sentry.addBreadcrumb({
            message,
            level: 'info',
            data: {
              context,
            },
          })
        : Sentry.captureMessage(message, 'info');
    } catch (_err) {
      /* empty */
    }
  }

  instance() {
    return Sentry;
  }

  async onApplicationShutdown(_signal?: string) {
    if (this.opts?.close?.enabled === true) {
      await Sentry.close(this.opts?.close.timeout);
    }
  }
}
