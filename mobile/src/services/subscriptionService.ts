import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/environment';
import { 
  initConnection, 
  getProducts, 
  requestPurchase, 
  finishTransaction,
  getAvailablePurchases,
  Product,
  Purchase,
  SubscriptionPurchase
} from 'react-native-iap';

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

// App Store product IDs
const PRODUCT_IDS = {
  MONTHLY: 'skillpath_premium_monthly',
  YEARLY: 'skillpath_premium_yearly',
};

// Fallback plans (if App Store fails)
const FALLBACK_PLANS: SubscriptionProduct[] = [
  {
    productId: PRODUCT_IDS.MONTHLY,
    title: 'Premium Aylık',
    description: 'Tüm premium özellikler',
    price: '6.99',
    currency: 'USD',
    localizedPrice: '$6.99',
  },
];

class SubscriptionService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // App Store IAP bağlantısını başlat
      await initConnection();
      console.log('✅ App Store IAP initialized');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize IAP:', error);
      throw error; // Hatayı fırlat, fallback kullanma
    }
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
    
    try {
      // App Store'dan ürünleri al
      const products = await getProducts({ skus: [PRODUCT_IDS.MONTHLY] });
      
      // App Store ürünlerini SubscriptionProduct formatına çevir
      const subscriptionProducts: SubscriptionProduct[] = products.map((product: Product) => ({
        productId: product.productId,
        title: product.title,
        description: product.description,
        price: product.price,
        currency: product.currency,
        localizedPrice: product.localizedPrice,
      }));
      
      return subscriptionProducts.length > 0 ? subscriptionProducts : FALLBACK_PLANS;
    } catch (error) {
      console.error('Failed to get App Store products:', error);
      return FALLBACK_PLANS;
    }
  }

  async purchaseSubscription(productId: string): Promise<boolean> {
    try {
      await this.initialize();

      const plan = FALLBACK_PLANS.find((p: SubscriptionProduct) => p.productId === productId);
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
                  console.log('🛒 Processing App Store purchase...');
                  
                  // App Store'dan satın alma
                  const purchase = await requestPurchase({ sku: productId });
                  console.log('📱 App Store purchase:', purchase);
                  
                  if (purchase) {
                    // Array ise ilk elemanı al
                    const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;
                    
                    // Transaction'ı tamamla
                    await finishTransaction({ purchase: purchaseData });
                    
                    // Backend'e satın alma bilgisini gönder
                    const token = await AsyncStorage.getItem('skillpath_token');
                    const { AppConfig } = await import('../config/environment');
                    
                    const response = await fetch(`${AppConfig.API_BASE_URL}/api/premium/purchase`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        product_id: productId,
                        transaction_id: purchaseData.transactionId,
                        receipt: purchaseData.transactionReceipt,
                        platform: Platform.OS
                      }),
                    });

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
                  
                  // Backend'e satın alma bilgisini gönder
                  const token = await AsyncStorage.getItem('skillpath_token');
                  const { AppConfig } = await import('../config/environment');
                  
                  const response = await fetch(`${AppConfig.API_BASE_URL}/api/premium/purchase`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      product_id: productId,
                      transaction_id: purchase.transactionId,
                      receipt: purchase.transactionReceipt,
                      platform: Platform.OS
                    }),
                  });

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
