import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/environment';

// API Base URL - will be dynamically set
let API_BASE_URL = AppConfig.API_BASE_URL;

// Subscription product interface
export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
}

// User subscription status interface
export interface UserSubscription {
  isActive: boolean;
  productId: string | null;
  expiryDate: Date | null;
  purchaseDate?: Date | null;
  originalTransactionId?: string | null;
}

// Premium plans
const PREMIUM_PLANS: SubscriptionProduct[] = [
  {
    productId: 'premium_monthly',
    title: 'Premium Aylık',
    description: 'Tüm premium özellikler',
    price: '9.99',
    currency: 'USD',
    localizedPrice: '$9.99',
  },
  {
    productId: 'premium_yearly',
    title: 'Premium Yıllık',
    description: 'Tüm premium özellikler + 33% indirim',
    price: '79.00',
    currency: 'USD',
    localizedPrice: '$79.00',
  },
];

class SubscriptionService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    console.log('✅ Simple premium system initialized');
    this.isInitialized = true;
  }

  async checkSubscriptionStatus(): Promise<UserSubscription> {
    try {
      await this.initialize();
      
      // Get user data from AsyncStorage
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        console.log('❌ No user data found');
        return {
          isActive: false,
          productId: null,
          expiryDate: null,
        };
      }

      const user = JSON.parse(userData);
      console.log('👤 User data:', user);

      // Check if user has premium from backend user data
      const isPremium = user.subscription_type === 'premium';
      
      console.log('🔍 Premium status:', isPremium);
      
      return {
        isActive: isPremium,
        productId: isPremium ? 'premium' : null,
        expiryDate: user.subscription_expires ? new Date(user.subscription_expires) : null,
      };
    } catch (error) {
      console.error('❌ Failed to check subscription:', error);
      return {
        isActive: false,
        productId: null,
        expiryDate: null,
      };
    }
  }

  async getAvailableSubscriptions(): Promise<SubscriptionProduct[]> {
    await this.initialize();
    return PREMIUM_PLANS;
  }

  async purchaseSubscription(productId: string): Promise<boolean> {
    try {
      await this.initialize();

      const plan = PREMIUM_PLANS.find(p => p.productId === productId);
      const planName = plan ? plan.localizedPrice : productId;
      
      return new Promise((resolve) => {
        Alert.alert(
          '💳 Premium Satın Al',
          `${planName} premium aboneliği satın almak istediğinizden emin misiniz?\n\n⚠️ Bu bir test satın alımıdır.`,
          [
            {
              text: 'İptal',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Satın Al',
              onPress: async () => {
                try {
                  console.log('🛒 Processing premium purchase...');
                  
                  // Backend'e satın alma isteği gönder
                  const token = await AsyncStorage.getItem('skillpath_token');
                  const { AppConfig } = await import('../config/environment');
                  
                  console.log('🔗 API URL:', AppConfig.API_BASE_URL);
                  console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'No token');
                  
                  // Timeout controller
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye
                  
                  const response = await fetch(`${AppConfig.API_BASE_URL}/api/premium/purchase`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      product_id: productId,
                      payment_method: 'test'
                    }),
                    signal: controller.signal,
                  });
                  
                  clearTimeout(timeoutId);

                  if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Premium purchase successful:', result);
                    
                    // User data'sını güncelle
                    const userData = await AsyncStorage.getItem('user');
                    if (userData) {
                      const user = JSON.parse(userData);
                      const updatedUser = {
                        ...user,
                        subscription_type: 'premium',
                        subscription_expires: result.expires_at
                      };
                      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                    }
                    
                    Alert.alert('🎉 Başarılı!', 'Premium aboneliği aktif edildi!');
                    resolve(true);
                  } else {
                    console.error('❌ Premium purchase failed');
                    Alert.alert('❌ Hata', 'Satın alma işlemi başarısız');
                    resolve(false);
                  }
                } catch (error) {
                  console.error('❌ Premium purchase error:', error);
                  Alert.alert('❌ Hata', 'Beklenmeyen bir hata oluştu');
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    } catch (error: any) {
      console.error('Purchase failed:', error);
      return false;
    }
  }

  async restorePurchases(): Promise<boolean> {
    try {
      await this.initialize();
      const status = await this.checkSubscriptionStatus();
      return status.isActive;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  }
}

export const subscriptionService = new SubscriptionService(); 