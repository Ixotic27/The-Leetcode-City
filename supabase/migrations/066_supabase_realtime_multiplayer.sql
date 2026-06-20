-- ============================================================
-- Supabase Realtime Multiplayer Tables
-- ============================================================

-- 1. arcade_active_players — heartbeats for room presence tracking
CREATE TABLE IF NOT EXISTS public.arcade_active_players (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id        text NOT NULL REFERENCES public.arcade_rooms(slug) ON DELETE CASCADE,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arcade_active_players_room ON public.arcade_active_players (room_id);
CREATE INDEX IF NOT EXISTS idx_arcade_active_players_heartbeat ON public.arcade_active_players (last_heartbeat);

-- 2. arcade_chat_messages — chat history persistence
CREATE TABLE IF NOT EXISTS public.arcade_chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    text NOT NULL REFERENCES public.arcade_rooms(slug) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text NOT NULL,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arcade_chat_messages_room_created ON public.arcade_chat_messages (room_id, created_at);

-- ============================================================
-- Row Level Security (RLS) policies
-- ============================================================
ALTER TABLE public.arcade_active_players enable row level security;
ALTER TABLE public.arcade_chat_messages enable row level security;

-- arcade_active_players policies
CREATE POLICY "Public read active players" ON public.arcade_active_players
  FOR SELECT USING (true);

CREATE POLICY "Users upsert active players" ON public.arcade_active_players
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- arcade_chat_messages policies
CREATE POLICY "Public read chat messages" ON public.arcade_chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Users insert chat messages" ON public.arcade_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
