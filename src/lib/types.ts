// Core domain model for FitPilot. All weights are stored in kilograms; the UI converts for display.

export type Muscle =
  | 'chest' | 'back' | 'lats' | 'shoulders' | 'rear_delts' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'traps' | 'lower_back' | 'adductors';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'bands' | 'kettlebell' | 'bench' | 'pullup_bar' | 'smith';

export type Pattern =
  | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull' | 'squat' | 'hinge' | 'lunge'
  | 'knee_extension' | 'knee_flexion' | 'calf' | 'chest_fly' | 'lateral_raise' | 'rear_delt' | 'bicep_curl'
  | 'tricep_extension' | 'core' | 'shrug' | 'hip_thrust';

export type Goal = 'build_muscle' | 'lose_fat' | 'recomp' | 'strength' | 'general';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Gender = 'male' | 'female' | 'other' | 'unspecified';
export type SplitType = 'full_body' | 'upper_lower' | 'ppl' | 'body_part';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment[];
  compound: boolean;
  description: string;
  steps: string[];
  mistakes: string[];
  /** Conservative starting load as a fraction of bodyweight (beginner, male baseline). 0 = bodyweight exercise. */
  startRatio: number;
  /** Smallest sensible load jump in kg. */
  increment: number;
  /** Loads per dumbbell (true) vs total load. Purely informational for display. */
  perHand?: boolean;
  /** Injury keywords this exercise tends to aggravate. */
  avoidWith?: string[];
  demoUrl?: string;
}

export interface Profile {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  experience: Experience;
  trainingDays: number[]; // 0 = Sunday … 6 = Saturday
  preferredTime: 'morning' | 'midday' | 'evening' | 'flexible';
  location: 'gym' | 'home';
  equipment: Equipment[];
  diet: string[];
  limitations: string;
  units: 'metric' | 'imperial';
  split: SplitType;
  targets: NutritionTargets;
  createdAt: string;
}

export interface NutritionTargets { calories: number; protein: number; carbs: number; fat: number }

export interface PlannedExercise {
  uid: string;
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weightKg: number | null; // null = bodyweight
  restSec: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  focus: Muscle[];
  exercises: PlannedExercise[];
}

export interface Plan {
  id: string;
  createdAt: string;
  split: SplitType;
  templates: WorkoutTemplate[];
  /** weekday → template id */
  week: Record<number, string>;
}

export type WorkoutStatus = 'planned' | 'in_progress' | 'completed' | 'partial' | 'missed' | 'skipped' | 'rest';

export interface ScheduledWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  templateId: string | null; // null = rest day
  status: WorkoutStatus;
  sessionId?: string;
  note?: string;
  movedFrom?: string; // original date if rescheduled
  /** True when the user (not the app) set the status. */
  reported?: boolean;
}

export interface SetLog { weightKg: number | null; reps: number; done: boolean }

export interface ExerciseLog {
  uid: string;
  exerciseId: string;
  replacedFrom?: string;
  status: 'pending' | 'done' | 'partial' | 'skipped';
  repsMin: number;
  repsMax: number;
  plannedWeightKg: number | null;
  restSec: number;
  sets: SetLog[];
}

export interface Session {
  id: string;
  scheduledId?: string;
  date: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  pausedAt?: number;
  pausedMs: number;
  state: 'active' | 'paused' | 'finished';
  /** 'tracked' = logged set-by-set in the app; 'reported' = user told us after the fact. */
  source: 'tracked' | 'reported';
  /** For reported sessions with no set detail: muscles the user said they trained. */
  reportedMuscles?: Muscle[];
  exercises: ExerciseLog[];
  restEndsAt?: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

export interface MealItem extends Macros {
  name: string;
  qty: number;
  unit: string;
  grams: number;
  foodId?: string;
  /** True when quantity or identity was guessed and the user has not confirmed it. */
  uncertain?: boolean;
}

export interface MealEntry {
  id: string;
  date: string;
  slot: MealSlot;
  items: MealItem[];
  source: 'manual' | 'text' | 'photo' | 'coach';
  estimated: boolean;
  createdAt: number;
  photo?: string; // small data URL thumbnail
}

export interface CustomFood {
  id: string;
  name: string;
  per100g: Macros;
  units: { name: string; grams: number }[];
}

export interface SavedMeal { id: string; name: string; items: MealItem[] }

export interface BodyLog {
  id: string;
  date: string;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  thighsCm?: number;
}

export interface SorenessLog { date: string; muscles: Muscle[] }

export interface NotificationSettings {
  enabled: boolean;
  workoutReminder: boolean;
  checkInReminder: boolean;
  nutritionReminder: boolean;
  proteinNudge: boolean;
  restDay: boolean;
  weeklyReport: boolean;
  frequency: 'minimal' | 'normal';
  quietStart: string; // "22:00"
  quietEnd: string; // "07:00"
}

export interface AiSettings {
  apiKey: string;
  model: string;
}

/** A change the coach proposes. Nothing is applied until the user confirms. */
export type Proposal =
  | { kind: 'set_status'; scheduledId: string; status: WorkoutStatus; note?: string }
  | { kind: 'report_partial'; scheduledId: string; doneExerciseIds: string[]; muscles: Muscle[] }
  | { kind: 'report_different'; scheduledId: string | null; date: string; muscles: Muscle[]; name: string }
  | { kind: 'log_meal'; meal: Omit<MealEntry, 'id' | 'createdAt'> }
  | { kind: 'log_sets'; date: string; exerciseId: string; sets: SetLog[] }
  | { kind: 'reschedule'; moves: { scheduledId: string | null; templateId: string; toDate: string; fromDate?: string }[]; drop?: string[] }
  | { kind: 'update_weight'; templateId: string; uid: string; exerciseId: string; weightKg: number }
  | { kind: 'replace_exercise'; templateId: string; uid: string; exerciseId: string }
  | { kind: 'set_targets'; targets: NutritionTargets }
  | { kind: 'move_training_day'; fromDay: number; toDay: number }
  | { kind: 'log_soreness'; muscles: Muscle[] };

export interface ProposalCard {
  id: string;
  title: string;
  detail: string;
  actions: Proposal[];
  state: 'pending' | 'applied' | 'dismissed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  ts: number;
  cards?: ProposalCard[];
  ai?: boolean; // generated by the remote AI model
}

export interface AppState {
  version: 1;
  profile: Profile | null;
  plan: Plan | null;
  schedule: ScheduledWorkout[];
  sessions: Session[];
  activeSessionId: string | null;
  meals: MealEntry[];
  customFoods: CustomFood[];
  savedMeals: SavedMeal[];
  body: BodyLog[];
  soreness: SorenessLog[];
  chat: ChatMessage[];
  notifications: NotificationSettings;
  ai: AiSettings;
  dismissedInsights: string[];
}
