import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  override componentDidCatch(error: Error) {
    console.error('CityFix ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      let parsedMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          parsedMsg = `${parsed.error} (operation: ${parsed.operationType ?? 'unknown'})`;
        }
      } catch {
        // Use raw message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-lg border border-red-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-base font-semibold text-slate-900">
                  Workspace Recovery Notice
                </h1>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {parsedMsg}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0c3d68]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reload View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
