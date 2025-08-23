import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin } from './api';

// Apple Authentication settings

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
      throw new Error('Apple Sign-In is not available on this device');
    }
    
    // Open Apple Sign-In dialog
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    

    
    // Create user's real name
    const fullName = credential.fullName;
    const displayName = fullName ? 
      `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 
      'Apple User';
    

    
    // Send social media login request to backend
    const authResponse = await socialLogin({
      provider: 'apple',
      access_token: credential.identityToken || credential.authorizationCode || 'apple_auth_' + Date.now(),
      id_token: credential.identityToken || credential.authorizationCode || '',
      user_name: displayName, // Send user's real name
      email: credential.email || undefined, // Send email if available
    });
    


    return {
      success: true,
      user: authResponse.user,
    };
  } catch (error: any) {

    
    let errorMessage = 'Apple sign-in failed';
    
    if (error.code === 'ERR_CANCELED') {
      errorMessage = 'Apple sign-in was cancelled';
    } else if (error.code === 'ERR_INVALID_RESPONSE') {
      errorMessage = 'Apple sign-in invalid response';
    } else if (error.code === 'ERR_REQUEST_FAILED') {
      errorMessage = 'Apple sign-in request failed';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};



// Auto-login check (on app startup)
export const checkAutoLogin = async (): Promise<boolean> => {
  try {
    // Token check
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