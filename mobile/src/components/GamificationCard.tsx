import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGamification, calculateProgressToNextLevel } from '../contexts/GamificationContext';

interface GamificationCardProps {
  onPress?: () => void;
  compact?: boolean;
}

export const GamificationCard: React.FC<GamificationCardProps> = ({ 
  onPress, 
  compact = false 
}) => {
  const { gamificationData } = useGamification();
  const { totalXp, currentLevel, currentStreak, longestStreak } = gamificationData;
  
  const progressToNextLevel = calculateProgressToNextLevel(totalXp);
  const xpForNextLevel = currentLevel * 100;
  const xpInCurrentLevel = totalXp - ((currentLevel - 1) * 100);

  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.compactGradient}
        >
          <View style={styles.compactContent}>
            <View style={styles.compactLeft}>
              <Text style={styles.compactLevel}>Level {currentLevel}</Text>
              <Text style={styles.compactXp}>{totalXp} XP</Text>
            </View>
            <View style={styles.compactRight}>
              <View style={styles.streakContainer}>
                <Ionicons name="flame" size={16} color="#ff6b6b" />
                <Text style={styles.streakText}>{currentStreak}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Gamification</Text>
          <Ionicons name="trophy" size={24} color="#ffffff" />
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentLevel}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalXp}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
          
          <View style={styles.statItem}>
            <View style={styles.streakContainer}>
              <Ionicons name="flame" size={20} color="#ff6b6b" />
              <Text style={styles.streakValue}>{currentStreak}</Text>
            </View>
            <Text style={styles.statLabel}>Daily Streak</Text>
          </View>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              Next Level: {xpInCurrentLevel}/{xpForNextLevel} XP
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progressToNextLevel)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${progressToNextLevel}%` }]} 
            />
          </View>
        </View>
        
        {longestStreak > 0 && (
          <View style={styles.longestStreak}>
            <Ionicons name="star" size={16} color="#ffd700" />
            <Text style={styles.longestStreakText}>
              En uzun streak: {longestStreak} gün
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradient: {
    padding: 20,
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#e0e0e0',
    textAlign: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#e0e0e0',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  longestStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  longestStreakText: {
    fontSize: 12,
    color: '#e0e0e0',
  },
  // Compact styles
  compactContainer: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  compactGradient: {
    padding: 12,
    borderRadius: 12,
  },
  compactContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLeft: {
    flex: 1,
  },
  compactLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  compactXp: {
    fontSize: 12,
    color: '#e0e0e0',
  },
  compactRight: {
    alignItems: 'flex-end',
  },
  streakText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
}); 