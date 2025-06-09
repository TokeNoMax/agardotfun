
import { useEffect, useState } from "react";

interface ConfettiEffectProps {
  show: boolean;
}

export default function ConfettiEffect({ show }: ConfettiEffectProps) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce opacity-80"></div>
      <div className="absolute top-0 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.2s' }}></div>
      <div className="absolute top-0 left-1/2 w-2 h-2 bg-red-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.4s' }}></div>
      <div className="absolute top-0 left-3/4 w-2 h-2 bg-green-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.6s' }}></div>
      <div className="absolute top-0 right-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce opacity-80" style={{ animationDelay: '0.8s' }}></div>
    </div>
  );
}
