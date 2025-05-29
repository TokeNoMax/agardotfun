
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CleanupResult {
  cleaned: number;
  roomNames?: string[];
  ghostPlayersRemoved?: number;
  timestamp: string;
  message: string;
}

export default function AdminPanel() {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<CleanupResult | null>(null);
  const { toast } = useToast();

  const handleManualCleanup = async () => {
    if (isCleaningUp) return;
    
    setIsCleaningUp(true);
    console.log("Déclenchement manuel du nettoyage amélioré...");

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-inactive-rooms', {
        body: { triggered_by: 'manual_enhanced' }
      });

      if (error) {
        console.error("Erreur lors du nettoyage:", error);
        toast({
          title: "Erreur de nettoyage",
          description: "Impossible d'exécuter le nettoyage automatique.",
          variant: "destructive"
        });
        return;
      }

      console.log("Résultat du nettoyage amélioré:", data);
      setLastCleanup(data as CleanupResult);

      if (data?.cleaned > 0 || data?.ghostPlayersRemoved > 0) {
        toast({
          title: "Nettoyage effectué",
          description: `${data.cleaned} salle(s) et ${data.ghostPlayersRemoved || 0} joueur(s) fantôme(s) supprimé(s).`,
        });
      } else {
        toast({
          title: "Nettoyage terminé",
          description: "Aucune salle inactive à supprimer.",
        });
      }

    } catch (error) {
      console.error("Erreur inattendue lors du nettoyage:", error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive"
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Trash2 className="h-5 w-5" />
          Panneau d'administration (Amélioré)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleManualCleanup}
            disabled={isCleaningUp}
            className="flex items-center gap-2"
            variant="outline"
          >
            {isCleaningUp ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Nettoyage en cours...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Nettoyage amélioré
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Nettoyage auto : toutes les 10 min</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Amélioré
            </Badge>
          </div>
        </div>

        {lastCleanup && (
          <div className="border rounded-md p-3 bg-white">
            <div className="flex items-center gap-2 mb-2">
              {(lastCleanup.cleaned > 0 || lastCleanup.ghostPlayersRemoved > 0) ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-blue-600" />
              )}
              <span className="font-medium text-sm">Dernier nettoyage amélioré</span>
              <Badge variant="outline" className="text-xs">
                {new Date(lastCleanup.timestamp).toLocaleString('fr-FR')}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-700 mb-1">{lastCleanup.message}</p>
            
            <div className="flex gap-4 text-xs text-gray-600">
              <span><strong>Salles:</strong> {lastCleanup.cleaned}</span>
              <span><strong>Joueurs fantômes:</strong> {lastCleanup.ghostPlayersRemoved || 0}</span>
            </div>
            
            {lastCleanup.roomNames && lastCleanup.roomNames.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                <span className="font-medium">Salles supprimées :</span>{' '}
                {lastCleanup.roomNames.join(', ')}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 border-t pt-3">
          <p><strong>Nettoyage amélioré :</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Supprime automatiquement les joueurs fantômes (inactifs 5+ min)</li>
            <li>Supprime les salles inactives depuis 30+ minutes (même avec joueurs fantômes)</li>
            <li>Protège les parties vraiment en cours</li>
            <li>Nettoyage plus fréquent (toutes les 10 minutes)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
