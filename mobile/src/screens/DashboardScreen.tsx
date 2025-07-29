import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getUserRoadmaps } from '../services/api';
import { DashboardStats, RoadmapSummary } from '../types';
import { GamificationCard } from '../components/GamificationCard';
import { useGamification } from '../contexts/GamificationContext';

const DashboardScreen = ({ navigation }: { navigation: any }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { recordActivity } = useGamification();

  const loadDashboardData = async () => {
    try {
      const [dashboardStats, userRoadmaps] = await Promise.all([
        getDashboardStats(),
        getUserRoadmaps()
      ]);
      
      console.log('Dashboard stats:', dashboardStats);
      console.log('User roadmaps:', userRoadmaps);
      
      setStats(dashboardStats);
      setRoadmaps(userRoadmaps);
      
      // Gamification aktivitesini kaydet
      await recordActivity();
    } catch (error) {
      console.error('Dashboard data load error:', error);
      Alert.alert('Hata', 'Dashboard verileri yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const StatCard = ({ title, value, icon, color }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Öğrenme yolculuğunuza genel bakış</Text>
          
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
          </View>
        )}

        {/* Gamification Section */}
        <GamificationCard compact />

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
});

export default DashboardScreen; 