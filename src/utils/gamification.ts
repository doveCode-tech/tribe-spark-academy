import { supabase } from "@/integrations/supabase/client";
import { getDualIdArray } from "./identity";
import { createNotification } from "./notifications";

export interface LevelInfo {
  level: number;
  title: string;
  badge: string;
  color: string;
  minXP: number;
  maxXP: number;
  description: string;
}

export const LEVEL_TIERS: LevelInfo[] = [
  {
    level: 1,
    title: "Explorer",
    badge: "🧭",
    color: "#3B82F6",
    minXP: 0,
    maxXP: 499,
    description: "Beginning the journey into the universe of STEM!"
  },
  {
    level: 2,
    title: "Apprentice",
    badge: "⚡",
    color: "#10B981",
    minXP: 500,
    maxXP: 1499,
    description: "Building foundational coding and problem-solving skills."
  },
  {
    level: 3,
    title: "Innovator",
    badge: "💡",
    color: "#8B5CF6",
    minXP: 1500,
    maxXP: 2999,
    description: "Creating interactive projects and experimenting with logic."
  },
  {
    level: 4,
    title: "Technologist",
    badge: "🚀",
    color: "#EC4899",
    minXP: 3000,
    maxXP: 4999,
    description: "Mastering complex algorithms, robotics, and design patterns."
  },
  {
    level: 5,
    title: "Master Mind",
    badge: "🔮",
    color: "#F59E0B",
    minXP: 5000,
    maxXP: 7499,
    description: "Solving real-world challenges and engineering full-stack creations."
  },
  {
    level: 6,
    title: "STEM Champion",
    badge: "👑",
    color: "#EF4444",
    minXP: 7500,
    maxXP: Infinity,
    description: "The pinnacle of excellence! An inspirational leader in the STEM Tribe."
  }
];

export const XP_REWARDS = {
  LESSON_COMPLETE: 50,
  QUIZ_PASSED: 30,
  PROJECT_SUBMITTED: 100,
  PROJECT_GRADED_BONUS: 150,
  DAILY_STREAK: 20,
  STREAK_7_DAYS: 100,
  STREAK_30_DAYS: 300,
  STUDY_SESSION: 40,
};

export interface LevelProgress {
  currentLevel: LevelInfo;
  nextLevel: LevelInfo | null;
  totalXP: number;
  xpIntoCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPercentage: number;
  isMaxLevel: boolean;
}

export function calculateLevel(totalXP: number): LevelProgress {
  const safeXP = Math.max(0, totalXP || 0);

  let currentTier = LEVEL_TIERS[0];
  let nextTier: LevelInfo | null = LEVEL_TIERS[1] || null;

  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    const tier = LEVEL_TIERS[i];
    if (safeXP >= tier.minXP) {
      currentTier = tier;
      nextTier = LEVEL_TIERS[i + 1] || null;
    }
  }

  if (!nextTier) {
    // Max level
    return {
      currentLevel: currentTier,
      nextLevel: null,
      totalXP: safeXP,
      xpIntoCurrentLevel: safeXP - currentTier.minXP,
      xpNeededForNextLevel: 0,
      progressPercentage: 100,
      isMaxLevel: true
    };
  }

  const range = nextTier.minXP - currentTier.minXP;
  const progressIntoRange = safeXP - currentTier.minXP;
  const percentage = Math.min(100, Math.max(0, Math.round((progressIntoRange / range) * 100)));
  const needed = Math.max(0, nextTier.minXP - safeXP);

  return {
    currentLevel: currentTier,
    nextLevel: nextTier,
    totalXP: safeXP,
    xpIntoCurrentLevel: progressIntoRange,
    xpNeededForNextLevel: needed,
    progressPercentage: percentage,
    isMaxLevel: false
  };
}

const LOCAL_XP_KEY = "stemtribe_local_xp_total";
const LEVEL_UP_EVENT_KEY = "stemtribe_pending_levelup";

