
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { GameProvider } from "@/context/GameContext";
import { WalletContextProvider } from "@/context/WalletContext";
import { PageSkeleton, GameSkeleton } from "@/components/ui/page-skeleton";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy load heavy pages
const LazyLobby = lazy(() => import("./pages/LazyLobby"));
const LazyGame = lazy(() => import("./pages/LazyGame"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletContextProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <GameProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route 
                path="/lobby" 
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <LazyLobby />
                  </Suspense>
                } 
              />
              <Route 
                path="/game/:roomId" 
                element={
                  <Suspense fallback={<GameSkeleton />}>
                    <LazyGame />
                  </Suspense>
                } 
              />
              <Route 
                path="/game" 
                element={
                  <Suspense fallback={<GameSkeleton />}>
                    <LazyGame />
                  </Suspense>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </GameProvider>
        </BrowserRouter>
      </TooltipProvider>
    </WalletContextProvider>
  </QueryClientProvider>
);

export default App;
