import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig, selectBestEndpoint } from '../config/environment';
import {
  AuthResponse,
  UserLogin,
  UserCreate,
  SkillSuggestionRequest,
  SkillSuggestionResponse,
  AssessmentRequest,
  AssessmentResponse,
  RoadmapRequest,
  RoadmapResponse,
  RoadmapData,
  DashboardStats,
  RoadmapSummary,
  RoadmapProgress,
  StepCompletionResponse,
  NotificationPreferenceRequest,
  NotificationPreferenceResponse,
  PushTokenRequest,
  DailyReminderResponse,
  NotificationResponse,
} from '../types';

let API_BASE_URL = AppConfig.API_BASE_URL;

// Token Manager
export class TokenManager {
  private static readonly TOKEN_KEY = 'skillpath_token';
  private static readonly USER_KEY = 'skillpath_user';

  static async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(this.TOKEN_KEY, token);
  }

  static async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(this.TOKEN_KEY);
  }

  static async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(this.TOKEN_KEY);
    await AsyncStorage.removeItem(this.USER_KEY);
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  static async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static async getUser(): Promise<any> {
    const userData = await AsyncStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }
}

// API Helper
class ApiClient {
  private initialized = false;

  private async initialize() {
    if (!this.initialized) {
      console.log('🔄 API Client initializing...');
      try {
        API_BASE_URL = await selectBestEndpoint();
        console.log('✅ API Base URL set to:', API_BASE_URL);
      } catch (error) {
        console.log('⚠️ Failed to select best endpoint, using default:', API_BASE_URL);
      }
      this.initialized = true;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.initialize();
    
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await TokenManager.getToken();

    console.log('Making API request to:', url);
    console.log('Token being sent:', token ? `${token.substring(0, 20)}...` : 'No token');
    console.log('Request options:', JSON.stringify(options, null, 2));

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    console.log('Request config headers:', JSON.stringify(config.headers, null, 2));

    try {
      console.log('Sending request...');
      const response = await fetch(url, config);
      
      console.log('API response status:', response.status);
      console.log('API response headers:', JSON.stringify(response.headers, null, 2));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        console.error('API error:', errorMessage);
        
        // 401 Unauthorized hatası için özel handling
        if (response.status === 401) {
          console.error('Authentication failed. Token:', token ? 'Present' : 'Missing');
          if (token) {
            console.error('Token preview:', token.substring(0, 50) + '...');
          }
          
          // Login endpoint'i için farklı hata mesajı
          if (endpoint === '/api/auth/login') {
            throw new Error('Geçersiz email veya şifre');
          }
          
          // Diğer endpoint'ler için token temizle ve yeniden login gerektiğini belirt
          await TokenManager.removeToken();
          throw new Error('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('API response success:', endpoint);
      console.log('Response data:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('API request failed for:', url, error);
      console.error('Error type:', typeof error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error message:', errorMessage);
      
      if (error instanceof Error && error.stack) {
        console.error('Error stack:', error.stack);
      }
      
      if (error instanceof TypeError && errorMessage.includes('Network request failed')) {
        throw new Error('Sunucuya bağlanılamıyor. Lütfen:\n1. İnternet bağlantınızı kontrol edin\n2. Backend sunucusunun çalıştığından emin olun\n3. IP adresinin doğru olduğunu kontrol edin (192.168.1.133:8000)');
      }
      if (errorMessage.includes('timeout')) {
        throw new Error('İstek zaman aşımına uğradı. Sunucu yanıt vermiyor.');
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

const apiClient = new ApiClient();

// Auth API
export const login = async (credentials: UserLogin): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/login', credentials);
  await TokenManager.setToken(response.access_token);
  await TokenManager.setUser(response.user);
  return response;
};

export const register = async (userData: UserCreate): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/register', userData);
  await TokenManager.setToken(response.access_token);
  await TokenManager.setUser(response.user);
  return response;
};

export const logout = async (): Promise<void> => {
  await TokenManager.removeToken();
};

// Skill API
export const suggestSkill = async (
  request: SkillSuggestionRequest
): Promise<SkillSuggestionResponse> => {
  return apiClient.post<SkillSuggestionResponse>('/api/skills/suggest', request);
};

export const generateAssessment = async (
  request: AssessmentRequest
): Promise<AssessmentResponse> => {
  return apiClient.post<AssessmentResponse>('/api/skills/assessment', request);
};

export const generateRoadmap = async (data: {
  skill_name: string;
  target_weeks: number;
  current_level: string;
  daily_hours: number;
}): Promise<RoadmapResponse> => {
  return apiClient.post<RoadmapResponse>('/api/roadmap/create', data);
};

export const getRoadmap = async (roadmapId: string): Promise<{ roadmap: RoadmapData }> => {
  return apiClient.get<{ roadmap: RoadmapData }>(`/api/roadmap/${roadmapId}`);
};

// Dashboard & Analytics API
export const getDashboardStats = async (): Promise<DashboardStats> => {
  return apiClient.get<DashboardStats>('/api/user/dashboard');
};

export const getUserRoadmaps = async (): Promise<RoadmapSummary[]> => {
  return apiClient.get<RoadmapSummary[]>('/api/user/roadmaps');
};

export const getRoadmapProgress = async (roadmapId: number): Promise<RoadmapProgress> => {
  return apiClient.get<RoadmapProgress>(`/api/roadmap/${roadmapId}/progress`);
};

export const completeStep = async (roadmapId: number, stepId: number): Promise<StepCompletionResponse> => {
  return apiClient.put<StepCompletionResponse>(`/api/roadmap/${roadmapId}/step/${stepId}/complete`);
};

export const uncompleteStep = async (roadmapId: number, stepId: number): Promise<StepCompletionResponse> => {
  return apiClient.put<StepCompletionResponse>(`/api/roadmap/${roadmapId}/step/${stepId}/uncomplete`);
};

// Health Check
export const healthCheck = async (): Promise<{ status: string; service: string }> => {
  return apiClient.get<{ status: string; service: string }>('/api/health');
};

// Notification API
export const updateNotificationPreferences = async (
  preferences: NotificationPreferenceRequest
): Promise<NotificationPreferenceResponse> => {
  return apiClient.post<NotificationPreferenceResponse>('/api/notifications/preferences', preferences);
};

export const getNotificationPreferences = async (): Promise<NotificationPreferenceResponse> => {
  return apiClient.get<NotificationPreferenceResponse>('/api/notifications/preferences');
};

export const getDailyReminder = async (): Promise<DailyReminderResponse> => {
  return apiClient.get<DailyReminderResponse>('/api/notifications/daily-reminder');
};

export const registerPushToken = async (
  request: PushTokenRequest
): Promise<{ success: boolean; message: string }> => {
  return apiClient.post<{ success: boolean; message: string }>('/api/notifications/push-token', request);
};

export const getNotificationHistory = async (
  limit: number = 20
): Promise<NotificationResponse[]> => {
  return apiClient.get<NotificationResponse[]>(`/api/notifications/history?limit=${limit}`);
};

// Streak API
export const getStreakData = async (): Promise<any> => {
  const response = await apiClient.get<any>('/api/notifications/streak');
  return response.streak_data;
};

export const testStreakWarnings = async (): Promise<any> => {
  const response = await apiClient.post<any>('/api/notifications/test-streak');
  return response;
};

// Community API
export interface CommunityStats {
  total_posts: number;
  total_replies: number;
  active_users: number;
  popular_skills: Array<{
    name: string;
    post_count: number;
    learner_count: number;
  }>;
}

export interface CommunityPost {
  id: number;
  title: string;
  content: string;
  skill_name?: string;
  post_type: string;
  likes_count: number;
  replies_count: number;
  is_expert_post: boolean;
  author_name: string;
  author_id: number;
  is_liked: boolean;
  created_at: string;
}

export interface CommunityReply {
  id: number;
  content: string;
  likes_count: number;
  author_name: string;
  author_id: number;
  is_liked: boolean;
  created_at: string;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  skill_name?: string;
  post_type?: string;
}

export interface CreateReplyRequest {
  content: string;
}

export const getCommunityStats = async (): Promise<CommunityStats> => {
  return apiClient.get('/api/community/stats');
};

export const getCommunityPosts = async (
  filterType: string = 'all',
  skillName?: string,
  limit: number = 20,
  offset: number = 0
): Promise<CommunityPost[]> => {
  let endpoint = `/api/community/posts?filter_type=${filterType}&limit=${limit}&offset=${offset}`;
  if (skillName) {
    endpoint += `&skill_name=${encodeURIComponent(skillName)}`;
  }
  return apiClient.get(endpoint);
};

export const createCommunityPost = async (
  postData: CreatePostRequest
): Promise<CommunityPost> => {
  return apiClient.post('/api/community/posts', postData);
};

export const togglePostLike = async (
  postId: number
): Promise<{ success: boolean; is_liked: boolean; likes_count: number }> => {
  return apiClient.post(`/api/community/posts/${postId}/like`);
};

export const getPostReplies = async (postId: number): Promise<CommunityReply[]> => {
  return apiClient.get(`/api/community/posts/${postId}/replies`);
};

export const createReply = async (
  postId: number,
  replyData: CreateReplyRequest
): Promise<CommunityReply> => {
  return apiClient.post(`/api/community/posts/${postId}/replies`, replyData);
};

export const toggleReplyLike = async (
  replyId: number
): Promise<{ success: boolean; is_liked: boolean; likes_count: number }> => {
  return apiClient.post(`/api/community/replies/${replyId}/like`);
};

// Gamification API
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

export const getUserGamification = async (): Promise<GamificationData> => {
  return apiClient.get<GamificationData>('/api/user/gamification');
};

export const getUserAchievements = async (): Promise<Achievement[]> => {
  return apiClient.get<Achievement[]>('/api/user/achievements');
};

// Daily task fonksiyonları kaldırıldı

export const createStudySession = async (
  sessionData: StudySession
): Promise<StudySessionResponse> => {
  return apiClient.post<StudySessionResponse>('/api/study-sessions', sessionData);
};

// Profile API
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

export const getUserProfile = async (userId: number): Promise<UserProfile> => {
  return apiClient.get<UserProfile>(`/api/user/profile/${userId}`);
};

export const getOwnProfile = async (): Promise<UserProfile> => {
  return apiClient.get<UserProfile>('/api/user/profile');
};