import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SupportDonationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface SupportLink {
  name: string;
  url: string;
  logo: React.ReactNode;
  colorClass: string;
}

const SUPPORT_LINKS: SupportLink[] = [
  {
    name: "Ko-fi",
    url: "https://ko-fi.com/infinity86",
    logo: (
      <svg
        className="w-[18px] h-[18px] fill-current flex-shrink-0 mr-1.5"
        viewBox="0 0 24 24"
      >
        <path d="M23.881 8.948c-.24-.53-1.096-1.554-3.111-1.554H20V6.657C20 2.98 17.02 0 13.343 0H3.314C1.483 0 0 1.483 0 3.314v13.371C0 18.516 1.483 20 3.314 20h10.029c3.677 0 6.657-2.98 6.657-6.657v-1.129h.781c2.185 0 3.411-1.082 3.822-2.128.468-1.189.289-2.023-.722-2.138zm-3.881 1.266h-.781V8.608H20c1.375 0 1.834.619 1.942 1.002.146.521-.082 1.604-1.942 1.604zM13.343 18H3.314C2.589 18 2 17.411 2 16.686V3.314C2 2.589 2.589 2 3.314 2h10.029C15.922 2 18 4.078 18 6.657v6.686c0 2.579-2.078 4.657-4.657 4.657zm-.654-7.485c-.917-.917-2.404-.917-3.321 0L8.5 11.383l-.868-.868c-.917-.917-2.404-.917-3.321 0-.917.917-.917 2.404 0 3.321l4.189 4.189 4.189-4.189c.917-.917.917-2.404 0-3.321z" />
      </svg>
    ),
    colorClass:
      "bg-[#ff5f5f] hover:bg-[#ff4a4a] text-white shadow-lg shadow-red-500/15 hover:shadow-red-500/25",
  },
  {
    name: "PayPal",
    url: "https://paypal.me/infinity86s?locale.x=en_GB&country.x=IN",
    logo: (
      <svg
        className="w-[18px] h-[18px] fill-current flex-shrink-0 mr-1.5"
        viewBox="0 0 24 24"
      >
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.78.78 0 0 1 .77-.655h6.643c3.084 0 5.483.743 6.452 2.923.636 1.433.455 3.398-.553 4.954-1.258 1.943-3.34 2.895-6.19 2.895H9.684a.884.884 0 0 0-.872.748l-.872 5.518a.64.64 0 0 1-.633.541l-.231-.307z" />
      </svg>
    ),
    colorClass:
      "bg-[#0079c1] hover:bg-[#006cae] text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25",
  },
  {
    name: "GitHub",
    url: "https://github.com/sponsors/sanjay-m6",
    logo: (
      <svg
        className="w-[15px] h-[15px] fill-current flex-shrink-0 mr-1.5"
        viewBox="0 0 24 24"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
        />
      </svg>
    ),
    colorClass:
      "bg-[#24292e] hover:bg-[#1c2024] text-white shadow-lg shadow-black/20 hover:shadow-black/30",
  },
];

export const SupportDonationModal: React.FC<SupportDonationModalProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);

  // Determine whether modal is shown either through props or self-triggered timer
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  useEffect(() => {
    // In test environment, skip timer check
    if (
      (typeof process !== "undefined" &&
        (process.env?.NODE_ENV === "test" || process.env?.VITEST)) ||
      (typeof window !== "undefined" &&
        Boolean(
          (window as unknown as { __VITEST_ENVIRONMENT__?: unknown })
            .__VITEST_ENVIRONMENT__
        ))
    ) {
      return;
    }

    const checkInterval = 60000; // Check every 60 seconds

    const checkTimer = () => {
      const lastTimeStr = localStorage.getItem("lastDonationAlertTime");
      if (!lastTimeStr) {
        // First-time running the application: set initial timestamp to now
        localStorage.setItem("lastDonationAlertTime", Date.now().toString());
        return;
      }

      const lastTime = parseInt(lastTimeStr, 10);
      if (isNaN(lastTime)) {
        localStorage.setItem("lastDonationAlertTime", Date.now().toString());
        return;
      }

      const elapsed = Date.now() - lastTime;
      // Trigger popup if elapsed time is >= 3 hours
      if (elapsed >= 3 * 60 * 60 * 1000) {
        setInternalIsOpen(true);
      }
    };

    // Run initial check
    checkTimer();

    const intervalId = setInterval(checkTimer, checkInterval);
    return () => clearInterval(intervalId);
  }, []);

  const handleClose = () => {
    setInternalIsOpen(false);
    controlledOnClose?.();
    // Reset the 3-hour timer in localStorage
    localStorage.setItem("lastDonationAlertTime", Date.now().toString());
  };

  const handleActionClick = async (url: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("plugin:opener|open_url", { url });
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    // Also reset the 3-hour timer on click
    handleClose();
  };

  // Global custom event helper for testing/triggering manually
  useEffect(() => {
    const triggerTestDonationAlert = () => {
      setInternalIsOpen(true);
    };
    window.addEventListener("test-donation-alert", triggerTestDonationAlert);
    return () =>
      window.removeEventListener("test-donation-alert", triggerTestDonationAlert);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md cursor-default"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className={cn(
              "relative w-full max-w-md bg-white dark:bg-[#0c111d] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden",
              "flex flex-col items-center p-6 sm:p-8 text-center z-10"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative Top Highlight */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-rose-500/15 via-rose-500/5 to-transparent pointer-events-none" />

            {/* Top close button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Heart Icon Container */}
            <div className="relative mt-2 mb-4">
              <div className="absolute inset-0 bg-rose-500/25 rounded-full blur-lg animate-pulse" />
              <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-inner">
                <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
              </div>
            </div>

            {/* Title & Subtitle */}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Support the Development
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 mb-6 leading-relaxed">
              Infinity Researcher is free and open-source. If it helps your academic
              workflow, please consider a small contribution to support ongoing updates
              and features.
            </p>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-3 gap-3 w-full mb-4">
              {SUPPORT_LINKS.map((link) => (
                <button
                  key={link.name}
                  type="button"
                  onClick={() => handleActionClick(link.url)}
                  className={cn(
                    "flex items-center justify-center px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-300",
                    "hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer",
                    link.colorClass
                  )}
                >
                  {link.logo}
                  <span>{link.name}</span>
                </button>
              ))}
            </div>

            {/* Remind Me Later Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-sky-500/40 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
            >
              Remind Me Later
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
