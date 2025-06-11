
-- Activer RLS sur la table rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Politique pour rooms - lecture publique, création/modification pour utilisateurs authentifiés
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rooms" ON public.rooms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete rooms" ON public.rooms FOR DELETE TO authenticated USING (true);

-- Créer la table scores si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS sur la table scores
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Politiques pour scores - les utilisateurs ne peuvent voir que leurs propres scores
CREATE POLICY "Users can view their own scores" ON public.scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own scores" ON public.scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scores" ON public.scores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own scores" ON public.scores FOR DELETE USING (auth.uid() = user_id);

-- Créer la table pour stocker les nonces SIWS
CREATE TABLE IF NOT EXISTS public.siws_nonces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nonce TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_siws_nonces_nonce ON public.siws_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_siws_nonces_expires ON public.siws_nonces(expires_at);

-- Fonction pour nettoyer les anciens nonces (auto-nettoyage)
CREATE OR REPLACE FUNCTION public.cleanup_expired_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.siws_nonces 
    WHERE expires_at < NOW() OR used = true;
END;
$$;
