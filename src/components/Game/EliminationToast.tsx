import React from "react";
import { Skull, Target, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface EliminationToastProps {
  type: 'absorption' | 'zone' | 'bot';
  eliminatedName: string;
  eliminatorName?: string;
  isPlayerInvolved: boolean;
  isPlayerEliminated: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'absorption':
      return Target;
    case 'zone':
      return Zap;
    case 'bot':
      return Skull;
    default:
      return Shield;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'absorption':
      return 'text-cyber-cyan';
    case 'zone':
      return 'text-cyber-orange';
    case 'bot':
      return 'text-cyber-magenta';
    default:
      return 'text-cyber-green';
  }
};

export const EliminationToast: React.FC<EliminationToastProps> = ({
  type,
  eliminatedName,
  eliminatorName,
  isPlayerInvolved,
  isPlayerEliminated
}) => {
  const Icon = getIcon(type);
  const colorClass = getTypeColor(type);
  
  return (
    <div className={cn(
      "flex items-center space-x-3 font-mono text-sm"
    )}>
      <div className={cn(
        "flex-shrink-0 p-2 rounded-full border",
        colorClass,
        `border-current shadow-[0_0_10px_currentColor]`
      )}>
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        {type === 'absorption' && eliminatorName ? (
          <div className="space-y-1">
            <div className={cn(
              "font-bold uppercase tracking-wider",
              isPlayerEliminated ? "text-cyber-magenta" : 
              isPlayerInvolved ? "text-cyber-green" : "text-foreground"
            )}>
              {isPlayerEliminated ? "ÉLIMINÉ" : isPlayerInvolved ? "KILL" : "ÉLIMINATION"}
            </div>
            <div className="text-xs opacity-80">
              <span className={cn(
                isPlayerEliminated && eliminatedName.includes("Vous") ? "text-cyber-magenta font-bold" : ""
              )}>
                {eliminatedName}
              </span>
              <span className="text-muted-foreground mx-1">⚡</span>
              <span className={cn(
                isPlayerInvolved && eliminatorName.includes("Vous") ? "text-cyber-green font-bold" : ""
              )}>
                {eliminatorName}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className={cn(
              "font-bold uppercase tracking-wider",
              type === 'zone' ? "text-cyber-orange" : "text-cyber-magenta"
            )}>
              {type === 'zone' ? "ZONE MORTELLE" : "ÉLIMINÉ"}
            </div>
            <div className="text-xs opacity-80">
              <span className={cn(
                isPlayerEliminated ? "text-cyber-magenta font-bold" : ""
              )}>
                {eliminatedName}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className={cn(
        "text-xs font-bold uppercase tracking-widest opacity-60 animate-terminal-blink",
        colorClass
      )}>
        ●
      </div>
    </div>
  );
};