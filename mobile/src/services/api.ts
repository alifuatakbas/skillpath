import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/environment';
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
  SocialLoginRequest,
} from '../types';

const API_BASE_URL = AppConfig.API_BASE_URL;

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
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await TokenManager.getToken();



    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };


    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        
        // Special handling for 401 Unauthorized error
        if (response.status === 401) {
          if (token) {
          }
          // Clear token and indicate re-login is required
          await TokenManager.removeToken();
          throw new Error('Session expired. Please log in again.');
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      return data;
    } catch (error) {
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (error instanceof Error && error.stack) {
      }
      
      if (error instanceof TypeError && errorMessage.includes('Network request failed')) {
        throw new Error('Cannot connect to server. Please check your internet connection.');
      }
      if (errorMessage.includes('timeout')) {
        throw new Error('Request timed out. Server is not responding.');
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

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
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

// Account API
export const deleteAccount = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await apiClient.delete<{ success: boolean; message?: string }>(
      '/api/user/delete-account'
    );
    // Local storage temizle
    await TokenManager.removeToken();
    return res;
  } catch (err) {
    // Yine de local verileri temizleyelim, çağrı başarısız olsa bile sonraki adım için hazır olsun
    await TokenManager.removeToken();
    throw err;
  }
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

// Community API
export const getCommunityStats = async (): Promise<any> => {
  return apiClient.get<any>('/api/community/stats');
};

// Community Posts API
export const getCommunityPosts = async (
  limit: number = 20,
  offset: number = 0,
  postType?: string,
  filterType: string = "latest",
  skillName?: string
): Promise<any[]> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    filter_type: filterType,
    ...(postType && { post_type: postType }),
    ...(skillName && { skill_name: skillName })
  });
  return apiClient.get<any[]>(`/api/community/posts?${params}`);
};

export const createCommunityPost = async (postData: {
  title: string;
  content: string;
  skill_name?: string;  // Backend'te skill_name var
  post_type?: string;
}): Promise<any> => {
  return apiClient.post<any>('/api/community/posts', postData);
};

export const getPostComments = async (postId: number): Promise<any[]> => {
  return apiClient.get<any[]>(`/api/community/posts/${postId}/comments`);
};

export const createComment = async (
  postId: number,
  commentData: {
    content: string;
    parent_comment_id?: number;
  }
): Promise<any> => {
  return apiClient.post<any>(`/api/community/posts/${postId}/comments`, commentData);
};

export const likePost = async (postId: number): Promise<any> => {
  return apiClient.post<any>(`/api/community/posts/${postId}/like`);
};

// Social Login API
export const socialLogin = async (data: SocialLoginRequest): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/social-login', data);
  await TokenManager.setToken(response.access_token);
  await TokenManager.setUser(response.user);
  return response;
}; 