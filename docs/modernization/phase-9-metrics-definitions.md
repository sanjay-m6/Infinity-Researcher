# Phase 9: Metrics Definitions & Calculations Specification

## 1. Overview

In accordance with Phase 9 requirements, all metric calculations must be deterministic, derived from real database collections, and free of synthetic simulation. This document codifies the exact formulas, types, contexts, and zero-state handling for each metric displayed on the modernized dashboard.

---

## 2. Formal Metric Definitions

### 2.1. Total Indexed Papers
- **Card Title**: `Total Indexed Papers`
- **Data Origin**: `papers: Paper[]` (synchronized from SQLite table `papers`).
- **Primary Value Formula**:
  $$\text{TotalPapers} = \text{papers.length}$$
- **Contextual Label**:
  $$\text{OpenAccessCount} = \left|\{p \in \text{papers} \mid p.\text{accessStatus} = \text{"open\_access"}\}\right|$$
  Displayed as: `"{OpenAccessCount} open access"`
- **Target Route**: `"library"` (`setActiveSection("library")`)
- **Screen Reader Label**:
  `Total indexed papers: ${papers.length}. Click to browse library.`
- **Zero-State Representation**: Displays `0` with `0 open access`.

---

### 2.2. Saved in Library
- **Card Title**: `Saved in Library`
- **Data Origin**: `papers: Paper[]` and `collections: Collection[]`.
- **Primary Value Formula**:
  $$\text{SavedPapers} = \left|\{p \in \text{papers} \mid p.\text{isSaved} = \text{true}\}\right|$$
- **Contextual Label**:
  $$\text{CollectionCount} = \text{collections.length}$$
  Displayed as: `"across {CollectionCount} collection(s)"`
- **Target Route**: `"library"` (`setActiveSection("library")`)
- **Screen Reader Label**:
  `Saved papers: ${savedPapers.length}. Click to view saved papers.`
- **Zero-State Representation**: Displays `0` with `across 0 collections`.

---

### 2.3. Active Job Queue
- **Card Title**: `Active Job Queue`
- **Data Origin**: `jobs: DownloadJob[]` (background retrieval and text extraction tasks).
- **Primary Value Formula**:
  $$\text{ActiveJobs} = \left|\{j \in \text{jobs} \mid j.\text{status} \in \{\text{"running"}, \text{"queued"}\}\}\right|$$
- **Contextual Label**:
  $$\text{TotalTasks} = \text{jobs.length}$$
  Displayed as: `"{TotalTasks} total tasks"`
- **Target Route**: `"downloads"` (`setActiveSection("downloads")`)
- **Screen Reader Label**:
  `Active job queue: ${activeDownloads.length} active of ${jobs.length} total tasks. Click to inspect download queue.`
- **Zero-State Representation**: Displays `0` with `0 total tasks`.

---

### 2.4. Configured Providers
- **Card Title**: `Configured Providers`
- **Data Origin**: `sources: SourceProvider[]`.
- **Primary Value Formula**:
  $$\text{SupportedCount} = \left|\{s \in \text{sources} \mid s.\text{status} = \text{"Supported"}\}\right|$$
  Displayed as: `"{SupportedCount} / {sources.length}"`
- **Contextual Label**: `"Verified feeds"`
- **Target Route**: `"sources"` (`setActiveSection("sources")`)
- **Screen Reader Label**:
  `Configured providers: ${supportedSources.length} of ${sources.length} active. Click to manage sources.`
- **Zero-State Representation**: Displays `0 / 0` with `Verified feeds`.

---

### 2.5. Research Collections (Binder Count)
- **Data Origin**: `collections: Collection[]`.
- **Primary Value Formula**:
  $$\text{TotalCollections} = \text{collections.length}$$
- **Binder Paper Count Formula**:
  $$\text{CollectionPapers}(c) = \text{col.paperIds.length}$$
  Displayed as: `"{CollectionPapers} papers"` on collection badge.
- **Target Route**: `"collections"` (`setActiveSection("collections")`)
- **Screen Reader Label**:
  `Collection: {name}, contains {count} papers. Click to open.`
- **Zero-State Representation**: Displays standardized compact `EmptyState` component.

