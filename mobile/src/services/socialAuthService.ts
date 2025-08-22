import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { socialLogin } from './api';
import { auth } from '../config/firebase';
import { 
  signInWithCredential, 
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';

// WebBrowser ayarları
WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

// Firebase ile Google Sign-In (iOS için)
export const signInWithGoogle = async (): Promise<SocialAuthResult> => {
  try {
    console.log('🔍 Firebase Google Sign-In başlatılıyor (iOS)...');
    
    // Test için basit bir yaklaşım - sadece backend'e test isteği gönder
    console.log('✅ Test modu - backend\'e test isteği gönderiliyor...');
    
    const authResponse = await socialLogin({
      provider: 'google',
      access_token: 'test_google_token_' + Date.now(),
    });
    
    console.log('✅ Backend authentication başarılı');
    
    return {
      success: true,
      user: authResponse.user,
    };
  } catch (error: any) {
    console.error('❌ Firebase Google Sign-In Error:', error);
    
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
    
    // Firebase Apple Provider ile credential oluştur
    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken || '',
    });
    
    // Firebase ile giriş yap
    const userCredential = await signInWithCredential(auth, firebaseCredential);
    const firebaseUser = userCredential.user;
    
    console.log('✅ Firebase Apple Sign-In başarılı:', firebaseUser);
    
    // Firebase user'dan ID token al
    const idToken = await firebaseUser.getIdToken();
    
    // Backend'e Firebase ID token gönder
    const authResponse = await socialLogin({
      provider: 'apple',
      access_token: idToken,
      firebase_uid: firebaseUser.uid,
      email: firebaseUser.email || credential.email || undefined,
      user_name: displayName,
    });
    
    console.log('✅ Backend authentication başarılı');

    return {
      success: true,
      user: {
        ...authResponse.user,
        firebaseUser: firebaseUser,
      },
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

// Firebase ile Sign-Out
export const signOutFromGoogle = async (): Promise<boolean> => {
  try {
    // Firebase'den çıkış yap
    await firebaseSignOut(auth);
    console.log('✅ Firebase Sign-Out başarılı');
    return true;
  } catch (error) {
    console.error('❌ Firebase Sign-Out Error:', error);
    return false;
  }
};

// Firebase Auth State Listener
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Mevcut Firebase kullanıcısını al
export const getCurrentFirebaseUser = (): User | null => {
  return auth.currentUser;
};

// Auto-login kontrolü (uygulama başlangıcında)
export const checkAutoLogin = async (): Promise<boolean> => {
  try {
    // Firebase auth state kontrol et
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      console.log('✅ Firebase kullanıcısı mevcut:', currentUser.uid);
      
      // Token'ı yenile
      await currentUser.getIdToken(true);
      
      // Backend'e token gönder ve kullanıcı bilgilerini al
      const idToken = await currentUser.getIdToken();
      const authResponse = await socialLogin({
        provider: 'firebase',
        access_token: idToken,
        firebase_uid: currentUser.uid,
      });
      
      return true;
    }
    
    // Eski token kontrolü (fallback)
    const { TokenManager } = await import('./api');
    const refreshToken = await TokenManager.getRefreshToken();
    
    if (refreshToken) {
      const refreshed = await TokenManager.refreshAccessToken();
      return refreshed;
    }
    
    return false;
  } catch (error) {
    console.error('Auto-login check failed:', error);
    return false;
  }
}; 