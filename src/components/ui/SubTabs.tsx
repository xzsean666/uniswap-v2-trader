import { cn } from "@/utils/cn";

export interface SubTabOption<T extends string> {
  id: T;
  label: string;
}

export interface SubTabsProps<T extends string> {
  options: SubTabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

export function SubTabs<T extends string>({
  options,
  activeId,
  onChange,
  className,
}: SubTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center space-x-6 overflow-x-auto no-scrollbar py-2",
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = activeId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "text-sm font-semibold transition-colors pb-1 relative whitespace-nowrap",
              isActive
                ? "text-cyber-cyan text-shadow-[0_0_10px_rgba(0,229,255,0.5)]"
                : "text-cyber-textMuted hover:text-slate-200",
            )}
          >
            <span>{opt.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyber-cyan rounded-full shadow-glowCyan" />
            )}
          </button>
        );
      })}
    </div>
  );
}
