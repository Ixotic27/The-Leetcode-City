-- ============================================================
-- LeetCode City — E.Arcade Custom Maps & Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS public.arcade_maps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  creator_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name  text,
  category      text NOT NULL DEFAULT 'custom',
  tags          text[] NOT NULL DEFAULT '{}'::text[],
  is_public     boolean NOT NULL DEFAULT true,
  version       integer NOT NULL DEFAULT 1,
  map_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Generated TSVector for search
ALTER TABLE public.arcade_maps ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_arcade_maps_search_vector ON public.arcade_maps USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_arcade_maps_slug ON public.arcade_maps (slug);
CREATE INDEX IF NOT EXISTS idx_arcade_maps_creator ON public.arcade_maps (creator_id);

-- Enable RLS
ALTER TABLE public.arcade_maps ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read arcade_maps" ON public.arcade_maps
  FOR SELECT USING (is_public = true OR auth.uid() = creator_id);

CREATE POLICY "Users insert own arcade_maps" ON public.arcade_maps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users update own arcade_maps" ON public.arcade_maps
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users delete own arcade_maps" ON public.arcade_maps
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);
