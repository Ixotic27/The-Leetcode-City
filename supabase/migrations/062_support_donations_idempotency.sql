CREATE TABLE IF NOT EXISTS public.support_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,
    amount_inr INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.support_donations ENABLE ROW LEVEL SECURITY;
