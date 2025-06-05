
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletContextProvider } from "./context/WalletContext";
import { GameProvider } from "./context/GameContext";
import Index from "./pages/Index";

// Lazy load components for better performance
const Auth = lazy(() => import("./pages/Auth"));
const Lobby = lazy(() => import("./pages/Lobby"));
const Game = lazy(() => import("./pages/Game"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <WalletContextProvider>
      <QueryClientProvider client={queryClient}>
        <GameProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Suspense fallback={
                <div className="w-screen h-screen flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                </div>
              }>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/lobby" element={<Lobby />} />
                  <Route path="/game/:roomId" element={<Game />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </GameProvider>
      </QueryClientProvider>
    </WalletContextProvider>
  );
}

export default App;
