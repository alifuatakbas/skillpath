export interface AppConfig {
  API_BASE_URL: string;
  APP_NAME: string;
  VERSION: string;
  GOOGLE_IOS_CLIENT_ID: string;
  GOOGLE_ANDROID_CLIENT_ID: string;
  GOOGLE_WEB_CLIENT_ID: string;
}

// 🚀 PRODUCTION (Railway URL)
const PRODUCTION_URL = 'https://skillpath-production.up.railway.app';

// 📱 Her zaman Railway URL kullan (local backend yok)
const CURRENT_API_URL = PRODUCTION_URL;

export const AppConfig: AppConfig = {
  API_BASE_URL: CURRENT_API_URL,
  APP_NAME: 'SkillPath',
  VERSION: '1.1.0',
  
  // Google OAuth Client IDs
  GOOGLE_IOS_CLIENT_ID: '555670764137-9c9tvrb6tf4pcho322b0tt92q2b8t1li.apps.googleusercontent.com',
  GOOGLE_ANDROID_CLIENT_ID: '555670764137-lp6u36lvq93ubtmk8mg6eabu7dfka36d.apps.googleusercontent.com',
  GOOGLE_WEB_CLIENT_ID: '555670764137-4ojah5q0lknekpf26id09gi7r14b3hj0.apps.googleusercontent.com',
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
    console.log(`Connection test failed for ${url}:`, error);
    return false;
  }
}; 