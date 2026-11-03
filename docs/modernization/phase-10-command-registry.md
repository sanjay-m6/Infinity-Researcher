# Phase 10: Command Registry Specification

## 1. Overview

The command registry (`src/lib/search/commandRegistry.ts`) provides a centralized, type-safe inventory of all navigation destinations, analytical tools, and application actions available within Infinity Researcher.

---

## 2. Command Structure

Each command adheres to the `CommandDefinition` interface:
```typescript
export interface CommandDefinition {
  id: string;
  title: string;
  category: "navigation" | "tool" | "action";
  description?: string;
  shortcut?: string;
  icon: LucideIcon;
  keywords?: string[];
  section?: NavSection;
  execute?: () => void;
}
```

---

## 3. Registered Commands Inventory

### 3.1. Navigation Pages (`category: "navigation"`)

| Command ID | Title | Route (`section`) | Keywords |
| :--- | :--- | :--- | :--- |
| `nav-dashboard` | Dashboard | `dashboard` | `home, overview, metrics, stats` |
| `nav-discover` | Discover Papers | `discover` | `search, arxiv, openalex, find, explore` |
| `nav-library` | Paper Library | `library` | `saved, local, indexed, my papers` |
| `nav-collections` | Research Collections | `collections` | `binders, folders, tags, groups` |
| `nav-downloads` | Download Queue | `downloads` | `tasks, jobs, retrieval, queue` |
| `nav-activity` | Activity Logs | `activity` | `history, audit, events, logs` |
| `nav-sources` | Academic Sources | `sources` | `providers, connectors, feeds, apis` |
| `nav-settings` | Settings | `settings` | `preferences, config, appearance` |
| `nav-privacy` | Privacy & Security | `privacy_security` | `local, offline, data, encryption` |
| `nav-ieee` | IEEE Open Access Hub | `ieee` | `ieee, xplore, engineering, journals` |
| `nav-saved-reports` | Saved Reports & Exports | `saved_reports` | `exports, reports, bibtex, archive` |

### 3.2. Research & Analytical Tools (`category: "tool"`)

| Command ID | Title | Route (`section`) | Description |
| :--- | :--- | :--- | :--- |
| `tool-literature` | Literature Workspace | `literature_workspace` | Multi-document synthesis & matrix extraction |
| `tool-assistant` | AI Research Assistant | `research_assistant` | Chat with AI copilot for evidence synthesis |
| `tool-citation` | Citation Checker | `citation_checker` | Validate references & audit BibTeX |
| `tool-review-matrix` | Systematic Review Matrix | `review_matrix` | Systematic literature review extraction tables |
| `tool-paper-comparison` | Paper Comparison | `paper_comparison` | Side-by-side comparative analysis |
| `tool-ai-hub` | AI Tools Hub | `ai_tools` | Suite of academic AI assistance tools |
| `tool-ai-detector` | AI Writing Detector | `ai_writing_detector` | Detect machine-generated signals |
| `tool-plagiarism` | Plagiarism Checker | `plagiarism_checker` | Audit document overlap and originality |
| `tool-humanizer` | AI Humanizer | `ai_humanizer` | Refine tone and academic flow |
| `tool-writing-assistant` | Academic Writing Assistant | `academic_writing_assistant` | Structure academic manuscripts |
| `tool-paraphrasing` | Paraphrasing Tool | `paraphrasing_tool` | Academic rewording & restructuring |
| `tool-readability` | Readability Analyzer | `readability_analyzer` | Flesch-Kincaid & readability metrics |
| `tool-integrity` | Research Integrity Suite | `research_integrity` | Comprehensive research validation audit |

### 3.3. Application Actions (`category: "action"`)

| Command ID | Title | Action Handler Trigger |
| :--- | :--- | :--- |
| `act-toggle-theme` | Toggle Theme (Light / Dark) | `toggleTheme()` |
| `act-lock-app` | Lock Application | `lockApplication()` |
| `act-onboarding` | Run Setup & Onboarding Wizard | `setIsOnboardingOpen(true)` |
| `act-about` | About Infinity Researcher | `setIsAboutModalOpen(true)` |
| `act-feedback` | Report a Bug / Request a Feature | `openFeedbackCenter("bug")` |

