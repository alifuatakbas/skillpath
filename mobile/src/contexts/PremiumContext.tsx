import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PremiumContextType {
  isPremium: boolean;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const PremiumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = async () => {
    try {
      setIsLoading(true);
      
      // Get token first
      const token = await AsyncStorage.getItem('skillpath_token');
      if (!token) {
        console.log('❌ No token found');
        setIsPremium(false);
        return;
      }

      console.log('🔑 Token found, checking premium status...');

      // ✅ Backend'den güncel premium durumunu çek
      try {
        const { AppConfig } = await import('../config/environment');
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/premium/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const premiumData = await response.json();
          console.log('🔍 Backend premium status:', premiumData);
          
          const isPremiumStatus = premiumData.is_premium === true;
          setIsPremium(isPremiumStatus);
          
          // User data'yı da güncelle (varsa)
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            const updatedUser = {
              ...user,
              subscription_type: premiumData.subscription_type,
              subscription_expires: premiumData.expires_at
            };
            await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
          }
          
          console.log('✅ Premium status updated from backend:', isPremiumStatus);
          return;
        } else {
          console.log('⚠️ Backend premium check failed, status:', response.status);
        }
      } catch (backendError) {
        console.log('⚠️ Backend premium check error:', backendError);
      }

      // Fallback: Local data kullan (varsa)
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        const isPremiumLocal = user.subscription_type === 'premium';
        console.log('🔍 Using local premium status:', isPremiumLocal);
        setIsPremium(isPremiumLocal);
      } else {
        console.log('⚠️ No user data available, defaulting to free');
        setIsPremium(false);
      }
      
    } catch (error) {
      console.error('❌ Failed to check subscription:', error);
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscription = async () => {
    await checkSubscription();
  };

  useEffect(() => {
    checkSubscription();
  }, []);

  return (
    <PremiumContext.Provider value={{ isPremium, isLoading, refreshSubscription }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};

// Premium özellik kontrol hook'u
export const usePremiumFeature = (featureName: string) => {
  const { isPremium } = usePremium();

  const checkAccess = (): boolean => {
    if (!isPremium) {
      // showPaywall functionality can be added later if needed
      return false;
    }
    return true;
  };

  return {
    isPremium,
    checkAccess,
  };
};

// Premium özellik limitleri
export const PREMIUM_LIMITS = {
  FREE_ROADMAP_LIMIT: 3,
  FREE_AI_REQUESTS_PER_DAY: 5,
  FREE_ANALYTICS_HISTORY_DAYS: 7,
} as const;

// Premium özellik isimleri
export const PREMIUM_FEATURES = {
  UNLIMITED_ROADMAPS: 'unlimited_roadmaps',
  ADVANCED_AI: 'advanced_ai',
  DETAILED_ANALYTICS: 'detailed_analytics',
  GAMIFICATION: 'gamification',
  LEARNING_GROUPS: 'learning_groups',
  MENTOR_SUPPORT: 'mentor_support',
  EXPORT_DATA: 'export_data',
  PRIORITY_SUPPORT: 'priority_support',
} as const; 