import React from "react";
import { Modal } from "./Modal";
import {
  Bug,
  GitPullRequest,
  ExternalLink,
  Heart,
  Coffee,
} from "lucide-react";
import { GithubIcon } from "./GithubIcon";
import { useApp } from "../../context/AppContext";

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { setActiveSection, openFeedbackCenter } = useApp();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About Infinity Researcher"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <span className="text-slate-400 dark:text-slate-500">
            © 2026 Sanjay. All rights reserved.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                setActiveSection("settings");
              }}
              className="px-3 py-1.5 rounded-lg font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
            >
              Updates & Settings
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="py-1 select-none">
        {/* Open Source & Community */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Open Source & Community
            </span>
            <span className="text-[11px] text-slate-400 font-mono">sanjay-m6/Infinity-Researcher</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* GitHub Repo */}
            <button
              type="button"
              onClick={() =>
                window.open(
                  "https://github.com/sanjay-m6/Infinity-Researcher",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
            >
              <GithubIcon className="w-4 h-4 shrink-0" />
              <span>GitHub Repo</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            {/* Contribute */}
            <button
              type="button"
              onClick={() =>
                window.open(
                  "https://github.com/sanjay-m6/Infinity-Researcher",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium transition-colors cursor-pointer"
            >
              <GitPullRequest className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Contribute</span>
              <ExternalLink className="w-3 h-3 text-indigo-400" />
            </button>

            {/* Report a Bug */}
            <button
              type="button"
              onClick={() => {
                onClose();
                openFeedbackCenter("bug");
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-medium transition-colors cursor-pointer"
            >
              <Bug className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Report Bug</span>
            </button>
          </div>
        </div>

        {/* Support & Donations */}
        <div className="mt-3 p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-gradient-to-r from-rose-50/60 via-purple-50/40 to-indigo-50/60 dark:from-rose-950/20 dark:via-purple-950/20 dark:to-indigo-950/20 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-current animate-pulse" />
              <span>Support & Donations</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Back sovereign scientific software</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Ko-fi */}
            <button
              type="button"
              onClick={() =>
                window.open("https://ko-fi.com/infinity86", "_blank", "noopener,noreferrer")
              }
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <Coffee className="w-4 h-4 text-[#ff5f5f] shrink-0" />
              <span>Ko-fi</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>

            {/* PayPal */}
            <button
              type="button"
              onClick={() =>
                window.open("https://paypal.me/infinity86s?locale.x=en_GB&country.x=IN", "_blank", "noopener,noreferrer")
              }
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <ExternalLink className="w-3 h-3 text-[#0079c1]" />
              <span>PayPal</span>
            </button>

            {/* GitHub Sponsors */}
            <button
              type="button"
              onClick={() =>
                window.open("https://github.com/sponsors/sanjay-m6", "_blank", "noopener,noreferrer")
              }
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <Heart className="w-4 h-4 fill-current text-rose-500 shrink-0" />
              <span>GitHub Sponsors</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
