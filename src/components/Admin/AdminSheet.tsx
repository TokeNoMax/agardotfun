
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import AdminPanel from "@/components/Lobby/AdminPanel";

// Adresses Solana autorisées pour l'administration
const ADMIN_ADDRESSES = [
  // Ajoutez ici les adresses Solana des administrateurs
  "VOTRE_ADRESSE_ADMIN_ICI", // Remplacez par la vraie adresse
];

export default function AdminSheet() {
  const { publicKey } = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  // Vérifier si l'utilisateur connecté est un administrateur
  const isAdmin = publicKey && ADMIN_ADDRESSES.includes(publicKey.toString());

  // Ne pas afficher l'icône si l'utilisateur n'est pas admin
  if (!isAdmin) {
    return null;
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="text-gray-600 hover:text-gray-800"
          title="Administration"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Administration
          </SheetTitle>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Admin :</span>{" "}
            {formatAddress(publicKey!.toString())}
          </div>
        </SheetHeader>
        
        <div className="space-y-6">
          <AdminPanel />
          
          {/* Espace pour ajouter d'autres outils d'administration */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">Statistiques</h3>
            <p className="text-sm text-gray-600">
              Autres outils d'administration seront ajoutés ici...
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
