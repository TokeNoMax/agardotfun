
import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletGate } from "@/features/wallet/components/WalletGate";
import MobileLobbyLayout from "@/features/lobby/components/MobileLobbyLayout";
import DesktopLobbyLayout from "./DesktopLobbyLayout";

const Lobby = () => {
  const isMobile = useIsMobile();

  return (
    <WalletGate>
      {isMobile ? <MobileLobbyLayout /> : <DesktopLobbyLayout />}
    </WalletGate>
  );
};

export default Lobby;
