import React from "react";
import { cn } from "@/utils/cn";

export interface CyberSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  id?: string;
}

export const CyberSwitch: React.FC<CyberSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  className,
  size = "md",
  id,
}) => {
  const isSm = size === "sm";

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none",
        isSm ? "h-5 w-9" : "h-6 w-11",
        checked
          ? "bg-cyber-cyan shadow-[0_0_10px_rgba(0,229,255,0.4)]"
          : "bg-slate-700 hover:bg-slate-600",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block transform rounded-full bg-white transition-transform shadow-md",
          isSm ? "h-3.5 w-3.5" : "h-4.5 w-4.5",
          isSm
            ? checked
              ? "translate-x-4.5"
              : "translate-x-1"
            : checked
              ? "translate-x-5.5"
              : "translate-x-1",
        )}
      />
    </button>
  );
};
