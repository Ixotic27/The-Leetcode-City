-- Enable public read access for customizations and purchases so contributors
-- can test frontend features locally without needing the service role key.

-- 1. purchases
DROP POLICY IF EXISTS "Public read purchases" ON purchases;
DROP POLICY IF EXISTS "Owner reads own purchases" ON purchases;

CREATE POLICY "Public read purchases" ON purchases
  FOR SELECT USING (true);

-- 2. developer_customizations
DROP POLICY IF EXISTS "Public read customizations" ON developer_customizations;
DROP POLICY IF EXISTS "Owner reads own customizations" ON developer_customizations;

CREATE POLICY "Public read customizations" ON developer_customizations
  FOR SELECT USING (true);

-- 3. developer_achievements
DROP POLICY IF EXISTS "Public read achievements" ON developer_achievements;
CREATE POLICY "Public read achievements" ON developer_achievements
  FOR SELECT USING (true);
