-- ============================================================
-- 046: Enable Missing Row Level Security (RLS)
-- Enables RLS and sets up public read policies for:
-- districts, district_changes, milestone_celebrations, and xp_log.
-- ============================================================

-- 1. districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read districts" ON public.districts;
CREATE POLICY "Public read districts" ON public.districts
  FOR SELECT USING (true);

-- 2. district_changes
ALTER TABLE public.district_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read district_changes" ON public.district_changes;
CREATE POLICY "Public read district_changes" ON public.district_changes
  FOR SELECT USING (true);

-- 3. milestone_celebrations
ALTER TABLE public.milestone_celebrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read milestone_celebrations" ON public.milestone_celebrations;
CREATE POLICY "Public read milestone_celebrations" ON public.milestone_celebrations
  FOR SELECT USING (true);

-- 4. xp_log
ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read xp_log" ON public.xp_log;
CREATE POLICY "Public read xp_log" ON public.xp_log
  FOR SELECT USING (true);
