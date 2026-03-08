-- Add dev and first citizen flags to developers table
alter table developers add column if not exists is_dev boolean not null default false;
alter table developers add column if not exists is_first_citizen boolean not null default false;

-- Update RLS if necessary (it shouldn't be for public read, but keep in mind for future writes)
