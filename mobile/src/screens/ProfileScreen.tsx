import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TokenManager } from '../services/api';
import { UserProfile } from '../types';
import { GamificationCard } from '../components/GamificationCard';
import { AchievementsList } from '../components/AchievementsList';
import { useGamification } from '../contexts/GamificationContext';

interface Props {
  navigation: any;
  route: {
    params?: {
      userId?: number;
    };
  };
}

const ProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { gamificationData } = useGamification();

  const userId = route.params?.userId; // undefined = kendi profili

  const loadProfile = async () => {
    try {
      // Basit profil yükleme - TokenManager'dan user bilgisini al
      const userData = await TokenManager.getUser();
      if (userData) {
        setProfile({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          created_at: userData.created_at,
          subscription_type: userData.subscription_type || 'free',
          gamification: {
            total_xp: gamificationData.totalXp,
            current_level: gamificationData.currentLevel,
            daily_xp_today: 0,
            current_streak: gamificationData.currentStreak,
            longest_streak: gamificationData.longestStreak,
            level_name: `Level ${gamificationData.currentLevel}`,
            next_level_xp: gamificationData.currentLevel * 100,
            achievements_count: gamificationData.achievements.filter(a => a.isUnlocked).length,
          },
          achievements: gamificationData.achievements.filter(a => a.isUnlocked).map(a => ({
            id: parseInt(a.id),
            name: a.name,
            description: a.description,
            icon: a.icon,
            category: 'general',
            earned_at: a.unlockedAt,
          })),
          total_roadmaps: 0,
          completed_roadmaps: 0,
          total_study_hours: Math.floor(gamificationData.totalStudyMinutes / 60),
          is_own_profile: !userId,
        });
      }
    } catch (error) {
              Alert.alert('Error', 'Could not load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId, gamificationData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const getLevelIcon = (levelName: string) => {
    switch (levelName) {
      case 'Beginner': return '🌱';
      case 'Intermediate': return '⚡';
      case 'Advanced': return '🚀';
      case 'Expert': return '🏆';
      default: return '👑';
    }
  };

  const getLevelColor = (levelName: string) => {
    switch (levelName) {
      case 'Beginner': return '#4CAF50';
      case 'Intermediate': return '#FF9800';
      case 'Advanced': return '#F44336';
      case 'Expert': return '#9C27B0';
      default: return '#FFD700';
    }
  };

  const getSubscriptionBadge = (subscriptionType: string) => {
    if (subscriptionType === 'premium') {
      return (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>👑 PREMIUM</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
                      {profile.is_own_profile ? 'My Profile' : 'User Profile'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{profile.name}</Text>
          {profile.is_own_profile && profile.email && (
            <Text style={styles.userEmail}>{profile.email}</Text>
          )}
          {getSubscriptionBadge(profile.subscription_type)}
          <Text style={styles.joinDate}>
            Joined: {new Date(profile.created_at).toLocaleDateString('en-US')}
          </Text>
        </View>

        {/* Gamification Section */}
        <GamificationCard />
        
        {/* Quick Stats */}
        <View style={styles.section}>
                      <Text style={styles.sectionTitle}>📊 Quick Statistics</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatCard}>
              <Ionicons name="flame" size={24} color="#ff6b6b" />
              <Text style={styles.quickStatValue}>{gamificationData.currentStreak}</Text>
                              <Text style={styles.quickStatLabel}>Current Streak</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="star" size={24} color="#ffd700" />
              <Text style={styles.quickStatValue}>{gamificationData.longestStreak}</Text>
              <Text style={styles.quickStatLabel}>Longest Streak</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="trophy" size={24} color="#ff9a9e" />
              <Text style={styles.quickStatValue}>
                {gamificationData.achievements.filter(a => a.isUnlocked).length}
              </Text>
                              <Text style={styles.quickStatLabel}>Earned Badges</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="time" size={24} color="#4facfe" />
              <Text style={styles.quickStatValue}>
                {Math.floor(gamificationData.totalStudyMinutes / 60)}
              </Text>
                              <Text style={styles.quickStatLabel}>Study Hours</Text>
            </View>
          </View>
        </View>

        {/* Level & XP Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Level & XP</Text>
          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelIcon}>
                {getLevelIcon(profile.gamification.level_name)}
              </Text>
              <View style={styles.levelInfo}>
                <Text style={styles.levelText}>
                  Level {profile.gamification.current_level} - {profile.gamification.level_name}
                </Text>
                <Text style={styles.xpText}>
                  {profile.gamification.total_xp} XP
                </Text>
              </View>
            </View>
            
            {profile.gamification.next_level_xp > 0 && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  To next level: {profile.gamification.next_level_xp - profile.gamification.total_xp} XP
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(profile.gamification.total_xp / profile.gamification.next_level_xp) * 100}%`,
                        backgroundColor: getLevelColor(profile.gamification.level_name),
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
                      <Text style={styles.sectionTitle}>📊 Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.gamification.current_streak}</Text>
                              <Text style={styles.statLabel}>Current Streak</Text>
              <Text style={styles.statIcon}>🔥</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.gamification.longest_streak}</Text>
              <Text style={styles.statLabel}>Longest Streak</Text>
              <Text style={styles.statIcon}>🏅</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.total_roadmaps}</Text>
              <Text style={styles.statLabel}>Total Roadmaps</Text>
              <Text style={styles.statIcon}>🗺️</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.completed_roadmaps}</Text>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={styles.statIcon}>✅</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.total_study_hours}</Text>
                              <Text style={styles.statLabel}>Study Hours</Text>
              <Text style={styles.statIcon}>⏰</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.gamification.daily_xp_today}</Text>
                              <Text style={styles.statLabel}>Today's XP</Text>
              <Text style={styles.statIcon}>⭐</Text>
            </View>
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.section}>
                      <Text style={styles.sectionTitle}>🏆 Achievement Badges</Text>
          <AchievementsList compact />
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  premiumText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  joinDate: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  levelCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 16,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  levelInfo: {
    flex: 1,
  },
  levelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  xpText: {
    fontSize: 16,
    color: '#666',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginTop: 4,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 12,
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 10,
    color: '#999',
  },
  emptyAchievements: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  emptyAchievementsText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyAchievementsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Quick stats styles
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickStatCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default ProfileScreen; 