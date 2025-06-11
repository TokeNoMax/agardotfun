
import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* Header skeleton */}
      <div className="flex justify-between items-center mb-6 bg-black/90 backdrop-blur-sm rounded-lg border border-cyber-cyan/50 p-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32 bg-cyber-cyan/20" />
          <Skeleton className="h-4 w-48 bg-gray-700" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24 bg-cyber-cyan/20" />
          <Skeleton className="h-10 w-10 bg-cyber-cyan/20 rounded" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-12 w-full bg-cyber-green/20" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="space-y-4">
            <Skeleton className="h-64 w-full bg-black/50 border border-cyber-cyan/50 rounded-lg" />
            <Skeleton className="h-32 w-full bg-black/50 border border-cyber-cyan/50 rounded-lg" />
          </div>
          
          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-black/50 border border-cyber-cyan/50 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GameSkeleton() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Game canvas skeleton */}
      <div className="absolute inset-0">
        <Skeleton className="w-full h-full bg-gray-900" />
      </div>
      
      {/* UI overlay skeleton */}
      <div className="absolute top-4 left-4 z-10">
        <Skeleton className="h-48 w-64 bg-black/80 border border-cyber-cyan/50 rounded-lg" />
      </div>
      
      <div className="absolute top-4 right-4 z-10">
        <Skeleton className="h-10 w-24 bg-cyber-green/20 rounded" />
      </div>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <Skeleton className="h-12 w-32 bg-cyber-cyan/20 rounded" />
      </div>
    </div>
  );
}
