
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
  );
}
