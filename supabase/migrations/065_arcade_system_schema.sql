-- ============================================================
-- LeetCode City — E.Arcade multiplayer system schema
-- ============================================================

-- 1. wallets — tracks currency (PX) per developer
CREATE TABLE IF NOT EXISTS public.wallets (
  developer_id bigint PRIMARY KEY REFERENCES public.developers(id) ON DELETE CASCADE,
  balance      bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. arcade_rooms — stores game rooms and maps
CREATE TABLE IF NOT EXISTS public.arcade_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  room_type     text NOT NULL,
  floor_number  integer NOT NULL DEFAULT 0,
  max_players   integer NOT NULL DEFAULT 50,
  visibility    text NOT NULL DEFAULT 'open' CHECK (visibility IN ('open', 'password', 'private')),
  category      text NOT NULL DEFAULT 'social',
  description   text,
  is_featured   boolean NOT NULL DEFAULT false,
  portals       jsonb NOT NULL DEFAULT '[]'::jsonb,
  map_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Generated TSVector for text searching rooms
ALTER TABLE public.arcade_rooms ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_arcade_rooms_search_vector ON public.arcade_rooms USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_arcade_rooms_slug ON public.arcade_rooms (slug);

-- 3. arcade_room_favorites — user favorited rooms
CREATE TABLE IF NOT EXISTS public.arcade_room_favorites (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id    text NOT NULL REFERENCES public.arcade_rooms(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- 4. arcade_room_visits — tracks where players go
CREATE TABLE IF NOT EXISTS public.arcade_room_visits (
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id          text NOT NULL REFERENCES public.arcade_rooms(slug) ON DELETE CASCADE,
  last_visited_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- 5. arcade_shop_items — catalog of cosmetic avatar items
CREATE TABLE IF NOT EXISTS public.arcade_shop_items (
  id            text PRIMARY KEY,
  category      text NOT NULL,
  name          text NOT NULL,
  file          text NOT NULL,
  rarity        text NOT NULL DEFAULT 'free',
  price_px      bigint NOT NULL DEFAULT 0 CHECK (price_px >= 0),
  default_color text NOT NULL DEFAULT '#ffffff',
  no_tint       boolean NOT NULL DEFAULT false,
  tags          text[] NOT NULL DEFAULT '{}'::text[],
  slot          text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arcade_shop_items_active ON public.arcade_shop_items (active);

-- 6. arcade_inventory — user-owned shop items
CREATE TABLE IF NOT EXISTS public.arcade_inventory (
  developer_id bigint NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  item_id      text NOT NULL REFERENCES public.arcade_shop_items(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (developer_id, item_id)
);

-- 7. arcade_avatars — legacy backwards-compat avatars
CREATE TABLE IF NOT EXISTS public.arcade_avatars (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. arcade_avatar_loadouts — user equipped cosmetics & colors
CREATE TABLE IF NOT EXISTS public.arcade_avatar_loadouts (
  developer_id         bigint PRIMARY KEY REFERENCES public.developers(id) ON DELETE CASCADE,
  skin_color           text NOT NULL DEFAULT '#e8c4a0',
  hair_id              text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  hair_color           text NOT NULL DEFAULT '#1a1a1a',
  clothes_top_id       text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  clothes_top_color    text NOT NULL DEFAULT '#4a9eff',
  clothes_bottom_id    text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  clothes_bottom_color text NOT NULL DEFAULT '#2c3e50',
  clothes_full_id      text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  clothes_full_color   text DEFAULT '#ffffff',
  shoes_id             text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  shoes_color          text NOT NULL DEFAULT '#4a3728',
  eyes_color           text NOT NULL DEFAULT '#4a3728',
  acc_hat_id           text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  acc_hat_color        text DEFAULT '#ffffff',
  acc_face_id          text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  acc_face_color       text DEFAULT '#ffffff',
  acc_facial_id        text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  acc_facial_color     text DEFAULT '#ffffff',
  acc_jewelry_id       text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  acc_jewelry_color    text DEFAULT '#ffffff',
  blush_id             text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  blush_color          text DEFAULT '#ffffff',
  lipstick_id          text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  lipstick_color       text DEFAULT '#ffffff',
  pet_id               text REFERENCES public.arcade_shop_items(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 9. arcade_scores — leaderboard scores
CREATE TABLE IF NOT EXISTS public.arcade_scores (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game       text NOT NULL,
  best_ms    integer NOT NULL,
  attempts   integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game)
);

-- 10. arcade_discoveries — tracked game easter-eggs / achievements
CREATE TABLE IF NOT EXISTS public.arcade_discoveries (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  commands   text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security (RLS) policies
-- ============================================================
ALTER TABLE public.wallets enable row level security;
ALTER TABLE public.arcade_rooms enable row level security;
ALTER TABLE public.arcade_room_favorites enable row level security;
ALTER TABLE public.arcade_room_visits enable row level security;
ALTER TABLE public.arcade_shop_items enable row level security;
ALTER TABLE public.arcade_inventory enable row level security;
ALTER TABLE public.arcade_avatars enable row level security;
ALTER TABLE public.arcade_avatar_loadouts enable row level security;
ALTER TABLE public.arcade_scores enable row level security;
ALTER TABLE public.arcade_discoveries enable row level security;

-- Public Read access
CREATE POLICY "Public read wallets" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Public read arcade_rooms" ON public.arcade_rooms FOR SELECT USING (true);
CREATE POLICY "Public read arcade_shop_items" ON public.arcade_shop_items FOR SELECT USING (true);
CREATE POLICY "Public read arcade_inventory" ON public.arcade_inventory FOR SELECT USING (true);
CREATE POLICY "Public read arcade_avatars" ON public.arcade_avatars FOR SELECT USING (true);
CREATE POLICY "Public read arcade_avatar_loadouts" ON public.arcade_avatar_loadouts FOR SELECT USING (true);
CREATE POLICY "Public read arcade_scores" ON public.arcade_scores FOR SELECT USING (true);

-- Authenticated Write access for personal details
CREATE POLICY "Users toggle favorites" ON public.arcade_room_favorites
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users track visits" ON public.arcade_room_visits
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users edit legacy avatars" ON public.arcade_avatars
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users edit discoveries" ON public.arcade_discoveries
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Seeding Default Shop Catalog
-- ============================================================
INSERT INTO public.arcade_shop_items (id, category, name, file, rarity, price_px, default_color, no_tint, slot, active)
VALUES
  ('buzzcut', 'hair', 'Buzzcut', 'hair/buzzcut_grey.png', 'free', 0, '#1a1a1a', false, 'hair', true),
  ('curly', 'hair', 'Curly Hair', 'hair/curly_grey.png', 'free', 0, '#8B4513', false, 'hair', true),
  ('ponytail', 'hair', 'Ponytail', 'hair/ponytail_grey.png', 'free', 0, '#FFD700', false, 'hair', true),
  ('gentleman', 'hair', 'Gentleman', 'hair/gentleman_grey.png', 'free', 0, '#1a1a1a', false, 'hair', true),
  ('emo', 'hair', 'Emo', 'hair/emo_grey.png', 'free', 0, '#4169E1', false, 'hair', true),
  ('bob', 'hair', 'Bob', 'hair/bob_grey.png', 'free', 0, '#B22222', false, 'hair', true),
  ('basic', 'clothes', 'Basic Shirt', 'clothes/basic_grey.png', 'free', 0, '#4a9eff', false, 'clothes_top', true),
  ('pants', 'clothes', 'Pants', 'clothes/pants_grey.png', 'free', 0, '#2c3e50', false, 'clothes_bottom', true),
  ('shoes', 'shoes', 'Shoes', 'clothes/shoes_grey.png', 'free', 0, '#4a3728', false, 'shoes', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Atomic Transaction Function: arcade_buy_item
-- ============================================================
CREATE OR REPLACE FUNCTION public.arcade_buy_item(
  p_developer_id bigint,
  p_item_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_price bigint;
  v_balance bigint;
  v_exists boolean;
  v_owned boolean;
BEGIN
  -- 1. Advisory lock on developer to serialize transactions
  PERFORM pg_advisory_xact_lock(p_developer_id);

  -- 2. Verify item exists and is active
  SELECT price_px INTO v_price
  FROM public.arcade_shop_items
  WHERE id = p_item_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'item_not_found');
  END IF;

  -- 3. Check if already owned
  SELECT EXISTS (
    SELECT 1 FROM public.arcade_inventory
    WHERE developer_id = p_developer_id AND item_id = p_item_id
  ) INTO v_owned;

  IF v_owned THEN
    RETURN jsonb_build_object('error', 'already_owned');
  END IF;

  -- 4. Get wallet balance (auto-create wallet if missing)
  INSERT INTO public.wallets (developer_id, balance)
  VALUES (p_developer_id, 0)
  ON CONFLICT (developer_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE developer_id = p_developer_id;

  -- 5. Check if enough balance
  IF v_balance < v_price THEN
    RETURN jsonb_build_object('error', 'insufficient_balance');
  END IF;

  -- 6. Debit wallet
  UPDATE public.wallets
  SET balance = balance - v_price,
      updated_at = now()
  WHERE developer_id = p_developer_id;

  -- 7. Insert into inventory
  INSERT INTO public.arcade_inventory (developer_id, item_id)
  VALUES (p_developer_id, p_item_id);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', (v_balance - v_price),
    'price', v_price
  );
END;
$$;
