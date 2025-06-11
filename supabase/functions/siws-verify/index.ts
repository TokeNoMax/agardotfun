
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1.98.2'
import nacl from 'https://esm.sh/tweetnacl@1.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

function verifySignature(message: string, signatureArray: number[], publicKey: string): boolean {
  try {
    console.log('Verifying signature...')
    console.log('Message to verify:', message)
    console.log('PublicKey:', publicKey)
    console.log('Signature length:', signatureArray.length)
    console.log('Signature first 8 bytes:', signatureArray.slice(0, 8))
    
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = new Uint8Array(signatureArray)
    const publicKeyBytes = new PublicKey(publicKey).toBytes()
    
    console.log('Message bytes length:', messageBytes.length)
    console.log('Signature bytes length:', signatureBytes.length)
    console.log('PublicKey bytes length:', publicKeyBytes.length)
    
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
    console.log('Signature verification result:', isValid)
    
    return isValid
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

    // Validation stricte de l'input
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.error('Invalid JSON in request body:', e)
      return new Response(
        JSON.stringify({ error: 'invalid-json' }),
        { 
          status: 400, 
          headers: corsHeaders
        }
      )
    }

    const { nonce, signature, walletAddress } = requestBody

    if (!nonce || !signature || !walletAddress) {
      console.error('Missing required parameters:', { nonce: !!nonce, signature: !!signature, walletAddress: !!walletAddress })
      return new Response(
        JSON.stringify({ error: 'missing-parameters' }),
        { 
          status: 400, 
          headers: corsHeaders
        }
      )
    }

    console.log('Processing verification for wallet:', walletAddress)
    console.log('Nonce:', nonce)

    // Vérifier le nonce
    const { data: nonceData, error: nonceError } = await supabaseClient
      .from('siws_nonces')
      .select('*')
      .eq('nonce', nonce)
      .eq('wallet_address', walletAddress)
      .eq('used', false)
      .single()

    if (nonceError || !nonceData) {
      console.error('Invalid nonce:', nonceError)
      return new Response(
        JSON.stringify({ error: 'invalid-nonce' }),
        { 
          status: 401, 
          headers: corsHeaders
        }
      )
    }

    // Vérifier l'expiration (5 minutes max)
    const now = new Date()
    const expiresAt = new Date(nonceData.expires_at)
    if (expiresAt < now) {
      console.error('Nonce expired:', nonceData.expires_at)
      return new Response(
        JSON.stringify({ error: 'nonce-expired' }),
        { 
          status: 440, 
          headers: corsHeaders
        }
      )
    }

    // Reconstituer le message original EXACTEMENT comme côté front
    const message = `Sign-in nonce: ${nonce}`
    console.log('Message to verify:', message)

    // Vérifier la signature avec les données reçues
    let signatureArray;
    if (Array.isArray(signature)) {
      signatureArray = signature;
    } else if (signature.data && Array.isArray(signature.data)) {
      signatureArray = signature.data;
    } else {
      console.error('Invalid signature format:', typeof signature)
      return new Response(
        JSON.stringify({ error: 'invalid-signature-format' }),
        { 
          status: 400, 
          headers: corsHeaders
        }
      )
    }

    const isValid = verifySignature(message, signatureArray, walletAddress)

    if (!isValid) {
      console.error('Invalid signature for wallet:', walletAddress)
      return new Response(
        JSON.stringify({ error: 'invalid-signature' }),
        { 
          status: 401, 
          headers: corsHeaders
        }
      )
    }

    console.log('Signature verified successfully for wallet:', walletAddress)

    // Marquer le nonce comme utilisé
    await supabaseClient
      .from('siws_nonces')
      .update({ used: true })
      .eq('id', nonceData.id)

    // Créer ou récupérer l'utilisateur avec email unique basé sur wallet
    const userEmail = `${walletAddress}@wallet.local`
    
    // Essayer de créer l'utilisateur
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: userEmail,
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress,
        display_name: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      }
    })

    let userId = authData?.user?.id

    // Si l'utilisateur existe déjà, récupérer son ID
    if (authError && authError.message.includes('already been registered')) {
      const { data: existingUser } = await supabaseClient.auth.admin.listUsers()
      const user = existingUser.users.find(u => u.email === userEmail)
      userId = user?.id
    }

    if (!userId) {
      console.error('Failed to create or find user:', authError)
      return new Response(
        JSON.stringify({ error: 'user-creation-failed' }),
        { 
          status: 500, 
          headers: corsHeaders
        }
      )
    }

    // Générer un token de session simple
    try {
      const { data: tokenData, error: tokenError } = await supabaseClient.auth.admin.generateAccessToken(userId)
      
      if (tokenError) {
        console.error('Token generation error:', tokenError)
        // Retourner succès de vérification même sans token
        return new Response(
          JSON.stringify({ 
            success: true,
            verified: true,
            user: { id: userId, email: userEmail }
          }),
          { 
            status: 200,
            headers: corsHeaders
          }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          user: { id: userId, email: userEmail },
          session: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null
          }
        }),
        { 
          status: 200,
          headers: corsHeaders
        }
      )
    } catch (tokenErr) {
      console.error('Token generation failed:', tokenErr)
      
      // Retourner succès de vérification même sans token complet
      return new Response(
        JSON.stringify({ 
          success: true,
          verified: true,
          user: { id: userId, email: userEmail }
        }),
        { 
          status: 200,
          headers: corsHeaders
        }
      )
    }
  } catch (error) {
    console.error('Unexpected verification error:', error)
    return new Response(
      JSON.stringify({ error: 'internal-server-error' }),
      { 
        status: 500, 
        headers: corsHeaders
      }
    )
  }
})
