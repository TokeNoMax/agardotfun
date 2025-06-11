
import React, { Suspense, lazy } from 'react';
import { GameSkeleton } from '@/components/ui/page-skeleton';

// Lazy load the Game component
const Game = lazy(() => import('./Game'));

export default function LazyGame() {
  return (
    <Suspense fallback={<GameSkeleton />}>
      <Game />
    </Suspense>
  );
}
