
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { useNavigate } from "react-router-dom";
import { GameRoom } from "@/types/game";

interface CurrentRoomProps {
  currentRoom: GameRoom;
  countdown: number | null;
  gameStarting: boolean;
  handleToggleReady: () => Promise<void>;
  handleStartGame: () => Promise<void>;
  handleLeaveRoom: () => Promise<void>;
  handleJoinGame: () => void;
  handleJoinRoom: (roomId: string) => Promise<void>;
  isCurrentPlayerReady: () => boolean;
  isCurrentPlayerInRoom: () => boolean;
}

export default function CurrentRoom({
  currentRoom,
  countdown,
  gameStarting,
  handleToggleReady,
  handleStartGame,
  handleLeaveRoom,
  handleJoinGame,
  handleJoinRoom,
  isCurrentPlayerReady,
  isCurrentPlayerInRoom
}: CurrentRoomProps) {
  
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">{currentRoom.name}</h3>
          <p className="text-gray-600">
            {currentRoom.players && currentRoom.players.length}/{currentRoom.maxPlayers} joueurs • {currentRoom.status === 'waiting' ? 'En attente' : currentRoom.status === 'playing' ? 'En cours' : 'Terminé'}
          </p>
          {countdown !== null && (
            <p className="text-lg font-bold text-green-600 mt-2">
              Démarrage dans {countdown} secondes...
            </p>
          )}
          {gameStarting && currentRoom.status === 'playing' && (
            <p className="text-lg font-bold text-green-600 mt-2">
              La partie est prête ! Cliquez sur "Rejoindre la partie" pour commencer.
            </p>
          )}
          <div className="mt-2">
            <p className="text-sm font-medium">Joueurs:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {currentRoom.players && currentRoom.players.map(player => (
                <span 
                  key={player.id} 
                  className={`px-2 py-1 rounded text-sm ${player.ready ? 'bg-green-100 text-green-800' : 'bg-white'}`}
                >
                  {player.name} {player.ready ? '✓' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {isCurrentPlayerInRoom() ? (
            <>
              <Button 
                onClick={handleToggleReady}
                className="w-full"
                variant={isCurrentPlayerReady() ? "outline" : "default"}
                disabled={gameStarting}
              >
                {isCurrentPlayerReady() ? "Annuler prêt" : "Je suis prêt"}
              </Button>
              
              {gameStarting && currentRoom.status === 'playing' ? (
                <Button 
                  onClick={handleJoinGame}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Rejoindre la partie
                </Button>
              ) : (
                <Button 
                  onClick={handleStartGame}
                  disabled={currentRoom.status !== 'waiting' || !currentRoom.players || currentRoom.players.length < 2 || !isCurrentPlayerReady() || gameStarting}
                  className="w-full"
                >
                  Démarrer la partie
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={handleLeaveRoom}
                className="w-full"
                disabled={gameStarting}
              >
                Quitter la salle
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => handleJoinRoom(currentRoom.id)}
              disabled={!currentRoom.players || currentRoom.players.length >= currentRoom.maxPlayers || currentRoom.status !== 'waiting'}
              className="w-full"
            >
              Rejoindre la salle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
