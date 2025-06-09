
import React from 'react';
import TutorialStep from './TutorialStep';

interface TutorialSectionProps {
  isMobile?: boolean;
}

export default function TutorialSection({ isMobile = false }: TutorialSectionProps) {
  const titleClass = isMobile ? 'text-lg' : 'text-3xl';
  const containerClass = isMobile ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-6';

  return (
    <div className={`bg-black/90 backdrop-blur-sm rounded-lg ${isMobile ? 'p-4' : 'p-8'} border-2 border-cyber-green/30 ${!isMobile ? 'shadow-[0_0_20px_rgba(0,255,0,0.2)] mb-12' : ''}`}>
      <div className={`flex items-center ${isMobile ? 'mb-4' : 'mb-6'}`}>
        <div className={`${isMobile ? 'w-2 h-2' : 'w-3 h-3'} bg-cyber-magenta rounded-full mr-2 animate-pulse`}></div>
        <div className={`${isMobile ? 'w-2 h-2' : 'w-3 h-3'} bg-cyber-yellow rounded-full mr-2 animate-pulse`} style={{animationDelay: '0.2s'}}></div>
        <div className={`${isMobile ? 'w-2 h-2' : 'w-3 h-3'} bg-cyber-green rounded-full ${isMobile ? 'mr-3' : 'mr-4'} animate-pulse`} style={{animationDelay: '0.4s'}}></div>
        <h2 className={`${titleClass} font-bold text-cyber-green font-mono`}>
          {isMobile ? 'TUTORIAL' : 'TUTORIAL.md'}
        </h2>
      </div>
      
      <div className={containerClass}>
        <TutorialStep 
          number={isMobile ? "1" : "0x1"} 
          color="cyber-yellow" 
          isMobile={isMobile}
        >
          {isMobile ? (
            <>Touchez l'écran pour déplacer votre blob et absorber la <span className="text-cyber-cyan">FOOD</span> 🍰</>
          ) : (
            <>Déplacez votre blob avec la souris pour absorber la <span className="text-cyber-cyan">FOOD</span> et grossir 🍰</>
          )}
        </TutorialStep>
        
        <TutorialStep 
          number={isMobile ? "2" : "0x2"} 
          color="cyber-cyan" 
          isMobile={isMobile}
        >
          {isMobile ? (
            <>Mangez les joueurs plus petits (10% min.) 🥵</>
          ) : (
            <>Mangez les joueurs plus petits que vous (au moins <span className="text-cyber-magenta">10%</span> plus petits) 🥵</>
          )}
        </TutorialStep>
        
        <TutorialStep 
          number={isMobile ? "3" : "0x3"} 
          color="cyber-magenta" 
          isMobile={isMobile}
        >
          Évitez les <span className="text-cyber-purple">RUG_CARPETS</span> violets {isMobile ? '📉' : 'qui vous feront rétrécir 📉'}
        </TutorialStep>
        
        <TutorialStep 
          number={isMobile ? "4" : "0x4"} 
          color="cyber-green" 
          isMobile={isMobile}
        >
          {isMobile ? (
            <>Devenez le <span className="text-cyber-yellow">ULTIMATE_WHALE</span> ! 👑</>
          ) : (
            <>Le dernier blob en vie devient le <span className="text-cyber-yellow">ULTIMATE_CHAD</span> ! 👑</>
          )}
        </TutorialStep>
      </div>
    </div>
  );
}
