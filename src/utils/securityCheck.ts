
// Utilitaire pour vérifier qu'aucune clé service_role n'est exposée côté client

const DANGEROUS_KEYS = [
  'service_role',
  'SUPABASE_SERVICE_ROLE_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Pattern JWT commun
];

export const checkForDangerousKeys = () => {
  const warnings: string[] = [];
  
  // Vérifier les variables d'environnement côté client
  if (typeof window !== 'undefined') {
    const env = import.meta.env;
    
    Object.keys(env).forEach(key => {
      const value = env[key];
      if (typeof value === 'string') {
        DANGEROUS_KEYS.forEach(dangerousPattern => {
          if (value.includes(dangerousPattern) || key.includes('SERVICE_ROLE')) {
            warnings.push(`⚠️ Potential service_role key exposure in ${key}`);
          }
        });
      }
    });
  }

  // Vérifier le code source actuel
  const currentConfig = {
    supabaseUrl: "https://hoizgemxlmhhzemohkuk.supabase.co",
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaXpnZW14bG1oaHplbW9oa3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MjA1NzAsImV4cCI6MjA2MzQ5NjU3MH0.7zaCRb22Pi41HNgpVy1lh2WfPtDJH4UDz1EbpTFyTG0"
  };

  // Vérifier que la clé actuelle est bien anon (pas service_role)
  try {
    const payload = JSON.parse(atob(currentConfig.supabaseKey.split('.')[1]));
    if (payload.role !== 'anon') {
      warnings.push(`⚠️ Client is using ${payload.role} key instead of anon key`);
    } else {
      console.log('✅ Client is correctly using anon key');
    }
  } catch (error) {
    warnings.push('⚠️ Could not verify key type');
  }

  if (warnings.length > 0) {
    console.warn('🔒 SECURITY CHECK WARNINGS:', warnings);
    return { secure: false, warnings };
  }

  console.log('✅ SECURITY CHECK PASSED: No dangerous keys detected');
  return { secure: true, warnings: [] };
};
