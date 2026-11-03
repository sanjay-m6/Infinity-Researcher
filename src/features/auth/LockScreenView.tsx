import React, { useState } from "react";
import { Lock, Unlock, LogOut, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useApp } from "../../context/AppContext";

export const LockScreenView: React.FC = () => {
  const { user, unlockApplication, logoutUser } = useApp();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await unlockApplication(password);
      setPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Lock className="w-6 h-6 stroke-[1.5]" />
            </div>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Application Locked
          </h2>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {user?.username || "Researcher"}
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-2">
            Enter your password to resume your workspace.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to unlock"
              className="w-full pl-3 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-amber-600 hover:bg-amber-500 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {isLoading ? "Unlocking..." : "Unlock Application"}
            <Unlock className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-center">
          <button
            type="button"
            onClick={logoutUser}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch account or Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
