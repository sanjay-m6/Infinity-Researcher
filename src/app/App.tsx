import React from "react";
import { AppProvider, useApp } from "../context/AppContext";
import { AppShell } from "../components/layout/AppShell";
import { AuthView } from "../features/auth";
import { TitleBar } from "../components/layout/TitleBar";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { ReducedMotionProvider } from "../components/animation";
import { Paper, Collection, DownloadJob, ActivityEvent } from "../types/domain";
import { User } from "../lib/desktop-api";

export interface AppProps {
  initialPapers?: Paper[];
  initialCollections?: Collection[];
  initialJobs?: DownloadJob[];
  initialActivity?: ActivityEvent[];
  initialUser?: User | null;
}

const MainAppContent: React.FC = () => {
  const { user } = useApp();

  if (!user) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#070b12] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-indigo-500/20">
        <TitleBar />
        <div className="flex-1 overflow-hidden relative">
          <AuthView />
        </div>
      </div>
    );
  }
  return <AppShell />;
};

export const App: React.FC<AppProps> = ({
  initialPapers,
  initialCollections,
  initialJobs,
  initialActivity,
  initialUser,
}) => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ReducedMotionProvider>
          <AppProvider
            initialPapers={initialPapers}
            initialCollections={initialCollections}
            initialJobs={initialJobs}
            initialActivity={initialActivity}
            initialUser={initialUser}
          >
            <MainAppContent />
          </AppProvider>
        </ReducedMotionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
