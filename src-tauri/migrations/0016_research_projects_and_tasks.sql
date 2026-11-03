-- Migration 0016: Research Project Planning, To-Do Tasks, Hierarchical Domains, and Paper Links
-- Infinity Researcher: Complete AI-Powered Research Workspace

-- 1. Research Domains Taxonomy
CREATE TABLE IF NOT EXISTS research_domains (
    id TEXT PRIMARY KEY,
    parent_id TEXT NULL REFERENCES research_domains(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_domains_parent ON research_domains(parent_id);
CREATE INDEX IF NOT EXISTS idx_research_domains_slug ON research_domains(slug);

-- 2. Research Projects
CREATE TABLE IF NOT EXISTS research_projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    objective TEXT,
    research_questions TEXT, -- Multiline or JSON array of questions
    hypotheses TEXT,
    expected_outcomes TEXT,
    primary_domain_id TEXT REFERENCES research_domains(id) ON DELETE SET NULL,
    subdomain_id TEXT REFERENCES research_domains(id) ON DELETE SET NULL,
    custom_domain_text TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived', 'on_hold'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    progress_percent REAL NOT NULL DEFAULT 0.0,
    start_date TEXT,
    target_deadline TEXT,
    completed_at TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    template_type TEXT, -- 'literature_review', 'thesis', 'experimental_ml', 'custom', etc.
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON research_projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON research_projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON research_projects(target_deadline);
CREATE INDEX IF NOT EXISTS idx_projects_domain ON research_projects(primary_domain_id);

-- 3. Project Milestones
CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_proj ON project_milestones(project_id);

-- 4. Project Tasks & To-Dos
CREATE TABLE IF NOT EXISTS project_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES research_projects(id) ON DELETE CASCADE,
    parent_task_id TEXT REFERENCES project_tasks(id) ON DELETE CASCADE,
    milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    phase TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'literature_review', 'methodology', 'experimentation', 'writing', 'review'
    status TEXT NOT NULL DEFAULT 'todo', -- 'backlog', 'todo', 'in_progress', 'blocked', 'completed', 'cancelled'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    start_date TEXT,
    due_date TEXT,
    completed_at TEXT,
    estimated_hours REAL,
    actual_hours REAL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    completion_notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON project_tasks(due_date);

-- 5. Task Dependencies (Prerequisites)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    depends_on_task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
    created_at TEXT NOT NULL,
    UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON task_dependencies(depends_on_task_id);

-- 6. Project-Paper Relationships
CREATE TABLE IF NOT EXISTS project_papers (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'reference', -- 'primary', 'background', 'methodology', 'baseline', 'reference'
    notes TEXT,
    added_at TEXT NOT NULL,
    UNIQUE(project_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_project_papers_proj ON project_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_papers_paper ON project_papers(paper_id);

-- 7. Task-Paper Relationships
CREATE TABLE IF NOT EXISTS task_papers (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    notes TEXT,
    added_at TEXT NOT NULL,
    UNIQUE(task_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_task_papers_task ON task_papers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_papers_paper ON task_papers(paper_id);

-- 8. Task Reminders
CREATE TABLE IF NOT EXISTS task_reminders (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    remind_at TEXT NOT NULL,
    is_dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_time ON task_reminders(remind_at);

-- 9. Project Activity / Audit Stream
CREATE TABLE IF NOT EXISTS project_activity (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'project_created', 'plan_generated', 'task_created', 'task_completed', 'paper_linked'
    title TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_activity_proj ON project_activity(project_id);

-- 10. Seed Initial Hierarchical Domain Taxonomy
INSERT OR IGNORE INTO research_domains (id, parent_id, name, slug, description, icon, color, is_custom, created_at, updated_at) VALUES
-- Main Categories
('dom_cs', NULL, 'Computer Science', 'computer-science', 'Computing, algorithms, intelligent systems, software architecture', 'Cpu', '#4f46e5', 0, datetime('now'), datetime('now')),
('dom_eng', NULL, 'Engineering', 'engineering', 'Mechanical, electrical, civil, and specialized engineering disciplines', 'Wrench', '#0891b2', 0, datetime('now'), datetime('now')),
('dom_math', NULL, 'Mathematics', 'mathematics', 'Pure and applied mathematics, statistics, optimization', 'Binary', '#059669', 0, datetime('now'), datetime('now')),
('dom_life', NULL, 'Medicine and Life Sciences', 'medicine-life-sciences', 'Biomedicine, computational biology, clinical trials, pharmacology', 'Activity', '#dc2626', 0, datetime('now'), datetime('now')),
('dom_biz', NULL, 'Business and Economics', 'business-economics', 'Quantitative finance, micro/macro economics, business analytics', 'TrendingUp', '#d97706', 0, datetime('now'), datetime('now')),
('dom_inter', NULL, 'Interdisciplinary Research', 'interdisciplinary', 'Cross-cutting fields combining computing with domain science', 'Sparkles', '#7c3aed', 0, datetime('now'), datetime('now')),

-- Computer Science Subdomains
('sub_cs_ai', 'dom_cs', 'Artificial Intelligence', 'artificial-intelligence', 'Foundational AI architectures, agents, symbolic AI', 'Bot', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_ml', 'dom_cs', 'Machine Learning', 'machine-learning', 'Deep learning, reinforcement learning, statistical learning', 'BrainCircuit', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_nlp', 'dom_cs', 'Natural Language Processing', 'natural-language-processing', 'LLMs, semantic parsing, information extraction, speech', 'MessageSquare', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_cv', 'dom_cs', 'Computer Vision', 'computer-vision', 'Visual recognition, 3D reconstruction, diffusion vision models', 'Eye', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_sec', 'dom_cs', 'Cybersecurity', 'cybersecurity', 'Cryptographic protocols, system security, adversarial robustness', 'Shield', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_se', 'dom_cs', 'Software Engineering', 'software-engineering', 'Formal methods, developer tooling, software testing', 'Code2', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_dist', 'dom_cs', 'Distributed Systems', 'distributed-systems', 'Cloud computing, consensus algorithms, database engines', 'Server', '#4f46e5', 0, datetime('now'), datetime('now')),
('sub_cs_db', 'dom_cs', 'Databases & Information Systems', 'databases-info-systems', 'Query engines, indexing, vector databases, knowledge graphs', 'Database', '#4f46e5', 0, datetime('now'), datetime('now')),

-- Engineering Subdomains
('sub_eng_ce', 'dom_eng', 'Computer Engineering', 'computer-engineering', 'Hardware architectures, accelerators, FPGA/ASIC design', 'Cpu', '#0891b2', 0, datetime('now'), datetime('now')),
('sub_eng_elec', 'dom_eng', 'Electronics', 'electronics', 'Analog/digital circuits, semiconductor physics, signal processing', 'Zap', '#0891b2', 0, datetime('now'), datetime('now')),
('sub_eng_robot', 'dom_eng', 'Robotics & Control', 'robotics-control', 'Kinematics, autonomous navigation, sensor fusion', 'Cog', '#0891b2', 0, datetime('now'), datetime('now')),
('sub_eng_mech', 'dom_eng', 'Mechanical Engineering', 'mechanical-engineering', 'Thermal dynamics, fluid dynamics, structural mechanics', 'Wrench', '#0891b2', 0, datetime('now'), datetime('now')),
('sub_eng_civil', 'dom_eng', 'Civil Engineering', 'civil-engineering', 'Smart infrastructure, transportation systems, materials', 'Building', '#0891b2', 0, datetime('now'), datetime('now')),
('sub_eng_bme', 'dom_eng', 'Biomedical Engineering', 'biomedical-engineering', 'Medical instrumentation, biosensors, neurotechnology', 'HeartPulse', '#0891b2', 0, datetime('now'), datetime('now')),

-- Mathematics Subdomains
('sub_math_alg', 'dom_math', 'Algebra & Geometry', 'algebra-geometry', 'Abstract algebra, algebraic geometry, number theory', 'Sigma', '#059669', 0, datetime('now'), datetime('now')),
('sub_math_stat', 'dom_math', 'Statistics & Probability', 'statistics-probability', 'Bayesian inference, stochastic processes, hypothesis testing', 'BarChart', '#059669', 0, datetime('now'), datetime('now')),
('sub_math_opt', 'dom_math', 'Optimization', 'optimization', 'Convex optimization, non-linear programming, discrete optimization', 'Maximize2', '#059669', 0, datetime('now'), datetime('now')),
('sub_math_app', 'dom_math', 'Applied Mathematics', 'applied-mathematics', 'Differential equations, dynamical systems, numerical analysis', 'Calculator', '#059669', 0, datetime('now'), datetime('now')),

-- Medicine & Life Sciences Subdomains
('sub_life_bioinf', 'dom_life', 'Bioinformatics', 'bioinformatics', 'Genomics, sequence alignment, protein folding algorithms', 'Dna', '#dc2626', 0, datetime('now'), datetime('now')),
('sub_life_compbio', 'dom_life', 'Computational Biology', 'computational-biology', 'Cellular modeling, metabolic networks, evolutionary dynamics', 'Microscope', '#dc2626', 0, datetime('now'), datetime('now')),
('sub_life_biomed', 'dom_life', 'Biomedical Research', 'biomedical-research', 'Translational medicine, oncology, pathology, pharmacology', 'Activity', '#dc2626', 0, datetime('now'), datetime('now')),

-- Business & Economics Subdomains
('sub_biz_fin', 'dom_biz', 'Finance', 'finance', 'Algorithmic trading, portfolio theory, risk modeling', 'DollarSign', '#d97706', 0, datetime('now'), datetime('now')),
('sub_biz_econ', 'dom_biz', 'Economics', 'economics', 'Econometrics, game theory, behavioral economics', 'TrendingUp', '#d97706', 0, datetime('now'), datetime('now')),
('sub_biz_analytics', 'dom_biz', 'Business Analytics', 'business-analytics', 'Operations research, supply chain optimization, decision science', 'PieChart', '#d97706', 0, datetime('now'), datetime('now')),

-- Interdisciplinary Subdomains
('sub_inter_health', 'dom_inter', 'AI in Healthcare', 'ai-in-healthcare', 'Clinical decision support, medical imaging, drug discovery', 'Cross', '#7c3aed', 0, datetime('now'), datetime('now')),
('sub_inter_edu', 'dom_inter', 'AI in Education', 'ai-in-education', 'Intelligent tutoring systems, adaptive learning, assessment', 'GraduationCap', '#7c3aed', 0, datetime('now'), datetime('now')),
('sub_inter_green', 'dom_inter', 'Sustainable Computing', 'sustainable-computing', 'Energy-efficient AI, carbon modeling, green cloud architectures', 'Leaf', '#7c3aed', 0, datetime('now'), datetime('now'));

