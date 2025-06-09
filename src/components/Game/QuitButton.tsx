
import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";

interface QuitButtonProps {
  isLocalMode: boolean;
}

export default function QuitButton({ isLocalMode }: QuitButtonProps) {
  const navigate = useNavigate();
  const { leaveRoom } = useGame();
  const [isQuitting, setIsQuitting] = useState(false);

  const handleQuit = async () => {
    setIsQuitting(true);
    
    try {
      if (!isLocalMode) {
        // In multiplayer mode, leave the room first
        await leaveRoom();
        navigate('/lobby');
      } else {
        // In solo mode, go directly to home
        navigate('/');
      }
    } catch (error) {
      console.error("Error quitting game:", error);
      // Navigate anyway to prevent being stuck
      navigate(isLocalMode ? '/' : '/lobby');
    } finally {
      setIsQuitting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
          disabled={isQuitting}
        >
          <LogOut className="w-4 h-4" />
          Quitter
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quitter la partie ?</AlertDialogTitle>
          <AlertDialogDescription>
            {isLocalMode 
              ? "Êtes-vous sûr de vouloir quitter la partie ? Votre progression sera perdue."
              : "Êtes-vous sûr de vouloir quitter la partie ? Cela affectera les autres joueurs."
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleQuit} disabled={isQuitting}>
            {isQuitting ? "Fermeture..." : "Quitter"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
