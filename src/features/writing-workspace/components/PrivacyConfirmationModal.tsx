import React from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { ShieldAlert, CloudOff, Globe, Lock } from "lucide-react";
import { WritingProviderConfig } from "../types";

interface PrivacyConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  provider: WritingProviderConfig | null;
}

export const PrivacyConfirmationModal: React.FC<PrivacyConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  provider,
}) => {
  if (!provider) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Transmission & Remote AI Privacy Notice"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            <CloudOff className="w-3.5 h-3.5 mr-1" />
            Stay 100% Local (Cancel)
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Globe className="w-3.5 h-3.5 mr-1" />I Understand, Send to {provider.name}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Text Will Leave This Device</h4>
            <p className="leading-relaxed">
              You selected <strong>{provider.name}</strong>. Unlike our Local Heuristic
              Engine and local Ollama runtime, this provider runs on a remote cloud
              server.
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <h5 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
            Data Flow & Security Details
          </h5>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <strong>Transport Security:</strong> Text is encrypted in transit using
                TLS 1.3 to the external endpoint.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <strong>Scope:</strong> Only the manuscript text currently loaded in the
                editor is dispatched for stylistic transformation.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CloudOff className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Local Footprint:</strong> If your manuscript contains
                sensitive, unpatented IP or restricted patient data, choose{" "}
                <em>Local Heuristic Engine</em> or <em>Local Ollama</em> instead.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
