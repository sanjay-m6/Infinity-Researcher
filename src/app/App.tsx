import React from "react";
import { AppProvider } from "../context/AppContext";
import { AppShell } from "../components/layout/AppShell";
import { Paper, Collection, DownloadJob, ActivityEvent } from "../types/domain";

export interface AppProps {
  initialPapers?: Paper[];
  initialCollections?: Collection[];
  initialJobs?: DownloadJob[];
  initialActivity?: ActivityEvent[];
}

export const App: React.FC<AppProps> = ({
  initialPapers,
  initialCollections,
  initialJobs,
  initialActivity,
}) => {
  return (
    <AppProvider
      initialPapers={initialPapers}
      initialCollections={initialCollections}
      initialJobs={initialJobs}
      initialActivity={initialActivity}
    >
      <AppShell />
    </AppProvider>
  );
};

export default App;
