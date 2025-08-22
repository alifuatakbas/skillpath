import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin } from './api';

// Apple Authentication ayarları

export interface SocialAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}



// Firebase ile Apple Sign-In
export const signInWithApple = async (): Promise<SocialAuthResult> => {
  try {

    
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
    

    
    // Kullanıcının gerçek adını oluştur
    const fullName = credential.fullName;
    const displayName = fullName ? 
      `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 
      'Apple User';
    

    
    // Backend'e sosyal medya login isteği gönder
    const authResponse = await socialLogin({
      provider: 'apple',
      access_token: credential.identityToken || credential.authorizationCode || 'apple_auth_' + Date.now(),
      id_token: credential.identityToken || credential.authorizationCode || '',
      user_name: displayName, // Kullanıcının gerçek adını gönder
    });
    


    return {
      success: true,
      user: authResponse.user,
    };
  } catch (error: any) {

    
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

    return false;
  }
}; 