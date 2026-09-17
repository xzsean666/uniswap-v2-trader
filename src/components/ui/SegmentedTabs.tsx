import { cn } from "@/utils/cn";

export interface TabOption<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
}

export interface SegmentedTabsProps<T extends string> {
  options: TabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

export function SegmentedTabs<T extends string>({
  options,
  activeId,
  onChange,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center bg-[#111927] border border-slate-700/60 rounded-xl p-1 gap-1",
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
              "flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all text-center flex items-center justify-center space-x-1.5",
              isActive
                ? "bg-cyber-cyan text-slate-950 shadow-[0_0_12px_rgba(0,229,255,0.4)]"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60",
            )}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isActive
                    ? "bg-slate-950 text-cyber-cyan"
                    : "bg-slate-700 text-slate-300",
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
