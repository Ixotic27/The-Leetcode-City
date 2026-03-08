-- Sky Ads self-service purchase flow columns
ALTER TABLE sky_ads ADD COLUMN IF NOT EXISTS purchaser_email TEXT;
ALTER TABLE sky_ads ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE sky_ads ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE sky_ads ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;
