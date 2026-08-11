import type { ComponentType } from "react";
import { HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
  size?: "default" | "sm";
  icon?: ComponentType<{ className?: string }>;
  iconBgClassName?: string;
  iconColorClassName?: string;
}

export function StatCard({
  label,
  value,
  color = "text-foreground",
  tooltip,
  size = "default",
  icon: Icon,
  iconBgClassName = "bg-primary/10",
  iconColorClassName = "text-primary",
}: StatCardProps) {
  const isSm = size === "sm";

  if (Icon) {
    return (
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                iconBgClassName
              )}
            >
              <Icon className={cn("w-5 h-5", iconColorClassName)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("figure text-lg font-semibold", color)}>
                {value}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="stat-card">
      <CardContent className={isSm ? "p-3" : "p-4 text-center"}>
        <div
          className={cn(
            "flex items-center gap-1 mb-1",
            isSm ? "" : "justify-center"
          )}
        >
          <p
            className={cn(
              "text-muted-foreground uppercase tracking-wider",
              isSm ? "text-[10px]" : "text-[11px]"
            )}
          >
            {label}
          </p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className={isSm ? "max-w-[200px]" : undefined}>
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p
          className={cn(
            "figure font-semibold",
            isSm ? "text-lg" : "text-xl",
            color
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
