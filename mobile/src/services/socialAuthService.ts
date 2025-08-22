import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin } from './api';

// WebBrowser ayarları
WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

// Google Sign-In (OAuth ile)
export const signInWithGoogle = async (): Promise<SocialAuthResult> => {
  try {
    console.log('🔍 Google Sign-In başlatılıyor...');
    
    // Google OAuth URL'si oluştur
    const clientId = '977573613440-2ljuaktboadenil19bpadjb5e7vq1imv.apps.googleusercontent.com';
    const redirectUri = 'https://auth.expo.io/@alifuatakbas/skillpath';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('openid email profile')}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=random_state_string`;
    
    console.log('🔗 Auth URL:', authUrl);
    
    // WebBrowser ile Google'a yönlendir
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    
    console.log('✅ Google Auth result:', result);
    
    if (result.type === 'success' && result.url) {
      // URL'den authorization code'u al
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      
      if (code) {
        console.log('✅ Authorization code alındı:', code);
        
        // Backend'e authorization code gönder
        const authResponse = await socialLogin({
          provider: 'google',
          access_token: code,
        });
        
        console.log('✅ Backend authentication başarılı');
        
        return {
          success: true,
          user: authResponse.user,
        };
      }
    } else if (result.type === 'cancel') {
      throw new Error('Google girişi iptal edildi');
    } else {
      throw new Error('Google girişi başarısız');
    }
    
    throw new Error('Google authentication failed');
  } catch (error: any) {
    console.error('❌ Google Sign-In Error:', error);
    
    return {
      success: false,
      error: error.message || 'Google girişi başarısız',
    };
  }
};

// Firebase ile Apple Sign-In
export const signInWithApple = async (): Promise<SocialAuthResult> => {
  try {
    console.log('🍎 Firebase Apple Sign-In başlatılıyor...');
    
    // Apple Sign-In availability kontrol et
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign-In bu cihazda mevcut değil');
    }
    
    // Apple Sign-In dialog'unu aç
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    
    console.log('✅ Apple user info:', {
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
    });
    
    // Kullanıcının gerçek adını oluştur
    const fullName = credential.fullName;
    const displayName = fullName ? 
      `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 
      'Apple User';
    
    console.log('✅ Apple display name:', displayName);
    
    // Backend'e sosyal medya login isteği gönder
    const authResponse = await socialLogin({
      provider: 'apple',
      access_token: credential.identityToken || credential.authorizationCode || 'apple_auth_' + Date.now(),
      id_token: credential.identityToken || credential.authorizationCode || '',
      user_name: displayName, // Kullanıcının gerçek adını gönder
    });
    
    console.log('✅ Backend authentication başarılı');

    return {
      success: true,
      user: authResponse.user,
    };
  } catch (error: any) {
    console.error('❌ Firebase Apple Sign-In Error:', error);
    
    let errorMessage = 'Apple girişi başarısız';
    
    if (error.code === 'ERR_CANCELED') {
      errorMessage = 'Apple girişi iptal edildi';
    } else if (error.code === 'ERR_INVALID_RESPONSE') {
      errorMessage = 'Apple girişi geçersiz yanıt';
    } else if (error.code === 'ERR_REQUEST_FAILED') {
      errorMessage = 'Apple girişi istek başarısız';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Sign-Out (Firebase olmadan)
export const signOutFromGoogle = async (): Promise<boolean> => {
  try {
    console.log('✅ Sign-Out başarılı');
    return true;
  } catch (error) {
    console.error('❌ Sign-Out Error:', error);
    return false;
  }
};

// Auth State Listener (Firebase olmadan)
export const onAuthStateChange = (callback: (user: any) => void) => {
  // Basit implementation
  return () => {};
};

// Mevcut kullanıcıyı al (Firebase olmadan)
export const getCurrentFirebaseUser = (): any => {
  return null;
};

// Auto-login kontrolü (uygulama başlangıcında)
export const checkAutoLogin = async (): Promise<boolean> => {
  try {
    // Token kontrolü
    const { TokenManager } = await import('./api');
    const token = await TokenManager.getToken();
    
    if (token) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Auto-login check failed:', error);
    return false;
  }
}; 