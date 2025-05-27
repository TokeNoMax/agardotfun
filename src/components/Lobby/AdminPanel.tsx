
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CleanupResult {
  cleaned: number;
  roomNames?: string[];
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
    console.log("Déclenchement manuel du nettoyage des salles...");

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-inactive-rooms', {
        body: { triggered_by: 'manual' }
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

      console.log("Résultat du nettoyage:", data);
      setLastCleanup(data as CleanupResult);

      if (data?.cleaned > 0) {
        toast({
          title: "Nettoyage effectué",
          description: `${data.cleaned} salle(s) inactive(s) supprimée(s).`,
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
          Panneau d'administration
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
                <Trash2 className="h-4 w-4" />
                Nettoyer les salles inactives
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Nettoyage automatique : toutes les 30 min</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Actif
            </Badge>
          </div>
        </div>

        {lastCleanup && (
          <div className="border rounded-md p-3 bg-white">
            <div className="flex items-center gap-2 mb-2">
              {lastCleanup.cleaned > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-blue-600" />
              )}
              <span className="font-medium text-sm">Dernier nettoyage</span>
              <Badge variant="outline" className="text-xs">
                {new Date(lastCleanup.timestamp).toLocaleString('fr-FR')}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-700 mb-1">{lastCleanup.message}</p>
            
            {lastCleanup.roomNames && lastCleanup.roomNames.length > 0 && (
              <div className="text-xs text-gray-500">
                <span className="font-medium">Salles supprimées :</span>{' '}
                {lastCleanup.roomNames.join(', ')}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 border-t pt-3">
          <p><strong>Critères de suppression :</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Salles vides (0 joueurs) inactives depuis plus de 30 minutes</li>
            <li>Les parties en cours ne sont jamais supprimées</li>
            <li>Seules les salles en statut "waiting" ou "finished" sont concernées</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
