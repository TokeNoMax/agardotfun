
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGame } from "@/context/GameContext";

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  setRoomName: (name: string) => void;
  maxPlayers: string;
  setMaxPlayers: (value: string) => void;
  handleCreateRoom: () => Promise<void>;
  playerExists: boolean;
}

export default function CreateRoomDialog({
  open,
  onOpenChange,
  roomName,
  setRoomName,
  maxPlayers,
  setMaxPlayers,
  handleCreateRoom,
  playerExists
}: CreateRoomDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { refreshCurrentRoom } = useGame();
  
  // Vérifier si le formulaire est valide pour activer le bouton
  const isFormValid = roomName.trim() !== "" && maxPlayers !== "";
  
  // Gérer la création de salle avec validation
  const handleCreateRoomWithValidation = async () => {
    if (!isFormValid) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs requis.",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      await handleCreateRoom();
      
      // Force refresh après création pour garantir que la salle apparaît
      // Augmentation du délai pour donner plus de temps au serveur
      setTimeout(() => {
        refreshCurrentRoom();
      }, 800);
      
      toast({
        title: "Salle créée",
        description: "Votre salle a été créée avec succès.",
      });
      
      // Fermer la modal immédiatement après création réussie
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur lors de la création de la salle:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la salle. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!playerExists}>Créer une salle</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle salle</DialogTitle>
          <DialogDescription>
            Créez votre propre salle de jeu et invitez d'autres joueurs à vous rejoindre
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nom de la salle <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              placeholder="Entrer le nom de la salle"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className={roomName.trim() === "" ? "border-red-300" : ""}
              autoComplete="off"
            />
            {roomName.trim() === "" && (
              <p className="text-sm text-red-500">Le nom de la salle est requis</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="players">Joueurs maximum <span className="text-red-500">*</span></Label>
            <Select value={maxPlayers} onValueChange={setMaxPlayers}>
              <SelectTrigger id="players" className={maxPlayers === "" ? "border-red-300" : ""}>
                <SelectValue placeholder="Sélectionnez le nombre de joueurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Joueurs</SelectItem>
                <SelectItem value="4">4 Joueurs</SelectItem>
                <SelectItem value="6">6 Joueurs</SelectItem>
                <SelectItem value="8">8 Joueurs</SelectItem>
              </SelectContent>
            </Select>
            {maxPlayers === "" && (
              <p className="text-sm text-red-500">Le nombre maximum de joueurs est requis</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={handleCreateRoomWithValidation} 
            disabled={!isFormValid || isCreating}
          >
            {isCreating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Création...
              </>
            ) : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
