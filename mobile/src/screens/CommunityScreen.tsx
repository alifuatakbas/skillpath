import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { getCommunityStats, CommunityStats } from '../services/api';

type CommunityScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Community'>;

interface Props {
  navigation: CommunityScreenNavigationProp;
}

export default function CommunityScreen({ navigation }: Props) {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommunityStats();
  }, []);

  const loadCommunityStats = async () => {
    try {
      setLoading(true);
      const communityStats = await getCommunityStats();
      setStats(communityStats);
    } catch (error) {
      console.error('Community stats error:', error);
      Alert.alert('Hata', 'Topluluk verileri yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Topluluk</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Hero Section */}
        <LinearGradient
          colors={['#f1f5f9', '#e0f2fe']}
          style={styles.heroSection}
        >
          <Text style={styles.heroTitle}>
            Öğrenme{'\n'}
            <Text style={styles.heroGradientText}>Topluluğu</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Diğer öğrencilerle bağlan, sorular sor, deneyimlerini paylaş
          </Text>
        </LinearGradient>

        {/* Community Options */}
        <View style={styles.communityOptions}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => navigation.navigate('MyCommunity')}
          >
            <LinearGradient 
              colors={['#667eea', '#764ba2']} 
              style={styles.optionGradient}
            >
              <View style={styles.optionContent}>
                <Ionicons name="people" size={32} color="#fff" />
                <Text style={styles.optionTitle}>Benim Topluluğum</Text>
                <Text style={styles.optionSubtitle}>
                  Roadmap'lerinizdeki konular hakkında soru sorun ve deneyim paylaşın
                </Text>
                <View style={styles.optionFeatures}>
                  <Text style={styles.featureText}>• Kendi roadmap'leriniz</Text>
                  <Text style={styles.featureText}>• Benzer öğrenciler</Text>
                  <Text style={styles.featureText}>• Özel sorular</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => navigation.navigate('Explore')}
          >
            <LinearGradient 
              colors={['#f093fb', '#f5576c']} 
              style={styles.optionGradient}
            >
              <View style={styles.optionContent}>
                <Ionicons name="compass" size={32} color="#fff" />
                <Text style={styles.optionTitle}>Keşfet</Text>
                <Text style={styles.optionSubtitle}>
                  Tüm skill'ler ve konular hakkında popüler içerikleri keşfedin
                </Text>
                <View style={styles.optionFeatures}>
                  <Text style={styles.featureText}>• Tüm konular</Text>
                  <Text style={styles.featureText}>• Popüler sorular</Text>
                  <Text style={styles.featureText}>• Uzman tavsiyeleri</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Topluluk İstatistikleri</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.active_users || 0}</Text>
                <Text style={styles.statLabel}>Aktif Üye</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.total_posts || 0}</Text>
                <Text style={styles.statLabel}>Toplam Post</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.total_replies || 0}</Text>
                <Text style={styles.statLabel}>Toplam Cevap</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats?.popular_skills?.length || 0}</Text>
                <Text style={styles.statLabel}>Popüler Skill</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  heroSection: {
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroGradientText: {
    color: '#3b82f6',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  communityOptions: {
    paddingHorizontal: 16,
    gap: 16,
  },
  optionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionGradient: {
    padding: 20,
  },
  optionContent: {
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#f3f4f6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  optionFeatures: {
    alignItems: 'flex-start',
    width: '100%',
  },
  featureText: {
    fontSize: 12,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  statsContainer: {
    padding: 16,
    marginTop: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
}); 