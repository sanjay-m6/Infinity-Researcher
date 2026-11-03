import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Plus,
  Search,
  Calendar,
  Clock,
  BookOpen,
} from "lucide-react";
import {
  ProjectWithDetails,
  listResearchProjects,
  ResearchDomain,
  listResearchDomains,
  ResearchProject,
} from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";
import { ProjectCreateModal } from "./ProjectCreateModal";
import { ProjectDetailView } from "./ProjectDetailView";

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [domains, setDomains] = useState<ResearchDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [domainFilter, setDomainFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    loadDomains();
  }, [statusFilter, domainFilter, search]);

  const loadDomains = async () => {
    try {
      const data = await listResearchDomains();
      setDomains(data);
    } catch (e) {
      console.error("Failed to load domains:", e);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await listResearchProjects(
        statusFilter === "all" ? undefined : statusFilter,
        domainFilter || undefined,
        search || undefined
      );
      setProjects(data);
    } catch (e) {
      console.error("Failed to load research projects:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectCreated = (newProj: ResearchProject) => {
    loadProjects();
    setActiveProjectId(newProj.id);
  };

  if (activeProjectId) {
    return (
      <ProjectDetailView
        projectId={activeProjectId}
        onBack={() => {
          setActiveProjectId(null);
          loadProjects();
        }}
        onProjectUpdated={loadProjects}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <FolderOpen className="w-6 h-6 text-primary" />
            Research Projects Workspace
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize investigations, hypotheses, milestones, tasks, and linked literature
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            New Research Project
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by title, objective, or tags..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none"
          >
            <option value="active">Active Projects</option>
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="archived">Archived</option>
          </select>

          {/* Domain Filter */}
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none"
          >
            <option value="">All Domains</option>
            {domains
              .filter((d) => !d.parent_id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-muted-foreground">Loading research projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-semibold text-foreground">No Research Projects Found</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Create your first project to organize research questions, generate AI roadmaps, manage tasks, and connect literature.
            </p>
          </div>
          <div>
            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((item) => {
            const p = item.project;
            const isOverdue = p.target_deadline && new Date(p.target_deadline) < new Date() && p.status !== "completed";

            return (
              <div
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Domain & Priority */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-primary truncate max-w-[70%]">
                      {item.primary_domain_name || "General Research"}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                        p.priority === "critical"
                          ? "bg-red-500/10 text-red-600"
                          : p.priority === "high"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-slate-500/10 text-slate-600"
                      }`}
                    >
                      {p.priority}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {p.title}
                  </h3>
                  {p.objective && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                      {p.objective}
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-foreground">{p.progress_percent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${p.progress_percent}%` }}
                    />
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {item.total_tasks} tasks
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {item.linked_papers_count} papers
                    </span>
                  </div>

                  {p.target_deadline && (
                    <div
                      className={`flex items-center gap-1 text-[11px] font-medium ${
                        isOverdue ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(p.target_deadline).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <ProjectCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};
