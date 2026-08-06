-- Shared Instance Management (opt-in team collaboration)
-- Used by /instance and /api/instance/*

CREATE TABLE IF NOT EXISTS public.shared_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_token text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_instances_name_len CHECK (char_length(trim(name)) BETWEEN 2 AND 80)
);

CREATE TABLE IF NOT EXISTS public.shared_instance_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.shared_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, user_id),
  CONSTRAINT shared_instance_memberships_display_name_len CHECK (char_length(trim(display_name)) BETWEEN 1 AND 64)
);

CREATE INDEX IF NOT EXISTS idx_shared_instances_owner ON public.shared_instances (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_instances_invite_token ON public.shared_instances (invite_token);
CREATE INDEX IF NOT EXISTS idx_shared_instance_memberships_user ON public.shared_instance_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_shared_instance_memberships_instance_status
  ON public.shared_instance_memberships (instance_id, status);

ALTER TABLE public.shared_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_instance_memberships ENABLE ROW LEVEL SECURITY;

-- Members can read their instance; owners manage via service role in API routes.
CREATE POLICY "Members read shared_instances"
  ON public.shared_instances FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.shared_instance_memberships m
      WHERE m.instance_id = shared_instances.id
        AND m.user_id = auth.uid()
        AND m.status IN ('pending', 'approved')
    )
  );

CREATE POLICY "Owners insert shared_instances"
  ON public.shared_instances FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Members read own memberships"
  ON public.shared_instance_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.shared_instances i
      WHERE i.id = shared_instance_memberships.instance_id
        AND i.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own memberships"
  ON public.shared_instance_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update memberships"
  ON public.shared_instance_memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_instances i
      WHERE i.id = shared_instance_memberships.instance_id
        AND i.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete own pending memberships"
  ON public.shared_instance_memberships FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');
