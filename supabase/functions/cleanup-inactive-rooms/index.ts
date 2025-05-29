
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

    console.log('Starting enhanced cleanup of inactive rooms...');

    // Calculer les dates limites
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    console.log(`Looking for rooms inactive since before: ${thirtyMinutesAgo.toISOString()}`);

    // 1. Nettoyer d'abord les joueurs fantômes (inactifs depuis plus de 5 minutes)
    console.log('Cleaning up ghost players...');
    const { data: ghostPlayers, error: ghostError } = await supabase
      .from('game_room_players')
      .select('id, room_id, player_name')
      .lt('joined_at', fiveMinutesAgo.toISOString());

    if (ghostError) {
      console.error('Error fetching ghost players:', ghostError);
    } else if (ghostPlayers && ghostPlayers.length > 0) {
      console.log(`Found ${ghostPlayers.length} potential ghost players`);
      
      const { error: deleteGhostError } = await supabase
        .from('game_room_players')
        .delete()
        .in('id', ghostPlayers.map(p => p.id));

      if (deleteGhostError) {
        console.error('Error deleting ghost players:', deleteGhostError);
      } else {
        console.log(`Deleted ${ghostPlayers.length} ghost players`);
      }
    }

    // 2. Récupérer les salles inactives (en excluant les parties vraiment en cours)
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
      .neq('status', 'playing'); // Ne pas supprimer les parties vraiment en cours

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
          ghostPlayersRemoved: ghostPlayers?.length || 0,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Logique améliorée : supprimer toutes les salles inactives, même celles avec des joueurs fantômes
    // mais vérifier qu'elles ne sont pas des parties vraiment actives
    const roomsToDelete = [];
    
    for (const room of inactiveRooms) {
      const timeSinceLastActivity = Date.now() - new Date(room.last_activity).getTime();
      const thirtyMinutesInMs = 30 * 60 * 1000;
      
      // Si la salle est inactive depuis plus de 30 minutes, la supprimer
      if (timeSinceLastActivity > thirtyMinutesInMs) {
        roomsToDelete.push(room);
      }
    }

    console.log(`Will delete ${roomsToDelete.length} inactive rooms`);

    if (roomsToDelete.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No rooms qualify for deletion',
          cleaned: 0,
          ghostPlayersRemoved: ghostPlayers?.length || 0,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Supprimer les salles inactives (les joueurs seront supprimés automatiquement par cascade)
    const roomIds = roomsToDelete.map(room => room.id);
    
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

    const cleanedRoomNames = roomsToDelete.map(room => room.name);
    console.log(`Successfully cleaned up ${roomsToDelete.length} rooms:`, cleanedRoomNames);

    return new Response(
      JSON.stringify({ 
        message: `Enhanced cleanup: deleted ${roomsToDelete.length} inactive rooms`,
        cleaned: roomsToDelete.length,
        roomNames: cleanedRoomNames,
        ghostPlayersRemoved: ghostPlayers?.length || 0,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in enhanced cleanup function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
