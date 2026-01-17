import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, Server, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface ConnectionLog {
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export default function WebSocketTest() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

  const addLog = useCallback((type: ConnectionLog['type'], message: string) => {
    setLogs(prev => [...prev.slice(-19), { timestamp: new Date(), type, message }]);
  }, []);

  const testConnection = useCallback(async () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    setIsConnecting(true);
    setLogs([]);
    addLog('info', `Connexion à ${wsUrl}...`);

    try {
      const newSocket = io(wsUrl, {
        transports: ['websocket'],
        timeout: 10000,
        reconnection: false,
        forceNew: true
      });

      const connectionTimeout = setTimeout(() => {
        addLog('error', 'Timeout de connexion (10s)');
        newSocket.disconnect();
        setIsConnecting(false);
      }, 10000);

      newSocket.on('connect', () => {
        clearTimeout(connectionTimeout);
        addLog('success', `Connecté! Socket ID: ${newSocket.id}`);
        setIsConnected(true);
        setIsConnecting(false);
        setSocket(newSocket);
      });

      newSocket.on('connected', (data) => {
        addLog('success', `Server acknowledged: ${JSON.stringify(data)}`);
        setServerInfo(data);
      });

      newSocket.on('connect_error', (error) => {
        clearTimeout(connectionTimeout);
        addLog('error', `Erreur de connexion: ${error.message}`);
        setIsConnected(false);
        setIsConnecting(false);
      });

      newSocket.on('disconnect', (reason) => {
        addLog('warning', `Déconnecté: ${reason}`);
        setIsConnected(false);
      });

      newSocket.on('pong', (data) => {
        if (data.timestamp) {
          const rtt = Date.now() - data.timestamp;
          setLatency(rtt);
          addLog('info', `Pong reçu - Latence: ${rtt}ms`);
        }
      });

    } catch (error) {
      addLog('error', `Erreur: ${error}`);
      setIsConnecting(false);
    }
  }, [wsUrl, socket, addLog]);

  const measureLatency = useCallback(() => {
    if (socket && isConnected) {
      addLog('info', 'Mesure de latence...');
      socket.emit('ping', { timestamp: Date.now() });
    }
  }, [socket, isConnected, addLog]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      addLog('info', 'Déconnexion manuelle');
    }
  }, [socket, addLog]);

  const getLogColor = (type: ConnectionLog['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Test de connexion WebSocket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL du serveur */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">URL du serveur:</p>
              <code className="text-sm font-mono text-primary">{wsUrl}</code>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'Connecté' : 'Déconnecté'}
              </Badge>
              
              {latency !== null && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {latency}ms
                </Badge>
              )}
            </div>

            {/* Boutons */}
            <div className="flex gap-2">
              <Button 
                onClick={testConnection} 
                disabled={isConnecting}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                {isConnecting ? 'Connexion...' : 'Tester la connexion'}
              </Button>
              
              {isConnected && (
                <>
                  <Button variant="outline" onClick={measureLatency}>
                    Mesurer latence
                  </Button>
                  <Button variant="destructive" onClick={disconnect}>
                    Déconnecter
                  </Button>
                </>
              )}
            </div>

            {/* Info serveur */}
            {serverInfo && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm font-medium text-green-400">Infos serveur:</p>
                <pre className="text-xs text-green-300 mt-1">
                  {JSON.stringify(serverInfo, null, 2)}
                </pre>
              </div>
            )}

            {/* Logs */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Logs:</p>
              <div className="h-48 overflow-y-auto bg-black/50 rounded-lg p-3 font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                  <p className="text-gray-500">Cliquez sur "Tester la connexion" pour commencer</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className={getLogColor(log.type)}>
                      <span className="text-gray-500">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>{' '}
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Pour tester le multijoueur:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Vérifiez que le serveur Railway est actif</li>
              <li>Cliquez sur "Tester la connexion"</li>
              <li>Attendez la confirmation de connexion</li>
              <li>Mesurez la latence pour vérifier la qualité</li>
            </ol>
            <p className="mt-4 text-yellow-500">
              ⚠️ Si la connexion échoue, vérifiez que l'URL <code>{wsUrl}</code> est correcte et que le serveur accepte les connexions WebSocket.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
