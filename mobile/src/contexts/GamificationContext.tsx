import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface GamificationData {
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  totalStudyMinutes: number;
  completedRoadmaps: number;
  achievements: Achievement[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isUnlocked: boolean;
}

interface GamificationContextType {
  gamificationData: GamificationData;
  isLoading: boolean;
  addXp: (amount: number, reason: string) => Promise<void>;
  addStudyMinutes: (minutes: number) => Promise<void>;
  recordActivity: () => Promise<void>;
  checkAchievements: () => Promise<void>;
  refreshGamification: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

// XP hesaplama fonksiyonları
const calculateLevelInternal = (totalXp: number): number => {
  if (totalXp < 100) return 1;
  return Math.floor((totalXp - 100) / 500) + 2;
};

const calculateXpForNextLevelInternal = (currentLevel: number): number => {
  if (currentLevel === 1) return 100;
  return 100 + (currentLevel - 1) * 500;
};

const calculateProgressToNextLevelInternal = (totalXp: number): number => {
  const currentLevel = calculateLevelInternal(totalXp);
  
  if (currentLevel === 1) {
    return Math.min((totalXp / 100) * 100, 100);
  }
  
  const xpForCurrentLevel = 100 + (currentLevel - 2) * 500;
  const xpForNextLevel = 100 + (currentLevel - 1) * 500;
  const xpInCurrentLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  
  return Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);
};

// Başarı rozetleri
const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_roadmap',
    name: 'İlk Adım',
    description: 'İlk roadmap\'ini oluştur',
    icon: '🎯',
    isUnlocked: false,
  },
  {
    id: 'streak_3',
    name: 'Tutarlı Öğrenci',
    description: '3 gün üst üste çalış',
    icon: '🔥',
    isUnlocked: false,
  },
  {
    id: 'streak_7',
    name: 'Haftalık Savaşçı',
    description: '7 gün üst üste çalış',
    icon: '⚡',
    isUnlocked: false,
  },
  {
    id: 'streak_30',
    name: 'Aylık Ustası',
    description: '30 gün üst üste çalış',
    icon: '👑',
    isUnlocked: false,
  },
  {
    id: 'level_5',
    name: 'Deneyimli Öğrenci',
    description: 'Seviye 5\'e ulaş',
    icon: '⭐',
    isUnlocked: false,
  },
  {
    id: 'level_10',
    name: 'Uzman Öğrenci',
    description: 'Seviye 10\'a ulaş',
    icon: '🏆',
    isUnlocked: false,
  },
  {
    id: 'complete_roadmap',
    name: 'Tamamlayıcı',
    description: 'İlk roadmap\'ini tamamla',
    icon: '✅',
    isUnlocked: false,
  },
  {
    id: 'study_60_min',
    name: 'Saatlik Çalışkan',
    description: 'Tek seferde 60 dakika çalış',
    icon: '⏰',
    isUnlocked: false,
  },
];

const DEFAULT_GAMIFICATION_DATA: GamificationData = {
  totalXp: 0,
  currentLevel: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: '',
  totalStudyMinutes: 0,
  completedRoadmaps: 0,
  achievements: ACHIEVEMENTS.map(achievement => ({ ...achievement })),
};

