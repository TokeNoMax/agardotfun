
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1.98.2'
import nacl from 'https://esm.sh/tweetnacl@1.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function verifySignature(message: string, signature: Uint8Array, publicKey: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    const publicKeyBytes = new PublicKey(publicKey).toBytes()
    return nacl.sign.detached.verify(messageBytes, signature, publicKeyBytes)
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
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

    const { nonce, signature, walletAddress } = await req.json()

    if (!nonce || !signature || !walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Vérifier le nonce
    const { data: nonceData, error: nonceError } = await supabaseClient
      .from('siws_nonces')
      .select('*')
      .eq('nonce', nonce)
      .eq('wallet_address', walletAddress)
      .eq('used', false)
      .single()

    if (nonceError || !nonceData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired nonce' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Vérifier l'expiration
    if (new Date(nonceData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Nonce has expired' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Reconstituer le message original EXACTEMENT comme côté front
    const message = `Sign-in nonce: ${nonce}`

    // Vérifier la signature
    const signatureBytes = new Uint8Array(signature.data || signature)
    const isValid = verifySignature(message, signatureBytes, walletAddress)

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Marquer le nonce comme utilisé
    await supabaseClient
      .from('siws_nonces')
      .update({ used: true })
      .eq('id', nonceData.id)

    // Créer ou mettre à jour le profil utilisateur
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: `${walletAddress}@wallet.local`,
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress,
        display_name: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      }
    })

    if (authError && !authError.message.includes('already been registered')) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Générer un token de session
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateAccessToken(
      authData?.user?.id || authError?.message?.match(/User with this email already exists: (.+)/)?.[1]
    )

    if (sessionError) {
      console.error('Session error:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Session creation failed' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: authData?.user,
        session: sessionData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Verification error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
