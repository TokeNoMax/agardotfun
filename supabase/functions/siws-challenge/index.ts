
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { walletAddress } = await req.json()

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Wallet address is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Générer un nonce unique
    const nonce = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // Nettoyer les anciens nonces
    await supabaseClient.rpc('cleanup_expired_nonces')

    // Stocker le nonce
    const { error } = await supabaseClient
      .from('siws_nonces')
      .insert({
        nonce,
        wallet_address: walletAddress,
        expires_at: expiresAt.toISOString()
      })

    if (error) {
      console.error('Error storing nonce:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate challenge' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const message = `Sign this message to authenticate with agar.fun\n\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`

    return new Response(
      JSON.stringify({ 
        nonce,
        message,
        expiresAt: expiresAt.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Challenge generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
