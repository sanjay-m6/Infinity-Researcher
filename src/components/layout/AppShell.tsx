import React from "react";
import { useApp } from "../../context/AppContext";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { ToastContainer } from "../ui/ToastContainer";
import { CommandPalette } from "../ui/CommandPalette";
import { PaperDetailDrawer } from "../../features/paper-details/PaperDetailDrawer";

// Feature screens
import { DashboardView } from "../../features/dashboard/DashboardView";
import { DiscoverView } from "../../features/discover/DiscoverView";
import { LibraryView } from "../../features/library/LibraryView";
import { DownloadsView } from "../../features/downloads/DownloadsView";
import { CollectionsView } from "../../features/collections/CollectionsView";
import { SourcesView } from "../../features/sources/SourcesView";
import { ActivityView } from "../../features/activity/ActivityView";
import { SettingsView } from "../../features/settings/SettingsView";

export const AppShell: React.FC = () => {
  const { activeSection } = useApp();

  const renderActiveScreen = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardView />;
      case "discover":
        return <DiscoverView />;
      case "library":
        return <LibraryView />;
      case "downloads":
        return <DownloadsView />;
      case "collections":
        return <CollectionsView />;
      case "sources":
        return <SourcesView />;
      case "activity":
        return <ActivityView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Toolbar */}
        <Toolbar />

        {/* Scrollable View Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8 focus:outline-none"
        >
          <div className="max-w-7xl mx-auto w-full">{renderActiveScreen()}</div>
        </main>
      </div>

      {/* Slide-over Paper Details Drawer */}
      <PaperDetailDrawer />

      {/* Floating Notifications */}
      <ToastContainer />

      {/* Ctrl+K Quick Command Palette */}
      <CommandPalette />
    </div>
  );
};
