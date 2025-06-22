import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getUserRoadmaps, getStreakData, getUserGamification, getUserAchievements, getOwnProfile } from '../services/api';
import { DashboardStats, RoadmapSummary, GamificationData, Achievement, UserProfile } from '../types';

const DashboardScreen = ({ navigation }: { navigation: any }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [gamificationData, setGamificationData] = useState<GamificationData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [streakDetails, setStreakDetails] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadDashboardData = async () => {
    try {
      const [dashboardStats, userRoadmaps, gamification, userAchievements, profile] = await Promise.all([
        getDashboardStats(),
        getUserRoadmaps(),
        getUserGamification(),
        getUserAchievements(),
        getOwnProfile()
      ]);
      
      setStats(dashboardStats);
      setRoadmaps(userRoadmaps);
      setGamificationData(gamification);
      setAchievements(userAchievements);
      setProfile(profile);
    } catch (error) {
      console.error('Dashboard data load error:', error);
      Alert.alert('Hata', 'Dashboard verileri yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStreakDetails = async () => {
    try {
      const streakData = await getStreakData();
      setStreakDetails(streakData);
      setStreakModalVisible(true);
    } catch (error) {
      console.error('Streak data load error:', error);
      Alert.alert('Hata', 'Streak bilgileri yüklenemedi');
    }
  };

  const showAchievements = () => {
    setAchievementsModalVisible(true);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Screen'e her focus olduğunda veriyi yenile
  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const StatCard = ({ title, value, icon, color, onPress }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </TouchableOpacity>
  );

  const RoadmapCard = ({ roadmap }: { roadmap: RoadmapSummary }) => (
    <TouchableOpacity
      style={styles.roadmapCard}
      onPress={() => navigation.navigate('RoadmapDetail', { roadmapId: roadmap.id })}
    >
      <View style={styles.roadmapHeader}>
        <Text style={styles.roadmapTitle}>{roadmap.title}</Text>
        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(roadmap.difficulty_level) }]}>
          <Text style={styles.difficultyText}>{roadmap.difficulty_level}</Text>
        </View>
      </View>
      
      <Text style={styles.roadmapDescription} numberOfLines={2}>
        {roadmap.description}
      </Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, { width: `${roadmap.completion_percentage}%` }]} 
          />
        </View>
        <Text style={styles.progressText}>
          {roadmap.completed_steps}/{roadmap.total_steps} adım (%{roadmap.completion_percentage})
        </Text>
      </View>
      
      <View style={styles.roadmapFooter}>
        <Text style={styles.weeksText}>{roadmap.total_weeks} hafta</Text>
        <Text style={styles.dateText}>
          {new Date(roadmap.created_at).toLocaleDateString('tr-TR')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Dashboard yükleniyor...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      {/* Profile Card */}
      {profile && (
        <View style={styles.profileCard}>
          <LinearGradient 
            colors={['#FF6B6B', '#4ECDC4']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 0 }} 
            style={styles.profileGradient}
          >
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {profile.name ? profile.name.charAt(0).toUpperCase() : '👤'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileEmail}>{profile.email}</Text>
                                 {profile.subscription_type === 'premium' && (
                   <View style={styles.premiumBadge}>
                     <Text style={styles.premiumText}>👑 Premium</Text>
                   </View>
                 )}
              </View>
            </View>
            
            <View style={styles.profileStats}>
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>{profile.gamification.current_level}</Text>
                <Text style={styles.profileStatLabel}>Seviye</Text>
              </View>
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>{profile.gamification.total_xp}</Text>
                <Text style={styles.profileStatLabel}>XP</Text>
              </View>
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>{profile.gamification.current_streak}</Text>
                <Text style={styles.profileStatLabel}>Streak</Text>
              </View>
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>{profile.achievements?.length || 0}</Text>
                <Text style={styles.profileStatLabel}>Rozet</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Achievements Showcase */}
      {profile?.achievements && profile.achievements.length > 0 && (
        <View style={styles.achievementsShowcase}>
          <View style={styles.showcaseHeader}>
            <Text style={styles.showcaseTitle}>🏆 Son Rozetler</Text>
            <TouchableOpacity onPress={showAchievements}>
              <Text style={styles.viewAllText}>Tümünü Gör</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsList}>
            {profile.achievements.slice(0, 5).map((achievement) => (
              <TouchableOpacity key={achievement.id} style={styles.achievementShowcaseItem} onPress={showAchievements}>
                <Text style={styles.achievementShowcaseIcon}>{achievement.icon}</Text>
                <Text style={styles.achievementShowcaseName} numberOfLines={2}>{achievement.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickActionButton} 
          onPress={() => navigation.navigate('RoadmapGeneration')}
        >
          <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.quickActionGradient}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Yeni Roadmap</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionButton} 
          onPress={showAchievements}
        >
          <LinearGradient colors={['#9C27B0', '#673AB7']} style={styles.quickActionGradient}>
            <Ionicons name="trophy" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Rozetlerim</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionButton} 
          onPress={() => navigation.navigate('Profile')}
        >
          <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.quickActionGradient}>
            <Ionicons name="person" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Profil</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Achievements Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={achievementsModalVisible}
        onRequestClose={() => setAchievementsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏆 Rozetlerim</Text>
              <TouchableOpacity
                onPress={() => setAchievementsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {achievements.length > 0 ? (
                achievements.map((achievement) => (
                  <View key={achievement.id} style={styles.achievementItem}>
                    <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                    <View style={styles.achievementInfo}>
                      <Text style={styles.achievementName}>{achievement.name}</Text>
                      <Text style={styles.achievementDescription}>{achievement.description}</Text>
                      {achievement.earned_at && (
                        <Text style={styles.achievementDate}>
                          Kazanıldı: {new Date(achievement.earned_at).toLocaleDateString('tr-TR')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyAchievements}>
                  <Text style={styles.emptyText}>Henüz rozet kazanmadınız</Text>
                  <Text style={styles.emptySubtext}>Günlük görevleri tamamlayarak rozet kazanın!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Streak Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={streakModalVisible}
        onRequestClose={() => setStreakModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔥 Streak Detayları</Text>
              <TouchableOpacity
                onPress={() => setStreakModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {streakDetails && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.streakInfoCard}>
                  <Text style={styles.streakInfoTitle}>Mevcut Durum</Text>
                  <Text style={styles.streakInfoValue}>
                    {streakDetails.current_streak} gün streak
                  </Text>
                  <Text style={styles.streakInfoDesc}>
                    Son aktivite: {streakDetails.last_activity_date ? 
                      new Date(streakDetails.last_activity_date).toLocaleDateString('tr-TR') : 
                      'Henüz aktivite yok'
                    }
                  </Text>
                </View>
                
                <View style={styles.streakInfoCard}>
                  <Text style={styles.streakInfoTitle}>Geçen Süre</Text>
                  <Text style={styles.streakInfoValue}>
                    {streakDetails.days_since_last_activity} gün
                  </Text>
                  <Text style={styles.streakInfoDesc}>
                    Son aktiviteden beri geçen süre
                  </Text>
                </View>
                
                <View style={styles.streakTip}>
                  <Ionicons name="bulb-outline" size={20} color="#FF9800" />
                  <Text style={styles.streakTipText}>
                    Streak'inizi korumak için her gün en az bir roadmap adımı tamamlayın!
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Dashboard</Text>
              <Text style={styles.headerSubtitle}>Öğrenme yolculuğunuza genel bakış</Text>
            </View>
          </View>
          
          {/* Notification Buttons */}
          <View style={styles.notificationButtons}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('NotificationSettings')}
            >
              <Text style={styles.notificationIcon}>⚙️</Text>
              <Text style={styles.notificationButtonText}>Bildirim Ayarları</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('NotificationHistory')}
            >
              <Text style={styles.notificationIcon}>🔔</Text>
              <Text style={styles.notificationButtonText}>Bildirim Geçmişi</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <StatCard
                title="Toplam Roadmap"
                value={stats.total_roadmaps}
                icon="map-outline"
                color="#2196F3"
              />
              <StatCard
                title="Aktif Roadmap"
                value={stats.active_roadmaps}
                icon="play-circle-outline"
                color="#4CAF50"
              />
            </View>
            
            <View style={styles.statsRow}>
              <StatCard
                title="Tamamlanan"
                value={stats.completed_roadmaps}
                icon="checkmark-circle-outline"
                color="#8BC34A"
              />
              <StatCard
                title="İlerleme"
                value={`%${stats.completion_percentage}`}
                icon="trending-up-outline"
                color="#FF9800"
              />
            </View>
            
            <View style={styles.statsRow}>
              <StatCard
                title="Toplam Adım"
                value={`${stats.completed_steps}/${stats.total_steps}`}
                icon="list-outline"
                color="#9C27B0"
              />
              <StatCard
                title="Öğrenme Saati"
                value={`${stats.total_learning_hours}h`}
                icon="time-outline"
                color="#FF5722"
              />
            </View>
            
            <View style={styles.statsRow}>
              <StatCard
                title="Mevcut Seri"
                value={`${stats.current_streak} gün`}
                icon="flame-outline"
                color="#FF6B35"
                onPress={loadStreakDetails}
              />
              <StatCard
                title="En Uzun Seri"
                value={`${stats.longest_streak} gün`}
                icon="trophy-outline"
                color="#FFD700"
                onPress={loadStreakDetails}
              />
            </View>
          </View>
        )}

        {/* Roadmaps Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Roadmap'lerim</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('RoadmapGeneration')}
              style={styles.addButton}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Yeni</Text>
            </TouchableOpacity>
          </View>

          {roadmaps.length > 0 ? (
            roadmaps.map((roadmap) => (
              <RoadmapCard key={roadmap.id} roadmap={roadmap} />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Henüz roadmap'iniz yok</Text>
              <Text style={styles.emptySubtext}>İlk roadmap'inizi oluşturmak için yukarıdaki butona tıklayın</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsContainer: {
    marginBottom: 30,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 5,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  roadmapCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  roadmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  roadmapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  roadmapDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  roadmapFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeksText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  notificationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  notificationIcon: {
    fontSize: 16,
    color: '#fff',
    marginRight: 4,
  },
  notificationButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    flex: 1,
  },
  streakInfoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  streakInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  streakInfoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  streakInfoDesc: {
    fontSize: 14,
    color: '#666',
  },
  streakTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  streakTipText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  gamificationSection: {
    marginBottom: 30,
  },
  gamificationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  gamificationCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 20,
    color: '#333',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  cardSubtext: {
    fontSize: 12,
    color: '#666',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  xpProgressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 4,
  },
  xpProgressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementIcon: {
    fontSize: 20,
    color: '#333',
    marginRight: 8,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#666',
  },
  achievementDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyAchievements: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  // New Profile Card Styles
  profileCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  profileGradient: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  premiumBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  premiumText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Achievements Showcase Styles
  achievementsShowcase: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  showcaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  showcaseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewAllText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
  achievementsList: {
    flexDirection: 'row',
  },
  achievementShowcaseItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  achievementShowcaseIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  achievementShowcaseName: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  // Quick Actions Styles
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  quickActionButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionGradient: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DashboardScreen; 