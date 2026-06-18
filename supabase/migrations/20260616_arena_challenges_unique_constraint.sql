-- Migration: add UNIQUE(challenge_date, type, difficulty) to arena_challenges
-- Fixes the TOCTOU race in rotateDailyChallenges.
--
-- Two overlapping cron invocations both pass the JS-level guard (SELECT count)
-- and then both INSERT, producing duplicate daily challenges for the same date.
-- This constraint makes the second insert a safe no-op when combined with the
-- upsert change in arena.ts.
--
-- ON CONFLICT DO NOTHING is safe here: the first writer wins and sets the
-- canonical challenge; any concurrent or retry invocation is silently ignored.

ALTER TABLE arena_challenges
  ADD CONSTRAINT arena_challenges_date_type_difficulty_unique
  UNIQUE (challenge_date, type, difficulty);