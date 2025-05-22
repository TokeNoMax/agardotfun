
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGame } from "@/context/GameContext";
import { useToast } from "@/components/ui/use-toast";

export default function RoomList() {
  const { rooms, createRoom, joinRoom, player } = useGame();
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleCreateRoom = async () => {
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez définir votre nom et votre couleur avant de créer une salle",
        variant: "destructive"
      });
      return;
    }
    
    if (roomName.trim()) {
      try {
        const roomId = await createRoom(roomName, parseInt(maxPlayers));
        setCreateDialogOpen(false);
        await joinRoom(roomId);
      } catch (error) {
        console.error("Error creating room:", error);
      }
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    await joinRoom(roomId);
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Salles de jeu</h2>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!player}>Créer une salle</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle salle</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom de la salle</Label>
                <Input
                  id="name"
                  placeholder="Entrer le nom de la salle"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="players">Joueurs maximum</Label>
                <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                  <SelectTrigger id="players">
                    <SelectValue placeholder="Sélectionnez le nombre de joueurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Joueurs</SelectItem>
                    <SelectItem value="4">4 Joueurs</SelectItem>
                    <SelectItem value="6">6 Joueurs</SelectItem>
                    <SelectItem value="8">8 Joueurs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateRoom}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {rooms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Aucune salle disponible. Créez-en une pour commencer à jouer !</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50 transition-colors"
            >
              <div>
                <h3 className="font-medium">{room.name}</h3>
                <p className="text-sm text-gray-500">
                  {room.players.length}/{room.maxPlayers} joueurs • {room.status === 'waiting' ? 'En attente' : room.status === 'playing' ? 'En cours' : 'Terminé'}
                </p>
              </div>
              <Button 
                onClick={() => handleJoinRoom(room.id)}
                disabled={!player || room.players.length >= room.maxPlayers || room.status !== 'waiting'}
              >
                {room.status === 'waiting' ? 'Rejoindre' : 'En cours'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
