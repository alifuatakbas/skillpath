// Shared API utilities for SkillPath project
// Bu dosya Next.js frontend ve React Native mobile app tarafından kullanılır

// API Configuration
const API_BASE_URL = 'http://192.168.1.133:8001';

// Type definitions
export interface User {
  id: number;
  email: string;
  username: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
}

// AI destekli yeni interface'ler
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
  question: string;
  options: string[];
  question_type: string;
}

export interface AssessmentRequest {
  skill_name: string;
  target_duration_weeks: number;
  language: string;
}

export interface AssessmentResponse {
  questions: AssessmentQuestion[];
  skill_info: any;
}

export interface RoadmapStep {
  step_order: number;
  title: string;
  description: string;
  estimated_hours: number;
  resources: string[];
  projects: string[];
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

// Base URL belirleme - ortama göre
function getBaseURL(): string {
  if (typeof window !== 'undefined') {
    // Browser ortamı (Next.js)
    return 'http://localhost:8000';
  } else {
    // React Native ortamı
    return 'http://192.168.1.133:8000';
  }
}

// Token yönetimi
class TokenManager {
  private static TOKEN_KEY = 'skillpath_token';
  
  static setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }
  
  static getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }
  
  static removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }
  
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

// Generic API request function with authentication support
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {},
  requireAuth: boolean = false
): Promise<T> {
  const baseURL = getBaseURL();
  const url = `${baseURL}${endpoint}`;
  
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  // Authentication header ekle
  if (requireAuth) {
    const token = TokenManager.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    ...options,
    headers,
  };
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({ 
        detail: `HTTP error! status: ${response.status}` 
      }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

// API Functions

// Health check
export async function checkHealth(): Promise<{ status: string; service: string }> {
  return apiRequest('/api/health');
}

// Authentication operations
export async function login(credentials: UserLogin): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  
  // Token'ı sakla
  TokenManager.setToken(response.access_token);
  
  return response;
}

export async function register(userData: UserCreate): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  
  // Token'ı sakla
  TokenManager.setToken(response.access_token);
  
  return response;
}

export async function logout(): Promise<void> {
  TokenManager.removeToken();
}

// User operations (authentication required)
export async function getCurrentUser(): Promise<User> {
  return apiRequest('/api/users/me', {}, true);
}

// AI destekli yeni API fonksiyonları
export async function suggestSkill(request: SkillSuggestionRequest): Promise<SkillSuggestionResponse> {
  return apiRequest('/api/skills/suggest', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function generateAssessment(request: AssessmentRequest): Promise<AssessmentResponse> {
  return apiRequest('/api/skills/assessment', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function generateRoadmap(
  skillName: string,
  targetWeeks: number,
  currentLevel: string,
  dailyHours: number = 2
): Promise<RoadmapResponse> {
  const body = {
    skill_name: skillName,
    target_weeks: targetWeeks,
    current_level: currentLevel,
    daily_hours: dailyHours,
  };
  
  return apiRequest(`/api/roadmap/create`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, true);
}

// Generate roadmap with AI
export async function generateRoadmapWithAI(skillRequest: SkillSuggestionRequest): Promise<RoadmapResponse> {
  return apiRequest('/api/roadmap/create', {
    method: 'POST',
    body: JSON.stringify(skillRequest),
  });
}

// Get user statistics  
export async function getUserStats(): Promise<any> {
  return apiRequest('/api/user/stats');
}

// Utility functions
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(price);
}

export function getBadgeColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'başlangıç':
      return '#10B981'; // Green
    case 'orta':
      return '#F59E0B'; // Yellow
    case 'ileri':
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (password.length < 6) {
    return { isValid: false, message: 'Şifre en az 6 karakter olmalıdır' };
  }
  return { isValid: true };
}

// Authentication state management
export { TokenManager }; 