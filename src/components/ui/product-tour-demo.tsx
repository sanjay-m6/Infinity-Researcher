"use client";

import * as React from "react";
import { Tour, useTour, type TourStep } from "@/components/ui/product-tour";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const STEPS: TourStep[] = [
  {
    title: "Welcome to ReturnSplit",
    content:
      "Take the 30-second tour and we'll show you around. You can leave any time with Esc.",
    placement: "center",
  },
  {
    target: "#tour-new",
    title: "Create anything",
    content: "Start a report, invite a teammate, or open a workflow - all from here.",
    placement: "bottom",
  },
  {
    target: "#tour-search",
    title: "Jump to anything",
    content:
      "Search across projects, people, and docs. Press / from anywhere to focus it.",
    placement: "bottom",
  },
  {
    target: "#tour-revenue",
    title: "Your key metric",
    content:
      "Revenue updates live. Click any card to break it down by source and region.",
    placement: "right",
  },
  {
    target: "#tour-nav-reports",
    title: "Deeper reports live here",
    content: "Saved views, exports, and scheduled email digests are one tap away.",
    placement: "right",
  },
  {
    target: "#tour-avatar",
    title: "You're all set",
    content:
      "Manage your workspace and billing from your profile. That's the whole tour!",
    placement: "bottom",
  },
];

export default function ProductTourDemo() {
  const [dark, setDark] = React.useState(false);
  const tour = useTour();

  React.useEffect(() => {
    const t = window.setTimeout(() => tour.start(), 650);
    return () => window.clearTimeout(t);
  }, [tour.start]);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen overflow-x-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto flex max-w-6xl gap-0 p-3 sm:p-6 md:h-[600px]">
          <aside className="hidden w-56 shrink-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12h5" />
                  <path d="M9 12l7-4.5" />
                  <path d="M9 12l7 4.5" />
                  <circle cx="16.5" cy="7" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="16.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold">ReturnSplit</span>
            </div>

            <nav className="mt-4 flex flex-col gap-0.5">
              <NavItem
                active
                label="Overview"
                path="M3 12h7V3H3zM14 21h7v-9h-7zM14 8h7V3h-7zM3 21h7v-5H3z"
              />
              <NavItem
                id="tour-nav-reports"
                label="Reports"
                path="M4 4h16v4H4zM4 12h10v8H4zM17 12h3v8h-3z"
              />
              <NavItem
                label="Customers"
                path="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"
              />
              <NavItem
                label="Settings"
                path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"
              />
            </nav>

            <button
              onClick={() => tour.start()}
              className="mt-auto rounded-xl border border-zinc-200 px-3 py-2 text-[12.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Replay tour
            </button>
          </aside>

          <main className="min-w-0 flex-1 md:pl-6">
            <header className="flex items-center gap-2 sm:gap-3">
              <div
                id="tour-search"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <svg {...iconProps} className="h-4 w-4 shrink-0">
                  <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
                </svg>
                <span className="truncate text-[13px]">
                  Search projects, people, docs
                </span>
                <kbd className="ml-auto hidden shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-400 dark:border-zinc-700 sm:inline">
                  /
                </kbd>
              </div>

              <button
                id="tour-new"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:px-3.5"
              >
                <svg {...iconProps} className="h-4 w-4" strokeWidth={2}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New
              </button>

              <button
                id="tour-avatar"
                className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
                aria-label="Your profile"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              </button>

              <button
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle theme"
                className="h-9 w-9 shrink-0 rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-white dark:border-zinc-800 dark:hover:bg-zinc-900 flex items-center justify-center text-xs"
              >
                {dark ? "☀" : "☽"}
              </button>
            </header>

            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                id="tour-revenue"
                label="Revenue"
                value="$48,210"
                delta="+12.4%"
                spark
              />
              <StatCard label="Active users" value="3,914" delta="+3.1%" />
              <StatCard label="Churn" value="1.8%" delta="-0.4%" />
            </section>

            <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">Recent activity</h2>
                <span className="text-[12px] text-zinc-400">Last 7 days</span>
              </div>
              <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {ROWS.map((r) => (
                  <div key={r.name} className="flex items-center gap-3 py-2.5">
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={r.avatar}
                        alt={r.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="text-[13px] font-medium">{r.name}</span>
                    <span className="text-[12.5px] text-zinc-400">{r.action}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-zinc-400">
                      {r.time}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>

      <Tour
        steps={STEPS}
        open={tour.open}
        onOpenChange={tour.setOpen}
        index={tour.index}
        onIndexChange={tour.setIndex}
        onFinish={tour.markSeen}
      />
    </div>
  );
}

function NavItem({
  label,
  path,
  active,
  id,
}: {
  label: string;
  path: string;
  active?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
        active
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
      }`}
    >
      <svg {...iconProps} className="h-4 w-4">
        <path d={path} />
      </svg>
      {label}
    </button>
  );
}

function StatCard({
  id,
  label,
  value,
  delta,
  spark,
}: {
  id?: string;
  label: string;
  value: string;
  delta: string;
  spark?: boolean;
}) {
  const up = delta.trim().startsWith("+");
  return (
    <div
      id={id}
      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-[12px] text-zinc-400">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-[22px] font-semibold tracking-tight">{value}</span>
        <span
          className={`text-[12px] font-medium ${up ? "text-zinc-900 dark:text-zinc-200" : "text-zinc-400"}`}
        >
          {delta}
        </span>
      </div>
      {spark && (
        <svg
          viewBox="0 0 120 28"
          className="mt-3 h-7 w-full text-zinc-300 dark:text-zinc-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M0 22 L15 18 L30 20 L45 12 L60 15 L75 8 L90 11 L105 5 L120 7" />
        </svg>
      )}
    </div>
  );
}

const ROWS = [
  {
    name: "laziedev",
    action: "closed a deal",
    time: "2m",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    name: "shiawase",
    action: "invited 3 members",
    time: "18m",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  },
  {
    name: "khushi",
    action: "exported a report",
    time: "1h",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
  },
  {
    name: "kiki",
    action: "created a workflow",
    time: "3h",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
  },
];
