export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface SocialLoginRequest {
  provider: string;
  access_token: string;
  id_token?: string;
  user_name?: string;
  email?: string;
  display_name?: string;
  photo_url?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface SkillSuggestionRequest {
  user_input: string;
  language: string;
}

export interface SkillSuggestionResponse {
  normalized_name: string;
  category: string;
  difficulty: string;
  estimated_weeks: number;
  similar_skills: string[];
  confidence: number;
  suggestions: string[];
}

export interface AssessmentQuestion {
  id: number;
  question: string;
  options: string[];
  correct_answer: string;
  question_type: string;
}

export interface AssessmentRequest {
  skill_name: string;
  target_duration_weeks?: number;
  language: string;
}

export interface AssessmentResponse {
  questions: AssessmentQuestion[];
  skill_info: {
    skill_name: string;
    target_duration_weeks: number;
    language: string;
  };
}

export interface AssessmentResult {
  question_id: number;
  question: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

export interface RoadmapRequest {
  skill_name: string;
  target_weeks: number;
  current_level: string;
  daily_hours?: number;
}

export interface RoadmapResponse {
  success: boolean;
  roadmap_id: number;
  roadmap: {
    title: string;
    total_weeks: number;
    steps: RoadmapStep[];
  };
  message: string;
}

export interface RoadmapStep {
  step_order: number;
  title: string;
  description: string;
  estimated_hours: number;
  resources: string[];
  projects: string[];
  is_completed?: boolean;
}

export interface RoadmapData {
  id: number;
  title: string;
  description: string;
  total_weeks: number;
  difficulty_level: string;
  steps: RoadmapStep[];
  created_at: string;
}

// Dashboard & Analytics Types
export interface DashboardStats {
  total_roadmaps: number;
  active_roadmaps: number;
  completed_roadmaps: number;
  total_steps: number;
  completed_steps: number;
  completion_percentage: number;
  total_learning_hours: number;
  current_streak: number;
  longest_streak: number;
}

export interface RoadmapSummary {
  id: number;
  title: string;
  description: string;
  total_weeks: number;
  difficulty_level: string;
  total_steps: number;
  completed_steps: number;
  completion_percentage: number;
  created_at: string;
  last_activity?: string;
}

export interface StepProgress {
  step_id: number;
  step_order: number;
  title: string;
  description: string;
  estimated_hours: number;
  is_completed: boolean;
  completed_at?: string;
  resources: string[];
  projects: string[];
}

export interface RoadmapProgress {
  roadmap_id: number;
  title: string;
  total_steps: number;
  completed_steps: number;
  completion_percentage: number;
  steps: StepProgress[];
  next_step?: StepProgress;
}

export interface StepCompletionResponse {
  success: boolean;
  message: string;
  step_id: number;
  completed_steps: number;
  total_steps: number;
  completion_percentage: number;
}

// Notification Types
export interface NotificationPreferenceRequest {
  daily_reminder_enabled: boolean;
  daily_reminder_time: string; // HH:MM format
  step_completion_enabled: boolean;
  streak_warning_enabled: boolean;
  weekly_progress_enabled: boolean;
  do_not_disturb_start: string; // HH:MM format
  do_not_disturb_end: string; // HH:MM format
  timezone?: string; // Auto-detected from device
  device_timezone?: string; // Original device timezone
}

export interface NotificationPreferenceResponse {
  id: number;
  user_id: number;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  step_completion_enabled: boolean;
  streak_warning_enabled: boolean;
  weekly_progress_enabled: boolean;
  do_not_disturb_start: string;
  do_not_disturb_end: string;
  timezone?: string;
  device_timezone?: string;
}

export interface PushTokenRequest {
  push_token: string;
  device_type: string; // mobile, web
}

export interface DailyReminderResponse {
  success: boolean;
  message: string;
  reminder_data?: {
    title: string;
    message: string;
    roadmap_title?: string;
    step_title?: string;
  };
}

export interface NotificationResponse {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  sent_at: string;
  roadmap_title?: string;
  step_title?: string;
}

// Timezone Detection Types
export interface TimezoneInfo {
  timezone: string;
  deviceTimezone: string;
  locale: string;
  country: string;
}

// Gamification Types
export interface GamificationData {
  total_xp: number;
  current_level: number;
  daily_xp_today: number;
  current_streak: number;
  longest_streak: number;
  level_name: string;
  next_level_xp: number;
  achievements_count: number;
}

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned_at?: string;
}

// DailyTask interface kaldırıldı

export interface StudySession {
  roadmap_id?: number;
  step_id?: number;
  duration_minutes: number;
  focus_score?: number;
  notes?: string;
}

export interface StudySessionResponse {
  id: number;
  duration_minutes: number;
  focus_score: number;
  xp_earned: number;
  started_at: string;
  ended_at?: string;
}

// Profile Types
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  created_at: string;
  subscription_type: string;
  gamification: GamificationData;
  achievements: Achievement[];
  total_roadmaps: number;
  completed_roadmaps: number;
  total_study_hours: number;
  is_own_profile: boolean;
} 