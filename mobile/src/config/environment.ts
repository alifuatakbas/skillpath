export interface AppConfig {
  API_BASE_URL: string;
  APP_NAME: string;
  VERSION: string;
}

// 🏠 EVDEYKİN BU IP'Yİ KULLAN
const HOME_IP = 'http://192.168.1.133:8000';

// 🌍 DIŞARDAYKİN BURAYI DEĞİŞTİR (mevcut IP'ni yaz)
const OUTSIDE_IP = 'http://10.33.10.46:8000';

// 💻 HOSTNAME İLE BAĞLANTI (daha stabil)
const HOSTNAME_URL = 'http://Alifuat-MacBook-Pro.local:8000';

// 🚀 PRODUCTION (Yayınlandığında)
const PRODUCTION_URL = 'https://your-app-api.herokuapp.com';

// Şu an hangi URL'yi kullanmak istiyorsun?
const CURRENT_API_URL = HOME_IP; // IP adresi mobile için daha uygun

export const AppConfig: AppConfig = {
  API_BASE_URL: CURRENT_API_URL,
  APP_NAME: 'SkillPath',
  VERSION: '1.0.0',
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

// Smart endpoint selection - Sadece belirlenen URL'leri dener
export const selectBestEndpoint = async (): Promise<string> => {
  console.log('🔍 API endpoint test ediliyor...');
  
  // İlk olarak mevcut URL'yi dene
  const isConnected = await testConnection(CURRENT_API_URL);
  if (isConnected) {
    console.log('✅ Bağlantı başarılı:', CURRENT_API_URL);
    return CURRENT_API_URL;
  }
  
  console.log('❌ Mevcut URL çalışmıyor, fallback denenecek...');
  
  // Fallback olarak farklı endpoint'leri dene
  const fallbackEndpoints = [OUTSIDE_IP, HOME_IP, 'http://localhost:8000'];
  
  for (const endpoint of fallbackEndpoints) {
    console.log('🔍 Fallback test ediliyor:', endpoint);
    const isConnected = await testConnection(endpoint);
    if (isConnected) {
      console.log('✅ Fallback bağlantı başarılı:', endpoint);
      return endpoint;
    }
  }
  
  console.log('⚠️ Hiçbir endpoint çalışmıyor, varsayılan kullanılıyor');
  return CURRENT_API_URL;
}; 