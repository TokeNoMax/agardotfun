import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useGame, defaultPhrases } from "@/context/GameContext";
import { GlobeIcon, Users, PlayIcon, Settings, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function Index() {
  const navigate = useNavigate();
  const { customPhrases, setCustomPhrases } = useGame();
  const [editedPhrases, setEditedPhrases] = useState<string[]>([...customPhrases]);
  const [newPhrase, setNewPhrase] = useState("");
  const { toast } = useToast();
  
  const handleSavePhrases = () => {
    setCustomPhrases(editedPhrases);
    toast({
      title: "Modifications enregistrées",
      description: "Vos phrases personnalisées ont été sauvegardées",
      duration: 2000,
    });
  };

  const handleAddPhrase = () => {
    if (newPhrase.trim()) {
      setEditedPhrases(prev => [...prev, newPhrase]);
      setNewPhrase("");
    }
  };

  const handleDeletePhrase = (index: number) => {
    setEditedPhrases(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetToDefault = () => {
    setEditedPhrases([...defaultPhrases]);
    toast({
      title: "Phrases réinitialisées",
      description: "Les phrases ont été restaurées aux valeurs par défaut",
      duration: 2000,
    });
  };
  
  const handleBulkEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Split by new lines and filter out empty lines
    const phrases = e.target.value.split('\n').filter(line => line.trim() !== '');
    setEditedPhrases(phrases);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl mx-auto relative">
        {/* Bouton de paramètres discret */}
        <div className="absolute top-2 right-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white opacity-60 hover:opacity-100 hover:bg-white/20">
                <Settings className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[80%] sm:w-[500px] max-w-full overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Messages personnalisés</SheetTitle>
                <SheetDescription>
                  Personnalisez les messages qui apparaissent quand un joueur est mangé. Utilisez {"{playerName}"} pour insérer le nom du joueur.
                </SheetDescription>
              </SheetHeader>
              
              <div className="py-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Personnaliser les messages</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetToDefault}
                    >
                      Réinitialiser
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {editedPhrases.map((phrase, index) => (
                      <div key={index} className="flex items-center justify-between bg-background/20 p-2 rounded">
                        <span className="flex-1 mr-2">{phrase}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeletePhrase(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Nouveau message avec {playerName}"
                      value={newPhrase}
                      onChange={(e) => setNewPhrase(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleAddPhrase} className="shrink-0">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Édition en bloc</h3>
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez aussi éditer toutes les phrases en bloc, une phrase par ligne.
                  </p>
                  <Textarea 
                    value={editedPhrases.join('\n')}
                    onChange={handleBulkEdit}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder="Une phrase par ligne. Utilisez {playerName} pour le nom du joueur."
                  />
                </div>
                
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  onClick={handleSavePhrases}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              </div>
              
              <SheetFooter>
                <SheetClose asChild>
                  <Button className="w-full">Fermer</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {/* Hero section */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <GlobeIcon size={42} className="text-white mr-3 animate-pulse" />
            <h1 className="text-7xl font-extrabold text-white tracking-tighter">
              agar<span className="text-yellow-300">.fun</span>
            </h1>
          </div>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Absorbez, grandissez et dominez ! Un jeu multijoueur inspiré d'Agar.io 
            où vous contrôlez un blob et tentez de devenir le plus grand.
          </p>
          <Button 
            onClick={() => navigate("/lobby")} 
            className="bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-bold text-lg px-8 py-6 rounded-full shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <PlayIcon className="mr-2" />
            Jouer maintenant
          </Button>
        </div>
        
        {/* Features section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-12">
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-white" size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Multijoueur</h3>
            <p className="text-indigo-100">
              Affrontez des joueurs du monde entier ou créez une partie privée avec vos amis.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Personnalisation</h3>
            <p className="text-indigo-100">
              Choisissez votre nom et couleur pour créer un blob unique qui vous ressemble.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Compétitif</h3>
            <p className="text-indigo-100">
              Mangez les autres joueurs, évitez les pièges et devenez le plus grand blob du jeu !
            </p>
          </div>
        </div>
        
        {/* How to play section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Comment jouer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start">
              <div className="bg-yellow-400 text-indigo-900 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">1</div>
              <p className="text-indigo-100">Déplacez votre blob avec la souris pour absorber la nourriture et grossir</p>
            </div>
            <div className="flex items-start">
              <div className="bg-yellow-400 text-indigo-900 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">2</div>
              <p className="text-indigo-100">Mangez les joueurs plus petits que vous (au moins 10% plus petits)</p>
            </div>
            <div className="flex items-start">
              <div className="bg-yellow-400 text-indigo-900 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">3</div>
              <p className="text-indigo-100">Évitez les tapis violets qui vous feront rétrécir</p>
            </div>
            <div className="flex items-start">
              <div className="bg-yellow-400 text-indigo-900 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">4</div>
              <p className="text-indigo-100">Le dernier blob en vie gagne la partie !</p>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <Button 
            onClick={() => navigate("/lobby")} 
            className="bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-bold text-lg px-8 py-6 rounded-full shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <PlayIcon className="mr-2" />
            Entrer dans le lobby
          </Button>
        </div>
      </div>
      
      <footer className="mt-20 text-indigo-200 text-sm">
        <p>© 2025 agar.fun - Tous droits réservés</p>
      </footer>
    </div>
  );
}
