
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white">
      <div className="text-center max-w-3xl px-4">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-blue-500 animate-pulse absolute -left-12 top-0 opacity-80"></div>
            <div className="w-16 h-16 rounded-full bg-green-500 animate-pulse absolute left-8 -top-6 opacity-80"></div>
            <div className="w-20 h-20 rounded-full bg-red-500 animate-pulse absolute left-16 top-4 opacity-80"></div>
            <div className="w-14 h-14 rounded-full bg-yellow-500 animate-float absolute left-4 top-14 opacity-80"></div>
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4">Blob Battle Royale</h1>
        <p className="text-xl mb-8">
          Eat or be eaten in this fast-paced battle arena! Grow your blob, avoid rugs, and be the last one standing.
        </p>
        
        <Button 
          onClick={() => navigate('/lobby')} 
          size="lg"
          className="text-lg bg-white text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700"
        >
          Start Playing <ArrowRight className="ml-2" />
        </Button>
      </div>
      
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-blue-500 mb-4 flex items-center justify-center">
            <span className="text-xl font-bold">1</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Grow Your Blob</h3>
          <p className="text-white/80">
            Consume food pellets scattered around the map to increase your size and power.
          </p>
        </div>
        
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-red-500 mb-4 flex items-center justify-center">
            <span className="text-xl font-bold">2</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Hunt Others</h3>
          <p className="text-white/80">
            Once you're big enough, hunt down smaller players to absorb their mass and eliminate them.
          </p>
        </div>
        
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-purple-500 mb-4 flex items-center justify-center">
            <span className="text-xl font-bold">3</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Avoid Rugs</h3>
          <p className="text-white/80">
            Watch out for dangerous rug traps that will shrink your blob and make you vulnerable!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
