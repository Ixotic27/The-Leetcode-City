import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mock Supabase Client Configuration
// (Replace this with your actual shared Supabase client import, e.g., 
// import { supabase } from '../lib/supabaseClient')
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Schema Configurations & Typings
// ---------------------------------------------------------------------------
export interface DeveloperStats {
  commits: number;
  repositories: number;
  stars: number;
  referrals: number;
  gifts: number;
  kudos: number;
}

export interface AchievementDefinition {
  id: string;
  category: keyof DeveloperStats;
  threshold: number;
  title: string;
}

// Milestone Definitions
const ACHIEVEMENT_MILESTONES: AchievementDefinition[] = [
  { id: 'commits_10', category: 'commits', threshold: 10, title: 'Commit Initiate' },
  { id: 'commits_100', category: 'commits', threshold: 100, title: 'Centurion Coder' },
  { id: 'repos_5', category: 'repositories', threshold: 5, title: 'Repo Architect' },
  { id: 'stars_50', category: 'stars', threshold: 50, title: 'Rising Star' },
  { id: 'referrals_3', category: 'referrals', threshold: 3, title: 'Community Builder' },
  { id: 'gifts_5', category: 'gifts', threshold: 5, title: 'Generous Spirit' },
  { id: 'kudos_20', category: 'kudos', threshold: 20, title: 'Highly Appreciated' }
];

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Evaluates a developer's current stats against achievement thresholds and
 * unlocks new achievements, logging the events to the activity feed.
 * * @param developerId - The UUID of the developer
 * @param currentStats - The current statistics/metrics for the developer
 */
export async function evaluateAndUnlockAchievements(
  developerId: string,
  currentStats: any // Maintained 'any' per requirements, ideally cast to DeveloperStats
): Promise<void> {
  try {
    // 1. Anti-Duplication Guard: Fetch currently unlocked achievements
    const { data: unlockedData, error: fetchError } = await supabase
      .from('developer_achievements')
      .select('achievement_id')
      .eq('developer_id', developerId);

    if (fetchError) {
      throw new Error(`Failed to fetch existing achievements: ${fetchError.message}`);
    }

    const previouslyUnlocked = new Set(unlockedData?.map(row => row.achievement_id) || []);

    // 2. Threshold Evaluation Logic
    const achievementsToUnlock = ACHIEVEMENT_MILESTONES.filter(milestone => {
      // Skip if already unlocked
      if (previouslyUnlocked.has(milestone.id)) {
        return false;
      }
      
      // Safely check the stat value
      const statValue = Number(currentStats[milestone.category]) || 0;
      return statValue >= milestone.threshold;
    });

    // Short-circuit if nothing new to unlock
    if (achievementsToUnlock.length === 0) {
      return;
    }

    // 3 & 4. Unlock Achievements and Trigger Activity Feed Hooks
    for (const achievement of achievementsToUnlock) {
      // Begin logical transaction for a single achievement
      const { error: insertAchievementError } = await supabase
        .from('developer_achievements')
        .insert({
          developer_id: developerId,
          achievement_id: achievement.id,
          unlocked_at: new Date().toISOString()
        });

      if (insertAchievementError) {
        console.error(`[AchievementService] Failed to unlock ${achievement.id} for ${developerId}:`, insertAchievementError);
        continue; // Prevent feed logging if unlock failed, but proceed with next achievements
      }

      // Log to Activity Feed array
      const { error: feedError } = await supabase
        .from('activity_feed')
        .insert({
          developer_id: developerId,
          activity_type: 'ACHIEVEMENT_UNLOCKED',
          description: `Unlocked the "${achievement.title}" badge!`,
          metadata: { achievement_id: achievement.id },
          created_at: new Date().toISOString()
        });

      if (feedError) {
        console.error(`[AchievementService] Failed to insert activity feed for ${achievement.id}:`, feedError);
      }
    }
  } catch (error) {
    console.error('[AchievementService] Critical error during evaluation:', error);
    throw error;
  }
}
