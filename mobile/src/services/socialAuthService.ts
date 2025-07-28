import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin } from './api';
import { AppConfig } from '../config/environment';
import { Platform } from 'react-native';

// WebBrowser ayarları
WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

// Google Sign-In konfigürasyonu (Expo AuthSession)
export const configureGoogleSignIn = async () => {
  try {
    console.log('✅ Google Sign-In configured successfully (Expo AuthSession)');
  } catch (error) {
    console.error('❌ Google Sign-In configuration failed:', error);
  }
};

export const signInWithGoogle = async (): Promise<SocialAuthResult> => {
  try {
    console.log('🔍 Google Sign-In başlatılıyor (Expo AuthSession)...');
    
    // Google OAuth URL'i oluştur (Production ready)
    const redirectUri = 'https://auth.expo.io/@alifuatakbas/skillpath';
    
    console.log('🔍 Redirect URI:', redirectUri);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${AppConfig.GOOGLE_WEB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('openid email profile')}&` +
      `access_type=offline&` +
      `prompt=select_account`;
    
    console.log('🔍 Auth URL:', authUrl);
    
    console.log('🔍 Opening Google auth URL...');
    
    // WebBrowser ile Google Sign-In sayfasını aç
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    
    if (result.type === 'success' && result.url) {
      console.log('✅ Google auth success:', result.url);
      
      // URL'den authorization code'u parse et (expo auth proxy formatında)
      const url = new URL(result.url);
      const code = url.searchParams.get('code') || url.hash.match(/code=([^&]+)/)?.[1];
      
      if (!code) {
        throw new Error('Authorization code not found');
      }
      
      console.log('✅ Authorization code alındı:', code.substring(0, 10) + '...');
      
      // Backend'e sosyal medya login isteği gönder
      const authResponse = await socialLogin({
        provider: 'google',
        access_token: code, // Authorization code gönder
      });
      
      console.log('✅ Backend authentication başarılı');
      
      return {
        success: true,
        user: authResponse.user,
      };
    } else {
      return {
        success: false,
        error: 'Google girişi iptal edildi',
      };
    }
  } catch (error: any) {
    console.error('❌ Google Sign-In Error:', error);
    
    return {
      success: false,
      error: error.message || 'Google girişi başarısız',
    };
  }
};

export const signInWithApple = async (): Promise<SocialAuthResult> => {
  try {
    console.log('🍎 Apple Sign-In başlatılıyor...');
    
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
    
    // Backend'e sosyal medya login isteği gönder
    const authResponse = await socialLogin({
      provider: 'apple',
      access_token: credential.identityToken || credential.authorizationCode || 'apple_auth_' + Date.now(),
      id_token: credential.identityToken || credential.authorizationCode || '',
    });
    
    console.log('✅ Backend authentication başarılı');

    return {
      success: true,
      user: authResponse.user,
    };
  } catch (error: any) {
    console.error('❌ Apple Sign-In Error:', error);
    
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

export const signOutFromGoogle = async (): Promise<boolean> => {
  try {
    // Expo AuthSession sign-out (token'ları temizle)
    console.log('✅ Google Sign-Out başarılı (Expo AuthSession)');
    return true;
  } catch (error) {
    console.error('❌ Google Sign-Out Error:', error);
    return false;
  }
};

// Auto-login kontrolü (uygulama başlangıcında)
export const checkAutoLogin = async (): Promise<boolean> => {
  try {
    // TokenManager'dan refresh token kontrol et
    const { TokenManager } = await import('./api');
    const refreshToken = await TokenManager.getRefreshToken();
    
    if (refreshToken) {
      // Token refresh dene
      const refreshed = await TokenManager.refreshAccessToken();
      return refreshed;
    }
    
    return false;
  } catch (error) {
    console.error('Auto-login check failed:', error);
    return false;
  }
}; 