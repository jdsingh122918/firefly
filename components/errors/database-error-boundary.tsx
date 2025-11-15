"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { isDatabaseError, classifyDatabaseError, getDatabaseErrorMessage } from "@/lib/db/database-health";
import { DatabaseUnavailable } from "./database-unavailable";

interface DatabaseErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  isDatabaseError: boolean;
  errorType?: 'CONNECTION' | 'TIMEOUT' | 'AUTH' | 'UNKNOWN';
  retryCount: number;
}

interface DatabaseErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  maxRetries?: number;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onDatabaseError?: (error: Error) => void;
  showRetry?: boolean;
}

/**
 * Error Boundary that gracefully handles database connectivity errors
 */
export class DatabaseErrorBoundary extends Component<
  DatabaseErrorBoundaryProps,
  DatabaseErrorBoundaryState
> {
  private retryTimeoutId?: NodeJS.Timeout;

  constructor(props: DatabaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isDatabaseError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DatabaseErrorBoundaryState> {
    const isDatabaseErr = isDatabaseError(error);

    return {
      hasError: true,
      error,
      isDatabaseError: isDatabaseErr,
      errorType: isDatabaseErr ? classifyDatabaseError(error) : undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DatabaseErrorBoundary caught an error:', error, errorInfo);

    // Call error callbacks
    this.props.onError?.(error, errorInfo);

    if (this.state.isDatabaseError) {
      this.props.onDatabaseError?.(error);
    }

    // Log to external error service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add error reporting service (e.g., Sentry)
      console.error('Production error:', { error, errorInfo });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached. Not retrying.`);
      return;
    }

    console.log(`Retrying... (attempt ${retryCount + 1}/${maxRetries})`);

    // Clear the error state to retry rendering
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      isDatabaseError: false,
      errorType: undefined,
      retryCount: prevState.retryCount + 1,
    }));
  };

  handleAutoRetry = (delayMs: number = 30000) => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delayMs);
  };

  render() {
    const { children, fallback, showRetry = true } = this.props;
    const { hasError, error, isDatabaseError: isDatabaseErr, errorType, retryCount } = this.state;

    if (!hasError) {
      return children;
    }

    // Show database-specific error page for database errors
    if (isDatabaseErr && error) {
      const retryAfter = errorType === 'CONNECTION' ? 30 :
                        errorType === 'TIMEOUT' ? 15 :
                        errorType === 'AUTH' ? 300 : 60;

      return (
        <DatabaseUnavailable
          error={error.message}
          errorType={errorType}
          retryAfter={retryAfter}
          showRetry={showRetry && retryCount < (this.props.maxRetries ?? 3)}
          onRetry={this.handleRetry}
        />
      );
    }

    // Show custom fallback for non-database errors
    if (fallback) {
      return fallback;
    }

    // Default error fallback
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-gray-600">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          {showRetry && retryCount < (this.props.maxRetries ?? 3) && (
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          )}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm font-medium">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto rounded border">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Hook-based wrapper for functional components
 */
interface DatabaseErrorWrapperProps extends DatabaseErrorBoundaryProps {
  children: ReactNode;
}

export function DatabaseErrorWrapper({ children, ...props }: DatabaseErrorWrapperProps) {
  return (
    <DatabaseErrorBoundary {...props}>
      {children}
    </DatabaseErrorBoundary>
  );
}