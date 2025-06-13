
-- Add a constraint to prevent exceeding max_players in game_rooms
-- This will ensure database-level integrity for player limits

-- First, let's add a function to check player count
CREATE OR REPLACE FUNCTION check_room_player_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if adding this player would exceed the room's max_players limit
  IF (
    SELECT COUNT(*) 
    FROM game_room_players 
    WHERE room_id = NEW.room_id
  ) >= (
    SELECT max_players 
    FROM game_rooms 
    WHERE id = NEW.room_id
  ) THEN
    RAISE EXCEPTION 'Room has reached maximum player capacity';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to enforce the constraint
DROP TRIGGER IF EXISTS enforce_room_player_limit ON game_room_players;
CREATE TRIGGER enforce_room_player_limit
  BEFORE INSERT ON game_room_players
  FOR EACH ROW
  EXECUTE FUNCTION check_room_player_limit();

-- Add a comment for documentation
COMMENT ON FUNCTION check_room_player_limit() IS 'Prevents exceeding max_players limit when adding players to rooms';
