"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, eventId: null };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const eventId = Sentry.captureException(error);
    this.setState({ eventId });
  }

  private handleReset = () => {
    this.setState({ hasError: false, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm">
            Trang này gặp sự cố không mong muốn. Vui lòng thử tải lại.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-medium text-green-700 border border-green-600 rounded-md hover:bg-green-50 transition-colors"
            >
              Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              Tải lại trang
            </button>
          </div>
          {this.state.eventId && (
            <p className="mt-4 text-xs text-gray-400">Mã lỗi: {this.state.eventId}</p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
