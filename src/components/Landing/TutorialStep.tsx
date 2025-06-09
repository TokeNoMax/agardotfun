
import React from 'react';

interface TutorialStepProps {
  number: string;
  color: string;
  children: React.ReactNode;
  isMobile?: boolean;
}

export default function TutorialStep({ number, color, children, isMobile = false }: TutorialStepProps) {
  const sizeClasses = isMobile ? 'w-6 h-6 text-xs' : 'w-8 h-8';
  const shadowClass = `shadow-[0_0_10px_rgba(${color === 'cyber-yellow' ? '255,255,0' : 
                                              color === 'cyber-cyan' ? '0,255,255' : 
                                              color === 'cyber-magenta' ? '255,0,255' : 
                                              '0,255,0'},0.5)]`;

  return (
    <div className="flex items-start">
      <div className={`bg-${color} text-black font-bold font-mono rounded ${sizeClasses} flex items-center justify-center mr-3 flex-shrink-0 ${shadowClass}`}>
        {number}
      </div>
      <p className={`text-gray-300 font-mono ${isMobile ? 'text-xs' : ''}`}>
        {children}
      </p>
    </div>
  );
}
