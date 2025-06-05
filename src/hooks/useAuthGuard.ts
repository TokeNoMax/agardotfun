
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface UseAuthGuardOptions {
  redirectTo?: string;
  requireAuth?: boolean;
  onUnauthorized?: () => void;
}

export const useAuthGuard = ({
  redirectTo = '/auth',
  requireAuth = true,
  onUnauthorized
}: UseAuthGuardOptions = {}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return; // Don't redirect while loading

    if (requireAuth && !user) {
      console.log('Auth guard: Redirecting unauthenticated user');
      
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        toast({
          title: "Authentification requise",
          description: "Veuillez vous connecter pour accéder à cette page",
          variant: "destructive"
        });
      }
      
      navigate(redirectTo);
    } else if (!requireAuth && user) {
      // Redirect authenticated users away from auth pages
      navigate('/lobby');
    }
  }, [user, loading, requireAuth, redirectTo, navigate, toast, onUnauthorized]);

  return {
    isAuthenticated: !!user,
    isLoading: loading,
    user
  };
};
