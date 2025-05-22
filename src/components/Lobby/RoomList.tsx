
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

  const handleCreateRoom = () => {
    if (!player) {
      toast({
        title: "Error",
        description: "Please set your name and color before creating a room",
        variant: "destructive"
      });
      return;
    }
    
    if (roomName.trim()) {
      const roomId = createRoom(roomName, parseInt(maxPlayers));
      setCreateDialogOpen(false);
      joinRoom(roomId);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    joinRoom(roomId);
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Game Rooms</h2>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!player}>Create Room</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Game Room</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Room Name</Label>
                <Input
                  id="name"
                  placeholder="Enter room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="players">Max Players</Label>
                <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                  <SelectTrigger id="players">
                    <SelectValue placeholder="Select max players" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Players</SelectItem>
                    <SelectItem value="4">4 Players</SelectItem>
                    <SelectItem value="6">6 Players</SelectItem>
                    <SelectItem value="8">8 Players</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateRoom}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {rooms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No rooms available. Create one to start playing!</p>
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
                  {room.players.length}/{room.maxPlayers} players • {room.status}
                </p>
              </div>
              <Button 
                onClick={() => handleJoinRoom(room.id)}
                disabled={!player || room.players.length >= room.maxPlayers || room.status !== 'waiting'}
              >
                {room.status === 'waiting' ? 'Join' : 'In Progress'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
