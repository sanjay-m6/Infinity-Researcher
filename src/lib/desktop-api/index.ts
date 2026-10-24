import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment, normalizeCommandError } from "../tauri-bridge";
import type {
  AppSetting,
  CollectionCreateInput,
  CollectionUpdateInput,
  DatabaseInfo,
  DbCollection,
  DbNote,
  DbPaper,
  DbSource,
  DbTag,
  NoteSaveInput,
  PagedResponse,
  PaperCreateInput,
  PaperListQuery,
  PaperUpdateInput,
} from "./types";

export * from "./types";
export * from "./adapters";
export { isTauriEnvironment, normalizeCommandError } from "../tauri-bridge";

/**
 * Invokes a typed Tauri command with error normalization.
 */
async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    throw {
      code: "ERR_RUNTIME_UNAVAILABLE",
      message: `Desktop IPC unavailable for command "${cmd}". Running in web preview.`,
      retryable: false,
    };
  }

  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw normalizeCommandError(err);
  }
}

// ---------------------------------------------------------------------------
// Database Diagnostics
// ---------------------------------------------------------------------------

export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  return invokeCommand<DatabaseInfo>("get_database_info");
}

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------

export async function listPapers(
  query: PaperListQuery = {}
): Promise<PagedResponse<DbPaper>> {
  return invokeCommand<PagedResponse<DbPaper>>("list_papers", { query });
}

export async function getPaper(id: string): Promise<DbPaper | null> {
  return invokeCommand<DbPaper | null>("get_paper", { id });
}

export async function createPaper(input: PaperCreateInput): Promise<DbPaper> {
  return invokeCommand<DbPaper>("create_paper", { input });
}

export async function updatePaper(input: PaperUpdateInput): Promise<DbPaper> {
  return invokeCommand<DbPaper>("update_paper", { input });
}

export async function deletePaper(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_paper", { id });
}

export async function toggleSavePaper(id: string, isSaved: boolean): Promise<boolean> {
  return invokeCommand<boolean>("toggle_save_paper", { id, isSaved });
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function listCollections(): Promise<DbCollection[]> {
  return invokeCommand<DbCollection[]>("list_collections");
}

export async function createCollection(
  input: CollectionCreateInput
): Promise<DbCollection> {
  return invokeCommand<DbCollection>("create_collection", { input });
}

export async function updateCollection(
  input: CollectionUpdateInput
): Promise<boolean> {
  return invokeCommand<boolean>("update_collection", { input });
}

export async function deleteCollection(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_collection", { id });
}

export async function addPaperToCollection(
  collectionId: string,
  paperId: string
): Promise<void> {
  return invokeCommand<void>("add_paper_to_collection", {
    collectionId,
    paperId,
  });
}

export async function removePaperFromCollection(
  collectionId: string,
  paperId: string
): Promise<boolean> {
  return invokeCommand<boolean>("remove_paper_from_collection", {
    collectionId,
    paperId,
  });
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function listTags(): Promise<DbTag[]> {
  return invokeCommand<DbTag[]>("list_tags");
}

export async function assignTagToPaper(
  paperId: string,
  tagName: string
): Promise<DbTag> {
  return invokeCommand<DbTag>("assign_tag_to_paper", { paperId, tagName });
}

export async function removeTagFromPaper(
  paperId: string,
  tagId: string
): Promise<boolean> {
  return invokeCommand<boolean>("remove_tag_from_paper", { paperId, tagId });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function getNotesForPaper(paperId: string): Promise<DbNote[]> {
  return invokeCommand<DbNote[]>("get_notes_for_paper", { paperId });
}

export async function saveNote(input: NoteSaveInput): Promise<DbNote> {
  return invokeCommand<DbNote>("save_note", { input });
}

export async function deleteNote(id: string): Promise<boolean> {
  return invokeCommand<boolean>("delete_note", { id });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getAppSetting(key: string): Promise<string | null> {
  return invokeCommand<string | null>("get_app_setting", { key });
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  return invokeCommand<void>("set_app_setting", { key, value });
}

export async function listAppSettings(): Promise<AppSetting[]> {
  return invokeCommand<AppSetting[]>("list_app_settings");
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listSources(): Promise<DbSource[]> {
  return invokeCommand<DbSource[]>("list_sources");
}
