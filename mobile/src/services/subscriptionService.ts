import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config/environment';
import { useIAP, ErrorCode } from 'expo-iap';

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
    title: 'SkillPath Premium Monthly',
    description: 'Unlimited roadmaps, Pomodoro & community',
    price: '6.99',
    currency: 'USD',
    localizedPrice: '$6.99',
  },
  {
    productId: PRODUCT_IDS.YEARLY,
    title: 'SkillPath Premium Yearly',
    description: 'Unlimited roadmaps, Pomodoro & community',
    price: '59.99',
    currency: 'USD',
    localizedPrice: '$59.99',
  },
];

class SubscriptionService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      
      
      // Expo IAP starts automatically
      this.isInitialized = true;
      
      } catch (error) {
        // IAP initialization failed
      this.isInitialized = true;
    }
  }

  async checkSubscriptionStatus(): Promise<UserSubscription> {
    try {
      await this.initialize();
      
      // Get user data from AsyncStorage
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        return {
          isActive: false,
          productId: null,
          expiryDate: null,
        };
      }

      const user = JSON.parse(userData);

      // Check if user has premium from backend user data
      const isPremium = user.subscription_type === 'premium';
      
      
      return {
        isActive: isPremium,
        productId: isPremium ? 'premium' : null,
        expiryDate: user.subscription_expires ? new Date(user.subscription_expires) : null,
      };
    } catch (error) {
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
      
      // In Expo IAP, products are retrieved via useIAP hook
      // This function returns fallback plans
      return FALLBACK_PLANS;
    } catch (error) {
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
          '💳 Purchase Premium',
          `Are you sure you want to purchase ${planName} premium subscription?\n\n⚠️ This is a test purchase.`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Purchase',
              onPress: async () => {
                try {
                  
                  // In Expo IAP, purchase is done via useIAP hook
                    
                  // Send purchase info to backend (for testing)
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
                      transaction_id: 'test_transaction_id',
                      receipt: 'test_receipt',
                        platform: Platform.OS
                      }),
                    });

                    if (response.ok) {
                      const result = await response.json();
                      
                      // Update user data
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
                      
                      Alert.alert('🎉 Success!', 'Premium subscription activated!');
                      resolve(true);
                    } else {
                      Alert.alert('❌ Error', 'Purchase failed');
                    resolve(false);
                  }
                } catch (error) {
                  Alert.alert('❌ Error', 'An unexpected error occurred');
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    } catch (error: any) {
      return false;
    }
  }

  async restorePurchases(): Promise<boolean> {
    try {
      await this.initialize();
      const status = await this.checkSubscriptionStatus();
      return status.isActive;
    } catch (error) {
      return false;
    }
  }
}

export const subscriptionService = new SubscriptionService(); 
