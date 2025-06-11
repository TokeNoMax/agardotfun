
import React from "react";
import { WalletGate } from "@/features/wallet/components/WalletGate";
import LandingHero from "@/components/Landing/LandingHero";

const Index = () => {
  return (
    <WalletGate>
      <LandingHero />
    </WalletGate>
  );
};

export default Index;
