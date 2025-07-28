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
          // Token'ı temizle ve yeniden login gerektiğini belirt
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
        throw new Error('Sunucuya bağlanılamıyor. Lütfen:\n1. İnternet bağlantınızı kontrol edin\n2. Backend sunucusunun çalıştığından emin olun\n3. IP adresinin doğru olduğunu kontrol edin (192.168.1.133:8001)');
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

// Community API
export const getCommunityStats = async (): Promise<any> => {
  return apiClient.get<any>('/api/community/stats');
};

// Community Posts API
export const getCommunityPosts = async (
  limit: number = 20,
  offset: number = 0,
  postType?: string
): Promise<any[]> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    ...(postType && { post_type: postType })
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