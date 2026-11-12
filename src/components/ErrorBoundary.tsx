import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WalkNepalWalk ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  handleResetState = () => {
    try {
      // Clear non-critical caches that might cause stale state mismatch
      sessionStorage.clear();
      localStorage.removeItem('wnw_cached_cloudflare_treks');
      localStorage.removeItem('wnw_active_tab');
      window.location.href = window.location.pathname;
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F7F5] text-[#1F1F1F] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-[#FC4C02] border border-amber-200 flex items-center justify-center shadow-inner">
              <AlertCircle className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#7ABA42] bg-[#7ABA42]/10 px-3 py-1 rounded-full">
                Walk Nepal Walk
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#1F1F1F] tracking-tight">
                Preview Encountered an Issue
              </h1>
              <p className="text-sm text-[#5A5551] leading-relaxed">
                The application encountered an unexpected runtime error. You can easily recover by reloading the view or resetting the cached state.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left bg-[#F7F4EF] rounded-xl p-3 border border-[#E5E0D8] text-xs text-[#5A5551] font-mono break-words max-h-36 overflow-y-auto">
                <summary className="font-sans font-bold cursor-pointer text-[#1F1F1F] select-none mb-1">
                  Technical Details
                </summary>
                <div className="whitespace-pre-wrap mt-1">
                  {this.state.error.message || String(this.state.error)}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary flex-1 py-3 px-4 text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Preview
              </button>
              <button
                type="button"
                onClick={this.handleResetState}
                className="btn-secondary flex-1 py-3 px-4 text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset & Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
