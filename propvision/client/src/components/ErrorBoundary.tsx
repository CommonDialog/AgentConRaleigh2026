import { Component, ReactNode } from "react";

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="card p-8 text-center max-w-md">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-4">{this.state.error?.message || "An unexpected error occurred."}</p>
            <a href="/" className="btn-primary">Go to Dashboard</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
