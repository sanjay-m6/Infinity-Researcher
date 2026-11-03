import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../context/AppContext";
import { PageTransition } from "../animation";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { TitleBar } from "./TitleBar";
import { BottomBar } from "./BottomBar";
import { ToastContainer } from "../ui/ToastContainer";
import { CommandPalette } from "../ui/CommandPalette";
import { AboutModal } from "../ui/AboutModal";
import { SupportDonationModal } from "../ui/SupportDonationModal";
import { OnboardingWizard } from "../../features/onboarding/OnboardingWizard";
import { FeedbackCenterModal } from "../../features/feedback/FeedbackCenterModal";
import { PaperDetailDrawer } from "../../features/paper-details/PaperDetailDrawer";
import { EmbeddedPdfViewer } from "../pdf-viewer/EmbeddedPdfViewer";
import { GlobalAiChatDrawer } from "../chat/GlobalAiChatDrawer";

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
import { ReviewMatrixView } from "../../features/review-matrix/ReviewMatrixView";
import { AiToolsHubView } from "../../features/ai-tools/AiToolsHubView";
import { AiToolWorkspaceView } from "../../features/ai-tools/AiToolWorkspaceView";
import { AcademicWritingWorkspaceView } from "../../features/writing-workspace";
import { CitationCheckerWorkspaceView } from "../../features/citation-checker";
import { ReadabilityAnalyzerView } from "../../features/readability";
import { ResearchIntegrityView } from "../../features/integrity";
import { SavedReportsView } from "../../features/reports/SavedReportsView";
import { PrivacySecurityView } from "../../features/privacy/PrivacySecurityView";
import { LiteratureWorkspaceView } from "../../features/literature-workspace/LiteratureWorkspaceView";
import { LockScreenView } from "../../features/auth";
import { ProjectsView } from "../../features/projects/ProjectsView";
import { TasksWorkspaceView } from "../../features/tasks/TasksWorkspaceView";
import { AiDiagnosticsView } from "../../features/ai-hub/AiDiagnosticsView";

export const AppShell: React.FC = () => {
  const {
    isLocked,
    activeSection,
    readingPaper,
    setReadingPaper,
    isAboutModalOpen,
    setIsAboutModalOpen,
    isDonationModalOpen,
    setIsDonationModalOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isFeedbackCenterOpen,
    setIsFeedbackCenterOpen,
    feedbackCategory,
  } = useApp();
  const [hasVisitedDiscover, setHasVisitedDiscover] = useState(
    activeSection === "discover"
  );
  const isAiHubActive =
    activeSection === "ai_hub" ||
    activeSection === "research_assistant" ||
    activeSection === "ai_models";
  const [hasVisitedAiHub, setHasVisitedAiHub] = useState(isAiHubActive);

  useEffect(() => {
    if (activeSection === "discover") {
      setHasVisitedDiscover(true);
    }
    if (isAiHubActive) {
      setHasVisitedAiHub(true);
    }
  }, [activeSection, isAiHubActive]);

  const renderActiveScreen = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardView />;
      case "discover":
        return <DiscoverView />;
      case "literature_workspace":
        return <LiteratureWorkspaceView />;
      case "ieee":
        return <IeeeOpenAccessView />;
      case "library":
        return <LibraryView />;
      case "paper_comparison":
      case "review_matrix":
        return <ReviewMatrixView />;
      case "research_assistant":
      case "ai_models":
      case "ai_hub":
        return null;
      case "downloads":
      case "history":
        return <DownloadsView />;
      case "projects":
        return <ProjectsView />;
      case "tasks":
        return <TasksWorkspaceView />;
      case "collections":
        return <CollectionsView />;
      case "saved_reports":
        return <SavedReportsView />;
      case "sources":
        return <SourcesView />;
      case "activity":
        return <ActivityView />;
      case "ai_diagnostics":
        return <AiDiagnosticsView />;
      case "ai_tools":
        return <AiToolsHubView />;
      case "ai_humanizer":
      case "academic_writing_assistant":
      case "paraphrasing_tool":
        return <AcademicWritingWorkspaceView toolId={activeSection} />;
      case "citation_checker":
        return <CitationCheckerWorkspaceView />;
      case "readability_analyzer":
        return <ReadabilityAnalyzerView />;
      case "research_integrity":
        return <ResearchIntegrityView />;
      case "ai_writing_detector":
      case "plagiarism_checker":
        return <AiToolWorkspaceView toolId={activeSection} />;
      case "settings":
        return <SettingsView />;
      case "privacy_security":
        return <PrivacySecurityView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#070b12] text-slate-900 dark:text-slate-100 font-sans antialiased">
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
              activeSection === "discover" ||
              activeSection === "review_matrix" ||
              activeSection === "paper_comparison" ||
              activeSection === "literature_workspace" ||
              isAiHubActive
                ? "overflow-hidden p-0 flex flex-col h-full w-full"
                : "overflow-y-auto px-6 py-6 sm:px-8 sm:py-8"
            }`}
          >
            {/* Discover View is persistently kept mounted once visited so switching tabs never resets query, results, streaming jobs, or PDF state */}
            {hasVisitedDiscover && (
              <div
                className={`flex-1 h-full w-full flex flex-col min-h-0 ${
                  activeSection === "discover" ? "" : "hidden"
                }`}
              >
                <DiscoverView />
              </div>
            )}

            {/* AI Workspace & Research Knowledge View is persistently kept mounted so switching tabs never resets reading assistant, chat, or models */}
            {hasVisitedAiHub && (
              <div
                className={`flex-1 h-full w-full flex flex-col min-h-0 ${
                  isAiHubActive ? "" : "hidden"
                }`}
              >
                <AiHubView />
              </div>
            )}

            {activeSection !== "discover" && !isAiHubActive && (
              <PageTransition
                routeKey={activeSection}
                optOut={
                  activeSection === "review_matrix" ||
                  activeSection === "paper_comparison" ||
                  activeSection === "literature_workspace"
                }
                className={
                  activeSection === "review_matrix" ||
                  activeSection === "paper_comparison" ||
                  activeSection === "literature_workspace"
                    ? "flex-1 h-full w-full flex flex-col min-h-0 overflow-hidden"
                    : "max-w-7xl mx-auto w-full"
                }
              >
                {renderActiveScreen()}
              </PageTransition>
            )}
          </main>
        </div>
      </div>

      {/* Modern Status Bottom Bar */}
      <BottomBar />

      {/* Global AI Chat Drawer with Interactive LiveOrb */}
      <GlobalAiChatDrawer />

      {/* Slide-over Paper Details Drawer */}
      <PaperDetailDrawer />

      {/* Embedded PDF Workspace Modal/Panel */}
      {readingPaper &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div className="w-full h-full max-w-6xl max-h-[96vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
              <EmbeddedPdfViewer
                paperId={readingPaper.id}
                paperTitle={readingPaper.title}
                sourceUrl={readingPaper.sourceUrl}
                onClose={() => setReadingPaper(null)}
              />
            </div>
          </div>,
          document.body
        )}

      {/* Floating Notifications */}
      <ToastContainer />

      {/* Ctrl+K Quick Command Palette */}
      <CommandPalette />

      {/* About Infinity Researcher Dialog */}
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

      {/* Support & Donation Dialog */}
      <SupportDonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
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

      {/* Lock Screen Overlay */}
      {isLocked && <LockScreenView />}
    </div>
  );
};
