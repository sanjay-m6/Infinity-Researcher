import React, { useState, useMemo } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Paper } from "../../../types/domain";
import { Tag as TagIcon, Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { getSemanticTagColor } from "../types";

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: Paper[];
  onFilterByTag?: (tagName: string) => void;
  onRenameTag: (oldName: string, newName: string) => Promise<void>;
  onDeleteTag: (tagName: string) => Promise<void>;
  onCreateTag?: (tagName: string) => Promise<void>;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen,
  onClose,
  papers,
  onFilterByTag,
  onRenameTag,
  onDeleteTag,
  onCreateTag,
}) => {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Aggregate tags with counts
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    papers.forEach((p) => {
      (p.tags || []).forEach((t) => {
        const clean = t.trim();
        if (clean) {
          map.set(clean, (map.get(clean) || 0) + 1);
        }
      });
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [papers]);

  const filteredTags = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return tagCounts;
    return tagCounts.filter((t) => t.name.toLowerCase().includes(q));
  }, [tagCounts, searchFilter]);

  const handleStartRename = (name: string) => {
    setEditingTag(name);
    setEditedName(name);
  };

  const handleSaveRename = async (oldName: string) => {
    const target = editedName.trim();
    if (!target || target === oldName) {
      setEditingTag(null);
      return;
    }
    await onRenameTag(oldName, target);
    setEditingTag(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !onCreateTag) return;
    await onCreateTag(newTagName.trim());
    setNewTagName("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Research Tag Management"
      maxWidth="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Organize and classify research literature using normalized, semantic color-coded
          tags.
        </p>

        {/* Quick create tag */}
        {onCreateTag && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Create a new tag (e.g. transformers, benchmark)..."
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <Button size="sm" type="submit" disabled={!newTagName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Tag
            </Button>
          </form>
        )}

        {/* Search tag filter */}
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter existing tags..."
          className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200"
        />

        {/* Tag list */}
        {filteredTags.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <TagIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No matching tags found.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {filteredTags.map((tag) => {
              const color = getSemanticTagColor(tag.name);
              const isEditing = editingTag === tag.name;

              return (
                <div
                  key={tag.name}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="flex-1 text-xs px-2 py-1 rounded border border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(tag.name)}
                        className="p-1 text-emerald-600 hover:text-emerald-700"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTag(null)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${color.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${color.dotClass}`} />
                        <span className="truncate">{tag.name}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        ({tag.count} {tag.count === 1 ? "paper" : "papers"})
                      </span>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {onFilterByTag && (
                        <button
                          type="button"
                          onClick={() => {
                            onFilterByTag(tag.name);
                            onClose();
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartRename(tag.name)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Rename tag"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTag(tag.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete tag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