export async function fetchStudentXP(userProfileOrId: any): Promise<number> {
  if (!userProfileOrId) return 0;
  let studentIds: string[] = [];
  if (typeof userProfileOrId === "string") {
    studentIds = [userProfileOrId];
  } else if (Array.isArray(userProfileOrId)) {
    studentIds = userProfileOrId;
  } else {
    studentIds = getDualIdArray(userProfileOrId);
  }
  if (studentIds.length === 0) return 0;

  try {
    const { data, error } = await supabase.rpc("get_student_xp");
    if (!error && data && typeof (data as any).total_xp === "number") {
      const xp = (data as any).total_xp;
      localStorage.setItem(`${LOCAL_XP_KEY}_${studentIds[0]}`, String(xp));
      return xp;
    }
  } catch {
    // Fallback
  }

  try {
    const { data: txData, error: txError } = await (supabase as any)
      .from("student_xp_transactions")
      .select("xp_amount")
      .in("student_id", studentIds);

    if (!txError && txData && txData.length > 0) {
      const sum = txData.reduce((acc: number, item: any) => acc + (Number(item.xp_amount) || 0), 0);
      localStorage.setItem(`${LOCAL_XP_KEY}_${studentIds[0]}`, String(sum));
      return sum;
    }
  } catch {
    // Fallback
  }

  // Check sum from local storage
  const stored = localStorage.getItem(`${LOCAL_XP_KEY}_${studentIds[0]}`);
  return stored ? parseInt(stored, 10) : 120;
}

export async function awardXP(
  userProfile: any,
  xpAmount: number,
  reason: string,
  referenceId?: string
): Promise<{ success: boolean; newTotalXP: number; leveledUp: boolean; newLevel?: LevelInfo }> {
  const studentId = userProfile?.auth_user_id || userProfile?.id;
  if (!studentId) return { success: false, newTotalXP: 0, leveledUp: false };

  const currentTotal = await fetchStudentXP(userProfile);
  const oldLevel = calculateLevel(currentTotal).currentLevel;

  let newTotal = currentTotal + xpAmount;
  let success = true;

  try {
    const { data, error } = await supabase.rpc("award_student_xp", {
      _student_id: studentId,
      _xp_amount: xpAmount,
      _reason: reason,
      _reference_id: referenceId || null
    });

    if (!error && data && (data as any).success) {
      newTotal = (data as any).total_xp;
    }
  } catch (e) {
    console.warn("Using local XP award fallback:", e);
  }

  localStorage.setItem(`${LOCAL_XP_KEY}_${studentId}`, String(newTotal));
  const newLevelProgress = calculateLevel(newTotal);
  const leveledUp = newLevelProgress.currentLevel.level > oldLevel.level;

  if (leveledUp) {
    try {
      localStorage.setItem(
        LEVEL_UP_EVENT_KEY,
        JSON.stringify({
          oldLevel: oldLevel.level,
          newLevel: newLevelProgress.currentLevel,
          timestamp: Date.now()
        })
      );
      window.dispatchEvent(new CustomEvent("stemtribe-levelup", { detail: newLevelProgress.currentLevel }));
      playCelebrationChime();

      // Dispatch in-app notification for the student
      createNotification({
        recipientUserId: studentId,
        type: "level_up",
        title: `Level Up! ${newLevelProgress.currentLevel.badge} Level ${newLevelProgress.currentLevel.level}: ${newLevelProgress.currentLevel.title}`,
        message: `Congratulations! You unlocked ${newLevelProgress.currentLevel.title} with ${newTotal} XP! Keep up the brilliant STEM work!`,
        data: {
          level: newLevelProgress.currentLevel.level,
          title: newLevelProgress.currentLevel.title,
          badge: newLevelProgress.currentLevel.badge,
          totalXP: newTotal
        }
      }).catch(err => console.warn("Failed to dispatch level-up notification:", err));
    } catch {
      // Audio context might be restricted before interaction
    }
  }

  return {
    success,
    newTotalXP: newTotal,
    leveledUp,
    newLevel: leveledUp ? newLevelProgress.currentLevel : undefined
  };
}

/**
 * Native Web Audio chime to celebrate level ups and milestones without audio file assets
 */
export function playCelebrationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Major arpeggio)
    const startTime = ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + index * 0.12);

      gain.gain.setValueAtTime(0, startTime + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.3, startTime + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + index * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + index * 0.12);
      osc.stop(startTime + index * 0.12 + 0.4);
    });
  } catch {
    // Non-blocking
  }
}
