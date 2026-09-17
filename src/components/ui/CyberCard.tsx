import React from "react";
import { cn } from "@/utils/cn";

export interface CyberCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: boolean;
}

export const CyberCard: React.FC<CyberCardProps> = ({
  children,
  className,
  glow = true,
  ...props
}) => {
  return (
    <div
      className={cn(
        "bg-cyber-card rounded-2xl border border-cyber-border p-5 text-cyber-textPrimary transition-all",
        glow && "shadow-glowCyan hover:border-cyber-borderHover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
