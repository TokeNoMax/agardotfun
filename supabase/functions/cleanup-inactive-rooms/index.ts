
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Créer le client Supabase avec la clé de service
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting cleanup of inactive rooms...');

    // Calculer la date limite (30 minutes dans le passé)
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    console.log(`Looking for rooms inactive since before: ${thirtyMinutesAgo.toISOString()}`);

    // Récupérer les salles vides et inactives depuis plus de 30 minutes
    const { data: inactiveRooms, error: fetchError } = await supabase
      .from('game_rooms')
      .select(`
        id,
        name,
        status,
        last_activity,
        game_room_players(count)
      `)
      .lt('last_activity', thirtyMinutesAgo.toISOString())
      .neq('status', 'playing'); // Ne pas supprimer les parties en cours

    if (fetchError) {
      console.error('Error fetching inactive rooms:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inactive rooms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${inactiveRooms?.length || 0} potentially inactive rooms`);

    if (!inactiveRooms || inactiveRooms.length === 0) {
      console.log('No inactive rooms to clean up');
      return new Response(
        JSON.stringify({ 
          message: 'No inactive rooms found',
          cleaned: 0,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrer les salles vraiment vides (sans joueurs)
    const emptyRooms = inactiveRooms.filter(room => {
      const playerCount = room.game_room_players?.[0]?.count || 0;
      return playerCount === 0;
    });

    console.log(`Found ${emptyRooms.length} empty rooms to delete`);

    if (emptyRooms.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No empty rooms to clean up',
          cleaned: 0,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supprimer les salles vides
    const roomIds = emptyRooms.map(room => room.id);
    
    const { error: deleteError } = await supabase
      .from('game_rooms')
      .delete()
      .in('id', roomIds);

    if (deleteError) {
      console.error('Error deleting inactive rooms:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete inactive rooms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanedRoomNames = emptyRooms.map(room => room.name);
    console.log(`Successfully cleaned up ${emptyRooms.length} rooms:`, cleanedRoomNames);

    return new Response(
      JSON.stringify({ 
        message: `Successfully cleaned up ${emptyRooms.length} inactive rooms`,
        cleaned: emptyRooms.length,
        roomNames: cleanedRoomNames,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in cleanup function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
