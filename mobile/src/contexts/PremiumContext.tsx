import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PremiumContextType {
  isPremium: boolean;
  isLoading: boolean;
  trialDaysLeft: number;
  trialExpiryDate: Date | null;
  refreshSubscription: () => Promise<void>;
  checkTrialStatus: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const PremiumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0); // Yeni kullanıcılar için 0
  const [trialExpiryDate, setTrialExpiryDate] = useState<Date | null>(null);

  const checkSubscription = async () => {
    try {
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
          
          // Backend'den gelen premium durumunu kullan
          // Bu trial aktifse veya abonelik varsa true olur
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
    }
  };

  const refreshSubscription = async () => {
    await checkSubscription();
  };

  const checkTrialStatus = async () => {
    try {
      // Backend'den trial durumunu kontrol et
      const token = await AsyncStorage.getItem('skillpath_token');
      if (!token) {
        console.log('❌ No token found for trial check');
        return;
      }

      const { AppConfig } = await import('../config/environment');
      const response = await fetch(`${AppConfig.API_BASE_URL}/api/premium/trial-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const trialData = await response.json();
        console.log('🔍 Trial status from backend:', trialData);
        
        setTrialDaysLeft(trialData.days_left || 0);
        setTrialExpiryDate(trialData.expiry_date ? new Date(trialData.expiry_date) : null);
        
        // Premium durumunu burada değiştirme, sadece trial bilgilerini güncelle
        console.log('📅 Trial days left:', trialData.days_left);
      } else {
        console.log('⚠️ Failed to get trial status from backend');
      }
    } catch (error) {
      console.error('❌ Failed to check trial status:', error);
    }
  };

  useEffect(() => {
    const initializePremium = async () => {
      await checkSubscription();
      await checkTrialStatus();
      setIsLoading(false);
    };
    initializePremium();
  }, []);

  return (
    <PremiumContext.Provider value={{
      isPremium,
      isLoading,
      trialDaysLeft,
      trialExpiryDate,
      refreshSubscription,
      checkTrialStatus
    }}>
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
