import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { useApp } from "../../context/AppContext";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { TitleBar } from "./TitleBar";
import { BottomBar } from "./BottomBar";
import { ToastContainer } from "../ui/ToastContainer";
import { CommandPalette } from "../ui/CommandPalette";
import { AboutModal } from "../ui/AboutModal";
import { OnboardingWizard } from "../../features/onboarding/OnboardingWizard";
import { FeedbackCenterModal } from "../../features/feedback/FeedbackCenterModal";
import { PaperDetailDrawer } from "../../features/paper-details/PaperDetailDrawer";
import { EmbeddedPdfViewer } from "../pdf-viewer/EmbeddedPdfViewer";

// Feature screens
import { DashboardView } from "../../features/dashboard/DashboardView";
import { DiscoverView } from "../../features/discover/DiscoverView";
import { LibraryView } from "../../features/library/LibraryView";
import { DownloadsView } from "../../features/downloads/DownloadsView";
import { CollectionsView } from "../../features/collections/CollectionsView";
import { SourcesView } from "../../features/sources/SourcesView";
import { ActivityView } from "../../features/activity/ActivityView";
import { SettingsView } from "../../features/settings/SettingsView";
import { IeeeOpenAccessView } from "../../features/ieee/IeeeOpenAccessView";
import { AiHubView } from "../../features/ai-hub/AiHubView";
import { IntegrityView } from "../../features/integrity/IntegrityView";
import { ReviewMatrixView } from "../../features/review-matrix/ReviewMatrixView";

export const AppShell: React.FC = () => {
  const {
    activeSection,
    readingPaper,
    setReadingPaper,
    isAboutModalOpen,
    setIsAboutModalOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isFeedbackCenterOpen,
    setIsFeedbackCenterOpen,
    feedbackCategory,
  } = useApp();
  const [hasVisitedDiscover, setHasVisitedDiscover] = useState(activeSection === "discover");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSection === "discover") {
      setHasVisitedDiscover(true);
    }
  }, [activeSection]);

  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0.85, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
      );
    }
  }, [activeSection]);

  const renderActiveScreen = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardView />;
      case "discover":
        return <DiscoverView />;
      case "ieee":
        return <IeeeOpenAccessView />;
      case "library":
        return <LibraryView />;
      case "review_matrix":
        return <ReviewMatrixView />;
      case "integrity":
        return <IntegrityView />;
      case "downloads":
        return <DownloadsView />;
      case "collections":
        return <CollectionsView />;
      case "sources":
        return <SourcesView />;
      case "activity":
        return <ActivityView />;
      case "ai_hub":
        return <AiHubView />;
      case "settings":
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };


  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Custom Window Title Bar */}
      <TitleBar />

      {/* Main Workspace (Sidebar + Canvas) */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
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
            className={`flex-1 focus:outline-none ${
              activeSection === "discover" || activeSection === "review_matrix"
                ? "overflow-hidden p-0 flex flex-col"
                : "overflow-y-auto px-6 py-6 sm:px-8 sm:py-8"
            }`}
          >
            {/* Discover View is persistently kept mounted once visited so switching tabs never resets query, results, streaming jobs, or PDF state */}
            {hasVisitedDiscover && (
              <div className={`flex-1 h-full w-full flex flex-col min-h-0 ${activeSection === "discover" ? "" : "hidden"}`}>
                <DiscoverView />
              </div>
            )}

            {activeSection !== "discover" && (
              <div ref={contentRef} className="max-w-7xl mx-auto w-full">{renderActiveScreen()}</div>
            )}
          </main>
        </div>
      </div>

      {/* Modern Status Bottom Bar */}
      <BottomBar />

      {/* Slide-over Paper Details Drawer */}
      <PaperDetailDrawer />

      {/* Embedded PDF Workspace Modal/Panel */}
      {readingPaper && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="w-full h-full max-w-6xl max-h-[96vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
            <EmbeddedPdfViewer
              paperId={readingPaper.id}
              paperTitle={readingPaper.title}
              sourceUrl={readingPaper.sourceUrl}
              onClose={() => setReadingPaper(null)}
            />
          </div>
        </div>
      )}

      {/* Floating Notifications */}
      <ToastContainer />

      {/* Ctrl+K Quick Command Palette */}
      <CommandPalette />

      {/* About Infinity Researcher Dialog */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      {/* Dynamic First-Run Onboarding Wizard */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => setIsOnboardingOpen(false)}
      />

      {/* GitHub Bug Reporting & Feature Request Center */}
      <FeedbackCenterModal
        isOpen={isFeedbackCenterOpen}
        onClose={() => setIsFeedbackCenterOpen(false)}
        initialCategory={feedbackCategory}
      />
    </div>
  );
};
