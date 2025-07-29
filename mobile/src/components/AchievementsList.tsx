import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGamification } from '../contexts/GamificationContext';

interface AchievementsListProps {
  compact?: boolean;
  onAchievementPress?: (achievementId: string) => void;
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ 
  compact = false,
  onAchievementPress 
}) => {
  const { gamificationData } = useGamification();
  const { achievements } = gamificationData;

  const unlockedAchievements = achievements.filter(a => a.isUnlocked);
  const lockedAchievements = achievements.filter(a => !a.isUnlocked);

  const AchievementItem = ({ achievement, isUnlocked }: { 
    achievement: any; 
    isUnlocked: boolean; 
  }) => (
    <TouchableOpacity
      style={[
        styles.achievementItem,
        isUnlocked ? styles.unlockedAchievement : styles.lockedAchievement
      ]}
      onPress={() => onAchievementPress?.(achievement.id)}
      activeOpacity={0.7}
    >
      <View style={styles.achievementIcon}>
        <Text style={styles.achievementEmoji}>{achievement.icon}</Text>
        {!isUnlocked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={16} color="#666" />
          </View>
        )}
      </View>
      
      <View style={styles.achievementContent}>
        <Text style={[
          styles.achievementName,
          isUnlocked ? styles.unlockedText : styles.lockedText
        ]}>
          {achievement.name}
        </Text>
        <Text style={[
          styles.achievementDescription,
          isUnlocked ? styles.unlockedDescription : styles.lockedDescription
        ]}>
          {achievement.description}
        </Text>
        {isUnlocked && achievement.unlockedAt && (
          <Text style={styles.unlockedDate}>
            {new Date(achievement.unlockedAt).toLocaleDateString('tr-TR')}
          </Text>
        )}
      </View>
      
      {isUnlocked && (
        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactTitle}>Başarılar</Text>
          <Text style={styles.compactCount}>
            {unlockedAchievements.length}/{achievements.length}
          </Text>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.compactScroll}
        >
          {achievements.map((achievement) => (
            <TouchableOpacity
              key={achievement.id}
              style={[
                styles.compactAchievement,
                achievement.isUnlocked ? styles.compactUnlocked : styles.compactLocked
              ]}
              onPress={() => onAchievementPress?.(achievement.id)}
            >
              <Text style={styles.compactEmoji}>{achievement.icon}</Text>
              {!achievement.isUnlocked && (
                <View style={styles.compactLockOverlay}>
                  <Ionicons name="lock-closed" size={12} color="#666" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Başarı Rozetleri</Text>
        <Text style={styles.count}>
          {unlockedAchievements.length}/{achievements.length} tamamlandı
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {unlockedAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kazanılan Rozetler</Text>
            {unlockedAchievements.map((achievement) => (
              <AchievementItem 
                key={achievement.id} 
                achievement={achievement} 
                isUnlocked={true} 
              />
            ))}
          </View>
        )}

        {lockedAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kilitli Rozetler</Text>
            {lockedAchievements.map((achievement) => (
              <AchievementItem 
                key={achievement.id} 
                achievement={achievement} 
                isUnlocked={false} 
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  count: {
    fontSize: 14,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unlockedAchievement: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  lockedAchievement: {
    opacity: 0.6,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  achievementEmoji: {
    fontSize: 24,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementContent: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  unlockedText: {
    color: '#1f2937',
  },
  lockedText: {
    color: '#6b7280',
  },
  achievementDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  unlockedDescription: {
    color: '#4b5563',
  },
  lockedDescription: {
    color: '#9ca3af',
  },
  unlockedDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  compactCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  compactScroll: {
    flexDirection: 'row',
  },
  compactAchievement: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  compactUnlocked: {
    backgroundColor: '#e0f2fe',
  },
  compactLocked: {
    opacity: 0.6,
  },
  compactEmoji: {
    fontSize: 20,
  },
  compactLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 