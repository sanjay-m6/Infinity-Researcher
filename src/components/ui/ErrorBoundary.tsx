import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error caught by ErrorBoundary:", error, errorInfo);
  }

  public handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-[#070b12] text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-white/10 shadow-2xl text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              An unexpected display issue occurred
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {this.state.error?.message || "A component failed to render cleanly."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
