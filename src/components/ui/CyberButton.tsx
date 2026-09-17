import React from "react";
import { cn } from "@/utils/cn";

export interface CyberButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "gradient" | "outline" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

export const CyberButton: React.FC<CyberButtonProps> = ({
  children,
  className,
  variant = "cyan",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  ...props
}) => {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "rounded-xl font-bold transition-all flex items-center justify-center space-x-2 focus:outline-none select-none",
        size === "sm" && "py-1.5 px-3 text-xs",
        size === "md" && "py-2.5 px-5 text-sm",
        size === "lg" && "py-3 px-6 text-base",
        fullWidth && "w-full",
        variant === "cyan" &&
          "bg-cyber-cyan text-slate-950 hover:bg-cyber-cyanHover active:scale-[0.99] shadow-glowCyan",
        variant === "gradient" &&
          "bg-gradient-to-r from-[#00e5ff] via-[#38bdf8] to-[#ec4899] text-slate-950 font-extrabold hover:brightness-110 active:scale-[0.99] shadow-[0_0_20px_rgba(236,72,153,0.3)]",
        variant === "outline" &&
          "bg-transparent border border-cyber-border text-cyber-cyan hover:bg-cyber-cyan/10 hover:border-cyber-cyan active:scale-[0.99]",
        variant === "danger" &&
          "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]",
        variant === "dark" &&
          "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60",
        disabled &&
          "opacity-40 cursor-not-allowed hover:bg-auto active:scale-100 shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};
