
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface CountdownTimerProps {
  isActive: boolean;
  onComplete: () => void;
}

export default function CountdownTimer({ isActive, onComplete }: CountdownTimerProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (isActive) {
      setCountdown(10); // Reset countdown when activated
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Time's up, trigger completion
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isActive, onComplete]);

  return (
    <div className="text-center py-4 border-t border-border">
      <p className="text-sm text-muted-foreground mb-2">
        Retour automatique au lobby dans :
      </p>
      <div className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
        <Clock className="w-5 h-5" />
        {countdown}s
      </div>
    </div>
  );
}
