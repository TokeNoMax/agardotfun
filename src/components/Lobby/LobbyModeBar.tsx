
import React from "react";

interface ModeBarProps {
  active: "multiplayer" | "solo";
  onSelect: (mode: "multiplayer" | "solo") => void;
}

export const LobbyModeBar: React.FC<ModeBarProps> = ({ active, onSelect }) => (
  <div className="w-full box-border flex border-2 rounded-lg border-cyber-cyan/70 shadow-[0_0_15px_rgba(0,255,255,0.3)] overflow-hidden bg-black/50 backdrop-blur-sm">
    <button
      onClick={() => onSelect("multiplayer")}
      className={`flex-1 px-3 md:px-2 py-3 text-center transition-all duration-300 font-mono text-lg hover:bg-cyber-cyan/10 ${
        active === "multiplayer" 
          ? "bg-cyber-cyan/20 text-cyber-cyan border-r border-cyber-cyan/50" 
          : "text-gray-400 border-r border-cyber-cyan/30"
      }`}
    >
      <span className="flex items-center justify-center gap-2">
        👥 MULTIPLAYER
      </span>
    </button>
    <button
      onClick={() => onSelect("solo")}
      className={`flex-1 px-3 md:px-2 py-3 text-center transition-all duration-300 font-mono text-lg hover:bg-cyber-magenta/10 ${
        active === "solo" 
          ? "bg-cyber-magenta/20 text-cyber-magenta" 
          : "text-gray-400"
      }`}
    >
      <span className="flex items-center justify-center gap-2">
        👤 SOLO
      </span>
    </button>
  </div>
);
