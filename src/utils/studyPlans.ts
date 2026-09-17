import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getDualIdArray } from "./identity";

export interface StudyPlan {
  id: string;
  student_id: string;
  course_id?: string | null;
  lesson_id?: string | null;
  title: string;
  scheduled_date: string; // 'yyyy-MM-dd'
  scheduled_time?: string | null; // 'HH:mm'
  duration_minutes: number;
  status: 'planned' | 'completed' | 'missed';
  completed_at?: string | null;
  notes?: string | null;
  courses?: {
    title: string;
    thumbnail_url?: string;
  } | null;
}

export interface StudyGoal {
  target_days_per_week: number;
  target_minutes_per_day: number;
}

const LOCAL_PLANS_KEY = "stemtribe_local_study_plans";
const LOCAL_GOALS_KEY = "stemtribe_local_study_goals";

function getLocalPlans(): StudyPlan[] {
  try {
    const raw = localStorage.getItem(LOCAL_PLANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPlans(plans: StudyPlan[]) {
  try {
    localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error("Failed to save local plans", e);
  }
}

export async function fetchStudyPlans(
  userProfile: any,
  startDate?: string,
  endDate?: string
): Promise<StudyPlan[]> {
  const studentIds = getDualIdArray(userProfile);
  if (studentIds.length === 0) return [];

  try {
    let query = supabase
      .from("study_plans" as any)
      .select("*, courses:courses(title, thumbnail_url)")
      .in("student_id", studentIds);

    if (startDate) {
      query = query.gte("scheduled_date", startDate);
    }
    if (endDate) {
      query = query.lte("scheduled_date", endDate);
    }

    const { data, error } = await query.order("scheduled_date", { ascending: true });
    if (!error && data) {
      return data as StudyPlan[];
    }
  } catch (err) {
    console.warn("Using local storage fallback for study_plans:", err);
  }

  // Fallback to localStorage
  const local = getLocalPlans().filter(p => studentIds.includes(p.student_id));
  return local.filter(p => {
    if (startDate && p.scheduled_date < startDate) return false;
    if (endDate && p.scheduled_date > endDate) return false;
    return true;
  });
}

export async function createStudyPlan(
  userProfile: any,
  plan: Omit<StudyPlan, "id" | "student_id" | "status">
): Promise<StudyPlan> {
  const studentId = userProfile?.auth_user_id || userProfile?.id;
  const newPlan: StudyPlan = {
    ...plan,
    id: crypto.randomUUID(),
    student_id: studentId,
    status: 'planned'
  };

  try {
    const { data, error } = await supabase
      .from("study_plans" as any)
      .insert({
        student_id: studentId,
        course_id: plan.course_id || null,
        lesson_id: plan.lesson_id || null,
        title: plan.title,
        scheduled_date: plan.scheduled_date,
        scheduled_time: plan.scheduled_time || null,
        duration_minutes: plan.duration_minutes || 30,
        status: 'planned',
        notes: plan.notes || null,
      })
      .select("*, courses:courses(title, thumbnail_url)")
      .single();

    if (!error && data) {
      return data as StudyPlan;
    }
  } catch (err) {
    console.warn("Failed remote insert, saving locally:", err);
  }

  // Fallback save to local
  const current = getLocalPlans();
  current.push(newPlan);
  saveLocalPlans(current);
  return newPlan;
}

export async function updateStudyPlanStatus(
  planId: string,
  status: 'planned' | 'completed' | 'missed'
): Promise<boolean> {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;

  try {
    const { error } = await supabase
      .from("study_plans" as any)
      .update({
        status,
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      })
      .eq("id", planId);

    if (!error) {
      // If completed, also log a learning activity for streak points!
      if (status === 'completed') {
        try {
          await supabase.rpc('record_learning_activity', {
            _activity_type: 'study_session',
            _points: 2
          });
        } catch {
          // Non-critical
        }
      }
      return true;
    }
  } catch (err) {
    console.warn("Remote update failed, updating locally:", err);
  }

  // Update local plans
  const local = getLocalPlans();
  const updated = local.map(p => p.id === planId ? { ...p, status, completed_at: completedAt } : p);
  saveLocalPlans(updated);
  return true;
}

export async function deleteStudyPlan(planId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("study_plans" as any)
      .delete()
      .eq("id", planId);

    if (!error) return true;
  } catch (err) {
    console.warn("Remote delete failed, deleting locally:", err);
  }

  const local = getLocalPlans();
  saveLocalPlans(local.filter(p => p.id !== planId));
  return true;
}

export async function fetchStudyGoal(userProfile: any): Promise<StudyGoal> {
  const studentIds = getDualIdArray(userProfile);
  const defaultGoal: StudyGoal = { target_days_per_week: 4, target_minutes_per_day: 30 };

  if (studentIds.length === 0) return defaultGoal;

  try {
    const { data, error } = await supabase
      .from("study_goals" as any)
      .select("target_days_per_week, target_minutes_per_day")
      .in("student_id", studentIds)
      .maybeSingle();

    if (!error && data) {
      return data as StudyGoal;
    }
  } catch (err) {
    console.warn("Using fallback study goals:", err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_GOALS_KEY);
    return raw ? JSON.parse(raw) : defaultGoal;
  } catch {
    return defaultGoal;
  }
}

export async function saveStudyGoal(userProfile: any, goal: StudyGoal): Promise<void> {
  const studentId = userProfile?.auth_user_id || userProfile?.id;
  if (!studentId) return;

  try {
    await supabase
      .from("study_goals" as any)
      .upsert({
        student_id: studentId,
        target_days_per_week: goal.target_days_per_week,
        target_minutes_per_day: goal.target_minutes_per_day,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id' });
  } catch (err) {
    console.warn("Remote goal upsert failed, saving locally:", err);
  }

  localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(goal));
}
