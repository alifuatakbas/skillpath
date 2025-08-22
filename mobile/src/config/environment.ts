export interface AppConfig {
  API_BASE_URL: string;
  APP_NAME: string;
  VERSION: string;
}

// 🚀 PRODUCTION (Railway URL)
const PRODUCTION_URL = 'https://skillpath-production.up.railway.app';

// 📱 Her zaman Railway URL kullan (local backend yok)
const CURRENT_API_URL = PRODUCTION_URL;

export const AppConfig: AppConfig = {
  API_BASE_URL: CURRENT_API_URL,
  APP_NAME: 'SkillPath',
  VERSION: '1.4.0',
};

// Test connection function
export const testConnection = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}; 