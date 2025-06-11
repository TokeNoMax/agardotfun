
import React, { Suspense, lazy } from 'react';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// Lazy load the Lobby component
const Lobby = lazy(() => import('./Lobby'));

export default function LazyLobby() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Lobby />
    </Suspense>
  );
}
