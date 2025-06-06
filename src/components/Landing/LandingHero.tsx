
import React from "react";
import { useNavigate } from "react-router-dom";

interface FeatureCardProps {
  color: string;
  icon: string;
  title: string;
  desc: React.ReactNode;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ color, icon, title, desc }) => (
  <div
    className={`border-2 border-${color}-400 rounded-xl p-8 flex flex-col items-center group shadow-[0_0_15px_rgba(0,255,255,0.3)] transition-transform hover:-translate-y-1 bg-black/60 backdrop-blur-sm`}
  >
    <div
      className={`text-5xl mb-6 w-24 h-24 flex items-center justify-center rounded-xl bg-${color}-500/80 text-white shadow-[0_0_20px_rgba(0,255,255,0.5)]`}
    >
      {icon}
    </div>
    <h3 className="font-extrabold text-2xl neon-gradient mb-4 font-mono">{title}</h3>
    <p className="tracking-wide leading-relaxed text-white/80 text-sm md:text-base font-mono">
      {desc}
    </p>
  </div>
);

export const LandingHero: React.FC = () => {
  const navigate = useNavigate();

  const handleEnterMainnet = () => {
    navigate("/lobby");
  };

  return (
    <section className="flex flex-col items-center pt-16 text-center gap-10 select-none">
      {/* LOGO */}
      <div className="flex justify-center items-center mb-6">
        <div className="relative flex items-center">
          {/* Solana Logo */}
          <svg width="42" height="42" viewBox="0 0 397.7 311.7" className="text-cyber-cyan mr-3 animate-neon-pulse" fill="currentColor">
            <linearGradient id="logosGradient" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#00FFF0"/>
              <stop offset="1" stopColor="#DC1FFF"/>
            </linearGradient>
            <path d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" fill="url(#logosGradient)"/>
            <path d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" fill="url(#logosGradient)"/>
            <path d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" fill="url(#logosGradient)"/>
          </svg>
          <div className="absolute inset-0 bg-cyber-cyan/20 rounded-full blur-xl animate-pulse"></div>
          <h1 className="text-6xl md:text-7xl font-pixel text-cyber-cyan tracking-wider animate-neon-pulse">
            agar<span className="text-cyber-yellow animate-glitch">.fun</span>
          </h1>
        </div>
      </div>

      {/* SLOGAN */}
      <h2 className="text-3xl md:text-5xl font-extrabold neon-gradient animate-neon-pulse font-mono">
        Move, Eat, Hodl to the Moon !
      </h2>

      {/* CTA */}
      <button
        onClick={handleEnterMainnet}
        className="mt-8 px-10 py-3 bg-gradient-to-r from-cyber-magenta to-cyber-cyan hover:from-cyber-cyan hover:to-cyber-magenta text-black font-bold rounded-none border-2 border-cyber-cyan shadow-neon hover:shadow-neon-lg transition-all duration-300 transform hover:scale-105 font-mono"
      >
        ▷ ENTER_THE_MAINNET
      </button>

      {/* CARDS */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12 max-w-6xl w-full px-4">
        <FeatureCard
          color="cyan"
          icon="👤"
          title="MULTIPLAYER"
          desc={
            <>
              Battle royale avec des joueurs du monde entier <br />
              ou créez une salle rien que pour votre crew
            </>
          }
        />

        <FeatureCard
          color="fuchsia"
          icon="⚡"
          title="CUSTOM"
          desc={
            <>
              Personnalisez votre <span className="text-cyan-300">blob avec votre NFT</span>
              <br /> et créez un avatar unique. <br />
              <span className="text-yellow-400">Time to FLEX 💪</span>
            </>
          }
        />

        <FeatureCard
          color="lime"
          icon="🏆"
          title="TO_THE_MOON"
          desc={
            <>
              Mangez les autres blobs, esquivez les <span className="text-violet-400">RUG_PULLS</span> violets <br />
              et devenez la <span className="font-bold text-yellow-300">WHALE</span> ultime ! 🐳
            </>
          }
        />
      </div>
    </section>
  );
};
