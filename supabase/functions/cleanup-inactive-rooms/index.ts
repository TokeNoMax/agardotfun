
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

    console.log('Starting enhanced cleanup of inactive rooms and ghost rooms...');

    // Calculer les dates limites
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    console.log(`Looking for inactive rooms since: ${thirtyMinutesAgo.toISOString()}`);
    console.log(`Looking for ghost players since: ${fiveMinutesAgo.toISOString()}`);

    // 1. Nettoyer d'abord les joueurs fantômes (inactifs depuis plus de 5 minutes)
    console.log('Phase 1: Cleaning up ghost players...');
    const { data: ghostPlayers, error: ghostError } = await supabase
      .from('game_room_players')
      .select('id, room_id, player_name, joined_at')
      .lt('joined_at', fiveMinutesAgo.toISOString());

    let ghostPlayersRemoved = 0;
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
        ghostPlayersRemoved = ghostPlayers.length;
        console.log(`Successfully deleted ${ghostPlayersRemoved} ghost players`);
      }
    }

    // 2. Identifier et nettoyer les salles fantômes (statut "playing" + 0 joueurs)
    console.log('Phase 2: Identifying ghost rooms (playing status with 0 players)...');
    const { data: ghostRooms, error: ghostRoomsError } = await supabase
      .from('game_rooms')
      .select(`
        id,
        name,
        status,
        last_activity,
        created_at,
        game_room_players(count)
      `)
      .eq('status', 'playing')
      .lt('last_activity', thirtyMinutesAgo.toISOString());

    if (ghostRoomsError) {
      console.error('Error fetching ghost rooms:', ghostRoomsError);
    }

    // Filtrer les salles qui n'ont vraiment aucun joueur
    const actualGhostRooms = (ghostRooms || []).filter(room => {
      const playerCount = room.game_room_players?.[0]?.count || 0;
      return playerCount === 0;
    });

    console.log(`Found ${actualGhostRooms.length} ghost rooms (playing status with 0 players)`);

    // 3. Récupérer les salles inactives classiques (waiting/finished + inactives)
    console.log('Phase 3: Finding inactive rooms (waiting/finished status)...');
    const { data: inactiveRooms, error: fetchError } = await supabase
      .from('game_rooms')
      .select(`
        id,
        name,
        status,
        last_activity,
        created_at,
        game_room_players(count)
      `)
      .in('status', ['waiting', 'finished'])
      .lt('last_activity', thirtyMinutesAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching inactive rooms:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inactive rooms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${inactiveRooms?.length || 0} inactive rooms (waiting/finished)`);

    // 4. Combiner toutes les salles à supprimer
    const allRoomsToDelete = [
      ...actualGhostRooms,
      ...(inactiveRooms || [])
    ];

    console.log(`Total rooms to delete: ${allRoomsToDelete.length}`);

    if (allRoomsToDelete.length === 0) {
      console.log('No rooms to clean up');
      return new Response(
        JSON.stringify({ 
          message: 'No rooms found for cleanup',
          cleaned: 0,
          ghostRoomsRemoved: 0,
          inactiveRoomsRemoved: 0,
          ghostPlayersRemoved: ghostPlayersRemoved,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Supprimer toutes les salles identifiées
    const roomIds = allRoomsToDelete.map(room => room.id);
    
    console.log('Phase 4: Deleting rooms:', roomIds);
    const { error: deleteError } = await supabase
      .from('game_rooms')
      .delete()
      .in('id', roomIds);

    if (deleteError) {
      console.error('Error deleting rooms:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete rooms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Préparer le rapport de nettoyage
    const cleanedRoomNames = allRoomsToDelete.map(room => `${room.name} (${room.status})`);
    const ghostRoomsCount = actualGhostRooms.length;
    const inactiveRoomsCount = (inactiveRooms || []).length;

    console.log(`Cleanup completed successfully:`);
    console.log(`- Ghost rooms (playing + 0 players): ${ghostRoomsCount}`);
    console.log(`- Inactive rooms (waiting/finished): ${inactiveRoomsCount}`);
    console.log(`- Ghost players removed: ${ghostPlayersRemoved}`);
    console.log(`- Room names: ${cleanedRoomNames.join(', ')}`);

    return new Response(
      JSON.stringify({ 
        message: `Enhanced cleanup completed: ${allRoomsToDelete.length} rooms deleted`,
        cleaned: allRoomsToDelete.length,
        ghostRoomsRemoved: ghostRoomsCount,
        inactiveRoomsRemoved: inactiveRoomsCount,
        ghostPlayersRemoved: ghostPlayersRemoved,
        roomNames: cleanedRoomNames,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in enhanced cleanup function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
