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
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { getCommunityStats, getCommunityPosts } from '../services/api';

type CommunityScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Community'>;

interface Props {
  navigation: CommunityScreenNavigationProp;
}

interface CommunityPost {
  id: number;
  user_name: string;
  title: string;
  content: string;
  post_type: string;
  views: number;
  likes: number;
  comment_count: number;
  created_at: string;
}

export default function CommunityScreen({ navigation }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all'); // all, questions, discussions

  useEffect(() => {
    loadCommunityData();
  }, [selectedTab]);

  const loadCommunityData = async () => {
    try {
      setLoading(true);
      const [communityStats, communityPosts] = await Promise.all([
        getCommunityStats(),
        getCommunityPosts(20, 0, selectedTab === 'all' ? undefined : selectedTab)
      ]);
      
      setStats(communityStats);
      setPosts(communityPosts);
    } catch (error) {
      console.error('Community data error:', error);
      Alert.alert('Hata', 'Topluluk verileri yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCommunityData();
  };

  const renderPost = ({ item }: { item: CommunityPost }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => {
        // Navigate to post detail screen
        // navigation.navigate('PostDetail', { postId: item.id });
        Alert.alert('Post Detail', `${item.title}\n\n${item.content}`);
      }}
    >
      <View style={styles.postHeader}>
        <View style={styles.postMeta}>
          <Text style={styles.userName}>{item.user_name}</Text>
          <Text style={styles.postDate}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text>
        </View>
        <View style={[styles.typeTag, { backgroundColor: getTypeColor(item.post_type) }]}>
          <Text style={styles.typeText}>{getTypeLabel(item.post_type)}</Text>
        </View>
      </View>
      
      <Text style={styles.postTitle}>{item.title}</Text>
      <Text style={styles.postContent} numberOfLines={3}>
        {item.content}
      </Text>
      
      <View style={styles.postStats}>
        <View style={styles.statItem}>
          <Ionicons name="eye-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.views}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="heart-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.likes}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.comment_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'question': return '#3B82F6';
      case 'discussion': return '#10B981';
      case 'tip': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'question': return 'Soru';
      case 'discussion': return 'Tartışma';
      case 'tip': return 'İpucu';
      default: return type;
    }
  };

  const handleCreatePost = () => {
    // Navigate to create post screen
    // navigation.navigate('CreatePost');
    Alert.alert('Yeni Gönderi', 'Create Post ekranı yakında eklenecek!');
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Topluluk yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Topluluk</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreatePost}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>Üye</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeToday}</Text>
            <Text style={styles.statLabel}>Bugün Aktif</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalRoadmaps || stats.totalPosts || 0}</Text>
            <Text style={styles.statLabel}>Gönderi</Text>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
            Tümü
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'question' && styles.activeTab]}
          onPress={() => setSelectedTab('question')}
        >
          <Text style={[styles.tabText, selectedTab === 'question' && styles.activeTabText]}>
            Sorular
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'discussion' && styles.activeTab]}
          onPress={() => setSelectedTab('discussion')}
        >
          <Text style={[styles.tabText, selectedTab === 'discussion' && styles.activeTabText]}>
            Tartışma
          </Text>
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        style={styles.postsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Henüz gönderi yok</Text>
            <Text style={styles.emptyDescription}>
              İlk gönderiyi sen oluştur ve toplulukla paylaş!
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePost}>
              <Text style={styles.emptyButtonText}>Soru Sor</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  createButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  postsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
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
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginRight: 8,
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  typeTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  postContent: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  activeTabText: {
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f8fafc',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 