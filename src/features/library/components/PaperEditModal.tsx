import React, { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Paper } from "../../../types/domain";
import { ReadingStatus } from "../types";

interface PaperEditModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (paperId: string, updatedFields: Partial<Paper>) => Promise<void>;
}

export const PaperEditModal: React.FC<PaperEditModalProps> = ({
  paper,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [venue, setVenue] = useState("");
  const [doi, setDoi] = useState("");
  const [abstract, setAbstract] = useState("");
  const [tags, setTags] = useState("");
  const [readingStatus, setReadingStatus] = useState<ReadingStatus>("unread");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (paper) {
      setTitle(paper.title || "");
      setAuthors((paper.authors || []).join(", "));
      setYear(paper.year || "");
      setVenue(paper.venue || "");
      setDoi(paper.doi || "");
      setAbstract(paper.abstract || "");
      setTags((paper.tags || []).join(", "));
      setReadingStatus((paper.readingStatus || "unread") as ReadingStatus);
    }
  }, [paper]);

  if (!paper) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedAuthors = authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await onSave(paper.id, {
        title: title.trim(),
        authors: parsedAuthors,
        year: typeof year === "number" ? year : undefined,
        venue: venue.trim(),
        doi: doi.trim() || null,
        abstract: abstract.trim(),
        tags: parsedTags,
        readingStatus,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Paper Metadata"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Authors (comma separated)
            </label>
            <input
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g. Alice Smith, Bob Jones"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Publication Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) =>
                setYear(e.target.value ? parseInt(e.target.value, 10) : "")
              }
              placeholder="e.g. 2024"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Venue / Journal / Conference
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. NeurIPS 2024"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Digital Object Identifier (DOI)
            </label>
            <input
              type="text"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.1145/..."
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reading Status
            </label>
            <select
              value={readingStatus}
              onChange={(e) => setReadingStatus(e.target.value as ReadingStatus)}
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="unread">Unread</option>
              <option value="in_progress">In Progress</option>
              <option value="read">Read</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. deep-learning, benchmark, attention"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Abstract
          </label>
          <textarea
            rows={4}
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSaving || !title.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
