import { supabase } from "@/integrations/supabase/client";

/**
 * Award streak badges based on current streak count
 * This function checks the user's current streak and awards appropriate badges
 */
export async function awardStreakBadges(): Promise<void> {
  try {
    await supabase.rpc('award_streak_badges');
  } catch (error) {
    console.error('Error awarding streak badges:', error);
    // Don't throw - badge awarding shouldn't break the main flow
  }
}

/**
 * Check if user has earned a specific streak badge
 */
export async function hasStreakBadge(days: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('id')
      .eq('criteria->>type', 'streak')
      .eq('criteria->>days', days.toString())
      .single();

    if (error || !data) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: studentBadge } = await supabase
      .from('student_badges')
      .select('id')
      .eq('student_id', user.id)
      .eq('badge_id', data.id)
      .maybeSingle();

    return !!studentBadge;
  } catch (error) {
    console.error('Error checking streak badge:', error);
    return false;
  }
}

/**
 * Get all streak milestone badges
 */
export async function getStreakBadges(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .eq('criteria->>type', 'streak')
      .order('criteria->>days');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting streak badges:', error);
    return [];
  }
}

/**
 * Get user's earned streak badges
 */
export async function getUserStreakBadges(): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('student_badges')
      .select(`
        earned_at,
        badges(*)
      `)
      .eq('student_id', user.id)
      .in('badge_id', (
        supabase
          .from('badges')
          .select('id')
          .eq('criteria->>type', 'streak')
      ) as any);

    if (error) throw error;
    return data?.map(b => ({ ...b.badges, earned_at: b.earned_at })) || [];
  } catch (error) {
    console.error('Error getting user streak badges:', error);
    return [];
  }
}
