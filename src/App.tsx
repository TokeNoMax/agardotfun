
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { GameProvider } from "@/context/GameContext";
import { WalletContextProvider } from "@/context/WalletContext";
import { PageSkeleton, GameSkeleton } from "@/components/ui/page-skeleton";
import { gameRoomService } from "@/services/gameRoomService";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy load heavy pages
const LazyLobby = lazy(() => import("./pages/LazyLobby"));
const LazyGame = lazy(() => import("./pages/LazyGame"));

const queryClient = new QueryClient();

// Component to handle prefetching
const PrefetchHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Prefetch room data when navigating to lobby or when on index page
    if (location.pathname === "/" || location.pathname === "/lobby") {
      queryClient.prefetchQuery({
        queryKey: ['rooms'],
        queryFn: gameRoomService.getAllRooms,
        staleTime: 30000, // Consider data fresh for 30 seconds
      });
    }
  }, [location.pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletContextProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PrefetchHandler />
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
