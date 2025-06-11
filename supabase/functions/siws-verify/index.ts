
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
    console.log('=== SIGNATURE VERIFICATION START ===')
    console.log('Message to verify:', JSON.stringify(message))
    console.log('Message length:', message.length)
    console.log('PublicKey:', publicKey)
    console.log('Signature array length:', signatureArray.length)
    console.log('Signature first 8 bytes:', signatureArray.slice(0, 8))
    console.log('Signature last 8 bytes:', signatureArray.slice(-8))
    
    // Convert message to bytes - EXACTLY as done in frontend
    const messageBytes = new TextEncoder().encode(message)
    console.log('Message bytes length:', messageBytes.length)
    console.log('Message bytes first 8:', Array.from(messageBytes.slice(0, 8)))
    
    // Convert signature array to Uint8Array
    const signatureBytes = new Uint8Array(signatureArray)
    console.log('Signature bytes length after conversion:', signatureBytes.length)
    
    // Convert public key to bytes
    const publicKeyBytes = new PublicKey(publicKey).toBytes()
    console.log('PublicKey bytes length:', publicKeyBytes.length)
    console.log('PublicKey bytes first 8:', Array.from(publicKeyBytes.slice(0, 8)))
    
    // Verify signature using nacl
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
    console.log('Signature verification result:', isValid)
    console.log('=== SIGNATURE VERIFICATION END ===')
    
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

    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      console.error('Invalid JSON in request body:', e)
      return new Response(
        JSON.stringify({ error: 'invalid-json' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const { nonce, signature, walletAddress } = requestBody

    console.log('=== REQUEST START ===')
    console.log('Request body keys:', Object.keys(requestBody))
    console.log('Nonce:', nonce)
    console.log('WalletAddress:', walletAddress)
    console.log('Signature type:', typeof signature)
    console.log('Signature is array:', Array.isArray(signature))
    
    if (!nonce || !signature || !walletAddress) {
      console.error('Missing required parameters:', { 
        hasNonce: !!nonce, 
        hasSignature: !!signature, 
        hasWalletAddress: !!walletAddress 
      })
      return new Response(
        JSON.stringify({ error: 'missing-parameters' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Verify nonce exists and is not expired
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
        { status: 401, headers: corsHeaders }
      )
    }

    // Check expiration
    const now = new Date()
    const expiresAt = new Date(nonceData.expires_at)
    if (expiresAt < now) {
      console.error('Nonce expired:', nonceData.expires_at)
      return new Response(
        JSON.stringify({ error: 'nonce-expired' }),
        { status: 440, headers: corsHeaders }
      )
    }

    // Reconstruct the message EXACTLY as done in frontend
    const message = `Sign-in nonce: ${nonce}`
    console.log('Reconstructed message:', JSON.stringify(message))

    // Handle signature format - convert to array if needed
    let signatureArray;
    if (Array.isArray(signature)) {
      signatureArray = signature;
    } else if (signature.data && Array.isArray(signature.data)) {
      signatureArray = signature.data;
    } else if (typeof signature === 'object' && signature !== null) {
      // Try to extract array from object structure
      const keys = Object.keys(signature);
      if (keys.length > 0 && typeof signature[keys[0]] === 'number') {
        signatureArray = Object.values(signature);
      } else {
        console.error('Cannot extract signature array from object:', signature);
        return new Response(
          JSON.stringify({ error: 'invalid-signature-format' }),
          { status: 400, headers: corsHeaders }
        )
      }
    } else {
      console.error('Invalid signature format:', typeof signature)
      return new Response(
        JSON.stringify({ error: 'invalid-signature-format' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Final signature array length:', signatureArray.length)
    console.log('Final signature array type check:', signatureArray.every(x => typeof x === 'number'))

    // Verify the signature
    const isValid = verifySignature(message, signatureArray, walletAddress)

    if (!isValid) {
      console.error('Signature verification failed for wallet:', walletAddress)
      return new Response(
        JSON.stringify({ error: 'invalid-signature' }),
        { status: 401, headers: corsHeaders }
      )
    }

    console.log('✅ Signature verification SUCCESS for wallet:', walletAddress)

    // Mark nonce as used
    await supabaseClient
      .from('siws_nonces')
      .update({ used: true })
      .eq('id', nonceData.id)

    // Create or get user
    const userEmail = `${walletAddress}@wallet.local`
    
    // Try to create user first
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: userEmail,
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress,
        display_name: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      }
    })

    let userId = authData?.user?.id

    // If user already exists, get the existing user
    if (authError && authError.message.includes('already been registered')) {
      console.log('User already exists, finding existing user')
      const { data: existingUsers } = await supabaseClient.auth.admin.listUsers()
      const existingUser = existingUsers.users.find(u => u.email === userEmail)
      userId = existingUser?.id
    }

    if (!userId) {
      console.error('Failed to create or find user:', authError)
      return new Response(
        JSON.stringify({ error: 'user-creation-failed' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('✅ User created/found successfully:', userId)

    // Instead of generating complex tokens, return success with basic user info
    return new Response(
      JSON.stringify({ 
        success: true,
        verified: true,
        user: { 
          id: userId, 
          email: userEmail,
          wallet_address: walletAddress
        }
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Unexpected verification error:', error)
    return new Response(
      JSON.stringify({ error: 'internal-server-error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
