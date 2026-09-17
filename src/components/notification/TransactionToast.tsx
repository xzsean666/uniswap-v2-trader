import React from "react";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Clock,
  ShieldCheck,
} from "lucide-react";

export type ToastStatus =
  | "approving"
  | "broadcasting"
  | "pending"
  | "success"
  | "failed";

export interface TransactionToastProps {
  status: ToastStatus;
  title: string;
  message?: string;
  txHash?: string;
  onClose: () => void;
}

export const TransactionToast: React.FC<TransactionToastProps> = ({
  status,
  title,
  message,
  txHash,
  onClose,
}) => {
  const getIcon = () => {
    switch (status) {
      case "approving":
        return <ShieldCheck className="w-5 h-5 text-amber-400 animate-pulse" />;
      case "broadcasting":
      case "pending":
        return <Loader2 className="w-5 h-5 text-cyber-cyan animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-rose-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case "approving":
        return "border-amber-500/50 shadow-amber-950/40";
      case "broadcasting":
      case "pending":
        return "border-cyber-cyan/60 shadow-cyan-950/40";
      case "success":
        return "border-emerald-500/60 shadow-emerald-950/40";
      case "failed":
        return "border-rose-500/60 shadow-rose-950/40";
      default:
        return "border-slate-800";
    }
  };

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 max-w-sm w-full bg-cyber-bg/95 border rounded-xl p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${getBorderColor()}`}
    >
      <div className="flex items-start justify-between space-x-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="shrink-0 mt-0.5">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-100 truncate">
              {title}
            </h4>
            {message && (
              <p className="text-[11px] text-cyber-textMuted mt-0.5 leading-relaxed break-words">
                {message}
              </p>
            )}

            {txHash && (
              <a
                href={`https://testnet.bscscan.com/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 mt-2 text-[11px] text-cyber-cyan hover:underline font-mono"
              >
                <span>
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          aria-label="Close Notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
