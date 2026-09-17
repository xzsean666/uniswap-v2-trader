import React from "react";
import { cn } from "@/utils/cn";

export interface CyberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
}

export const CyberStepper: React.FC<CyberStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  suffix,
  className,
  disabled = false,
}) => {
  const handleDecrement = () => {
    if (disabled) return;
    const next = Math.max(min, Math.round((value - step) * 1000) / 1000);
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const next = Math.min(max, Math.round((value + step) * 1000) / 1000);
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      onChange(Math.min(max, Math.max(min, val)));
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center bg-cyber-pillBg border border-slate-700/60 rounded-xl px-2 py-1.5 transition-all focus-within:border-cyber-cyan/60",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="w-7 h-7 rounded-lg text-cyber-cyan hover:bg-cyber-cyan/10 active:bg-cyber-cyan/20 flex items-center justify-center font-bold text-base transition-colors"
        aria-label="Decrease"
      >
        -
      </button>

      <div className="flex items-center px-2">
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          className="w-16 bg-transparent text-center text-cyber-textPrimary font-semibold text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="text-xs text-cyber-textMuted ml-1 select-none">
            {suffix}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="w-7 h-7 rounded-lg text-cyber-cyan hover:bg-cyber-cyan/10 active:bg-cyber-cyan/20 flex items-center justify-center font-bold text-base transition-colors"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
};
