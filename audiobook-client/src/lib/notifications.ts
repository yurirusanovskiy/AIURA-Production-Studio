import { ApiError } from './api';

export type NotificationSeverity = 'error' | 'warning' | 'info' | 'success';

export interface NotificationEvent {
  message: string;
  severity: NotificationSeverity;
  duration?: number;
  status?: number;
}

type Listener = (event: NotificationEvent) => void;
const listeners = new Set<Listener>();

export const notificationService = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  show(
    message: string,
    severity: NotificationSeverity = 'info',
    duration = 6000,
    status?: number,
  ) {
    listeners.forEach((listener) =>
      listener({ message, severity, duration, status }),
    );
  },

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  },

  error(error: any, duration?: number) {
    let message = 'An unexpected error occurred.';
    let status: number | undefined;
    let severity: NotificationSeverity = 'error';

    if (error instanceof ApiError) {
      status = error.status;
      if (status === 429) {
        message = error.message || 'API rate limit exceeded. Please wait.';
        severity = 'warning'; // Warnings are less visually jarring for API rate limit waits
      } else if (status === 503) {
        message = 'Service temporarily unavailable. Please try again shortly.';
      } else {
        message = error.message;
      }
    } else if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = error.message || JSON.stringify(error);
    }

    this.show(message, severity, duration, status);
  },

  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  },

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  },
};
