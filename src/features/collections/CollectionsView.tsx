import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import {
  FolderPlus,
  FolderOpen,
  BookOpen,
  ArrowLeft,
  Trash2,
  Edit2,
  Search,
} from "lucide-react";

export const CollectionsView: React.FC = () => {
  const {
    collections,
    papers,
    selectedCollectionId,
    setSelectedCollectionId,
    setSelectedPaperId,
    createCollection,
    renameCollection,
    deleteCollection,
    removePaperFromCollection,
  } = useApp();

  // Create Collection Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [newColColor, setNewColColor] = useState("#6366f1");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Collection Modal
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState("");
  const [editColDesc, setEditColDesc] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation Dialog
  const [colToDeleteId, setColToDeleteId] = useState<string | null>(null);

  // Search within detail view
  const [detailSearch, setDetailSearch] = useState("");

  const activeCollection = collections.find((c) => c.id === selectedCollectionId);
  const colToDelete = collections.find((c) => c.id === colToDeleteId);

  const handleOpenCreateModal = () => {
    setNewColName("");
    setNewColDesc("");
    setNewColColor("#6366f1");
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createCollection(newColName, newColDesc, newColColor);
    if (!result.success) {
      setCreateError(result.error || "Failed to create collection");
    } else {
      setIsCreateModalOpen(false);
    }
  };

  const handleOpenEditModal = (col: (typeof collections)[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColId(col.id);
    setEditColName(col.name);
    setEditColDesc(col.description);
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingColId) return;
    const result = renameCollection(editingColId, editColName, editColDesc);
    if (!result.success) {
      setEditError(result.error || "Failed to update collection");
    } else {
      setEditingColId(null);
    }
  };

  // If viewing a single collection detail
  if (activeCollection) {
    const colPapers = papers.filter((p) => activeCollection.paperIds.includes(p.id));
    const filteredColPapers = detailSearch.trim()
      ? colPapers.filter(
          (p) =>
            p.title.toLowerCase().includes(detailSearch.toLowerCase()) ||
            p.authors.some((a) => a.toLowerCase().includes(detailSearch.toLowerCase()))
        )
      : colPapers;

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <PageHeader
          title={activeCollection.name}
          description={activeCollection.description || "Collection papers repository"}
          breadcrumbs={[
            { label: "Collections", onClick: () => setSelectedCollectionId(null) },
            { label: activeCollection.name },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCollectionId(null)}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Collections</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleOpenEditModal(activeCollection, e)}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setColToDeleteId(activeCollection.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
            </div>
          }
        />

        {/* Collection detail search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
              placeholder="Search inside this collection..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            {filteredColPapers.length} of {colPapers.length} papers
          </span>
        </div>

        {/* Collection papers list */}
        {filteredColPapers.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-2xs">
            {filteredColPapers.map((paper) => (
              <div
                key={paper.id}
                onClick={() => setSelectedPaperId(paper.id)}
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                <div className="min-w-0 pr-4 space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {paper.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {paper.authors.join(", ")} • {paper.venue} ({paper.year})
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="primary" size="sm">
                    {paper.sourceName}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePaperFromCollection(paper.id, activeCollection.id);
                    }}
                    title="Remove paper from this collection (paper stays in Library)"
                    className="text-xs text-slate-400 hover:text-rose-600"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="No papers in this collection"
            description="Open paper details in Discover or Library to add papers into this research collection."
          />
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={Boolean(colToDeleteId)}
          onClose={() => setColToDeleteId(null)}
          onConfirm={() => {
            if (colToDeleteId) {
              deleteCollection(colToDeleteId);
              setSelectedCollectionId(null);
            }
          }}
          title="Delete Collection"
          message={`Are you sure you want to delete "${activeCollection.name}"? All paper records inside will remain safely in your main library.`}
          confirmLabel="Delete Collection"
          isDestructive={true}
        />
      </div>
    );
  }

  // Grid view of all collections
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Research Collections"
        description="Organize papers by topic, grant, experiment, or literature review."
        actions={
          <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
            <FolderPlus className="w-4 h-4" />
            <span>New Collection</span>
          </Button>
        }
      />

      {/* Collections Grid */}
      {collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCollectionId(col.id)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedCollectionId(col.id)}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-2xs cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: col.colorHex }}
                    />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {col.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(col, e)}
                      title="Edit collection"
                      aria-label="Edit collection"
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setColToDeleteId(col.id);
                      }}
                      title="Delete collection"
                      aria-label="Delete collection"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {col.description || "No description provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{col.paperIds.length} papers</span>
                </div>
                <span className="text-[11px] font-mono">
                  Updated: {new Date(col.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderOpen className="w-6 h-6" />}
          title="No collections created yet"
          description="Create custom collections to categorize research literature by topic or project."
          actionLabel="Create First Collection"
          onAction={handleOpenCreateModal}
        />
      )}

      {/* Create Collection Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Research Collection"
        description="Define a label and topic for grouping academic papers."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit}>
              Create Collection
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Collection Name"
            placeholder="e.g. Deep Learning Transformers"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            error={createError || undefined}
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={newColDesc}
              onChange={(e) => setNewColDesc(e.target.value)}
              placeholder="Brief summary of research focus or review objectives..."
              className="w-full text-xs sm:text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Badge Color Accent
            </label>
            <div className="flex items-center gap-2">
              {[
                "#6366f1",
                "#059669",
                "#d97706",
                "#dc2626",
                "#0284c7",
                "#9333ea",
                "#db2777",
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newColColor === c
                      ? "ring-2 ring-offset-2 ring-indigo-500 scale-110"
                      : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Collection Modal */}
      <Modal
        isOpen={Boolean(editingColId)}
        onClose={() => setEditingColId(null)}
        title="Edit Collection"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingColId(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSubmit}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Collection Name"
            value={editColName}
            onChange={(e) => setEditColName(e.target.value)}
            error={editError || undefined}
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={editColDesc}
              onChange={(e) => setEditColDesc(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(colToDeleteId)}
        onClose={() => setColToDeleteId(null)}
        onConfirm={() => {
          if (colToDeleteId) {
            deleteCollection(colToDeleteId);
          }
        }}
        title="Delete Collection"
        message={`Are you sure you want to delete "${colToDelete?.name}"? All paper records inside will remain safely in your main library.`}
        confirmLabel="Delete Collection"
        isDestructive={true}
      />
    </div>
  );
};
