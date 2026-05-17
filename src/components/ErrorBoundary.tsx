import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
         return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-500 mb-6 shadow-sm border border-red-200 rotate-12">
            <AlertTriangle size={40} className="-rotate-12" />
          </div>
          <h1 className="text-2xl font-extrabold text-dm-midnight mb-2">Something went wrong</h1>
          <p className="text-dm-midnight/60 font-semibold mb-8 max-w-sm">
             We hit an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-4 bg-dm-midnight text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
          >
            <RefreshCcw size={20} />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