export const GamificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gamificationData, setGamificationData] = useState<GamificationData>(DEFAULT_GAMIFICATION_DATA);
  const [isLoading, setIsLoading] = useState(true);

  const loadGamificationData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('gamification_data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setGamificationData(parsedData);
      }
    } catch (error) {
      console.error('Failed to load gamification data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGamificationData = async (data: GamificationData) => {
    try {
      await AsyncStorage.setItem('gamification_data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save gamification data:', error);
    }
  };

  const addXp = async (amount: number, reason: string) => {
    const newTotalXp = gamificationData.totalXp + amount;
    const newLevel = calculateLevelInternal(newTotalXp);
    const oldLevel = gamificationData.currentLevel;
    
    const updatedData = {
      ...gamificationData,
      totalXp: newTotalXp,
      currentLevel: newLevel,
    };

    setGamificationData(updatedData);
    await saveGamificationData(updatedData);

    // Seviye atladı mı kontrol et
    if (newLevel > oldLevel) {
      Alert.alert(
        '🎉 Seviye Atladın!',
        `Tebrikler! Seviye ${newLevel}'e ulaştın!\n\n${reason}`,
        [{ text: 'Harika!' }]
      );
    }

    // Başarı rozetlerini kontrol et
    await checkAchievements();
  };

  const addStudyMinutes = async (minutes: number) => {
    const newTotalStudyMinutes = gamificationData.totalStudyMinutes + minutes;
    
    const updatedData = {
      ...gamificationData,
      totalStudyMinutes: newTotalStudyMinutes,
    };

    setGamificationData(updatedData);
    await saveGamificationData(updatedData);
  };

  const recordActivity = async () => {
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = gamificationData.lastActivityDate;
    
    let newStreak = gamificationData.currentStreak;
    
    if (lastActivity === today) {
      // Bugün zaten aktivite kaydedilmiş
      return;
    }
    
    if (lastActivity === '') {
      // İlk aktivite
      newStreak = 1;
    } else {
      const lastActivityDate = new Date(lastActivity);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastActivityDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Ardışık gün
        newStreak = gamificationData.currentStreak + 1;
      } else if (diffDays > 1) {
        // Streak bozuldu
        newStreak = 1;
      }
    }
    
    const updatedData = {
      ...gamificationData,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, gamificationData.longestStreak),
      lastActivityDate: today,
    };
    
    setGamificationData(updatedData);
    await saveGamificationData(updatedData);
    
    // Streak başarılarını kontrol et
    await checkAchievements();
  };

  const checkAchievements = async () => {
    const updatedAchievements = [...gamificationData.achievements];
    let hasNewAchievement = false;
    
    // Streak başarıları
    if (gamificationData.currentStreak >= 3) {
      const achievement = updatedAchievements.find(a => a.id === 'streak_3');
      if (achievement && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        hasNewAchievement = true;
      }
    }
    
    if (gamificationData.currentStreak >= 7) {
      const achievement = updatedAchievements.find(a => a.id === 'streak_7');
      if (achievement && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        hasNewAchievement = true;
      }
    }
    
    if (gamificationData.currentStreak >= 30) {
      const achievement = updatedAchievements.find(a => a.id === 'streak_30');
      if (achievement && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        hasNewAchievement = true;
      }
    }
    
    // Seviye başarıları
    if (gamificationData.currentLevel >= 5) {
      const achievement = updatedAchievements.find(a => a.id === 'level_5');
      if (achievement && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        hasNewAchievement = true;
      }
    }
    
    if (gamificationData.currentLevel >= 10) {
      const achievement = updatedAchievements.find(a => a.id === 'level_10');
      if (achievement && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        hasNewAchievement = true;
      }
    }
    
    if (hasNewAchievement) {
      const updatedData = {
        ...gamificationData,
        achievements: updatedAchievements,
      };
      
      setGamificationData(updatedData);
      await saveGamificationData(updatedData);
      
      Alert.alert(
        '🏆 Yeni Başarı!',
        'Yeni bir rozet kazandın! Profil sayfından görebilirsin.',
        [{ text: 'Harika!' }]
      );
    }
  };

  const refreshGamification = async () => {
    await loadGamificationData();
  };

  useEffect(() => {
    loadGamificationData();
  }, []);

  return (
    <GamificationContext.Provider 
      value={{ 
        gamificationData, 
        isLoading, 
        addXp, 
        addStudyMinutes,
        recordActivity, 
        checkAchievements,
        refreshGamification 
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};

// Yardımcı fonksiyonlar
export const calculateLevel = (totalXp: number): number => {
  if (totalXp < 100) return 1;
  return Math.floor((totalXp - 100) / 500) + 2;
};

export const calculateXpForNextLevel = (currentLevel: number): number => {
  if (currentLevel === 1) return 100;
  return 100 + (currentLevel - 1) * 500;
};

export const calculateProgressToNextLevel = (totalXp: number): number => {
  const currentLevel = calculateLevel(totalXp);
  
  if (currentLevel === 1) {
    return Math.min((totalXp / 100) * 100, 100);
  }
  
  const xpForCurrentLevel = 100 + (currentLevel - 2) * 500;
  const xpForNextLevel = 100 + (currentLevel - 1) * 500;
  const xpInCurrentLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  
  return Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);
}; 