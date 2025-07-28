import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { 
  getCommunityPosts, 
  getCommunityStats,
  togglePostLike,
  toggleReplyLike,
  getPostReplies,
  createReply,
  CommunityPost,
  CommunityStats,
  CreateReplyRequest
} from '../services/api';

type ExploreScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Explore'>;

interface Props {
  navigation: ExploreScreenNavigationProp;
}

export default function ExploreScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('trending');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReplies, setShowReplies] = useState<number | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [newReply, setNewReply] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [postsData, statsData] = await Promise.all([
        getCommunityPosts(selectedFilter),
        getCommunityStats()
      ]);
      setPosts(postsData);
      setStats(statsData);
    } catch (error) {
      console.error('Load explore data error:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: number) => {
    try {
      const result = await togglePostLike(postId);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, likes_count: result.likes_count, is_liked: result.is_liked }
          : post
      ));
    } catch (error) {
      console.error('Toggle like error:', error);
      Alert.alert('Hata', 'Beğeni işlemi başarısız oldu');
    }
  };

  const handleReplyLike = async (replyId: number) => {
    try {
      const result = await toggleReplyLike(replyId);
      setReplies(replies.map(reply => 
        reply.id === replyId 
          ? { ...reply, likes_count: result.likes_count, is_liked: result.is_liked }
          : reply
      ));
    } catch (error) {
      console.error('Toggle reply like error:', error);
      Alert.alert('Hata', 'Yorum beğenisi başarısız oldu');
    }
  };

  const loadReplies = async (postId: number) => {
    try {
      const repliesData = await getPostReplies(postId);
      setReplies(repliesData);
      setShowReplies(postId);
    } catch (error) {
      console.error('Load replies error:', error);
      Alert.alert('Hata', 'Yorumlar yüklenirken bir hata oluştu');
    }
  };

  const handleReply = async (postId: number) => {
    if (!newReply.trim()) return;

    try {
      setReplySubmitting(true);
      const replyData: CreateReplyRequest = {
        content: newReply.trim()
      };
      
      const newReplyResponse = await createReply(postId, replyData);
      
      // Add new reply to the list
      setReplies([...replies, newReplyResponse]);
      
      // Update post reply count
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, replies_count: post.replies_count + 1 }
          : post
      ));
      
      setNewReply('');
    } catch (error) {
      console.error('Create reply error:', error);
      Alert.alert('Hata', 'Yorum gönderilemedi');
    } finally {
      setReplySubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} saniye önce`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} dakika önce`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} saat önce`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} gün önce`;
  };

  const getSkillIcon = (skillName: string | undefined) => {
    if (!skillName) return 'code-outline';
    
    const skill = skillName.toLowerCase();
    if (skill.includes('javascript') || skill.includes('js')) return 'logo-javascript';
    if (skill.includes('python')) return 'logo-python';
    if (skill.includes('react')) return 'logo-react';
    if (skill.includes('node')) return 'logo-nodejs';
    if (skill.includes('css')) return 'logo-css3';
    if (skill.includes('html')) return 'logo-html5';
    if (skill.includes('angular')) return 'logo-angular';
    if (skill.includes('vue')) return 'logo-vue';
    return 'code-outline';
  };

  const getSkillColors = (skillName: string | undefined): [string, string] => {
    if (!skillName) return ['#6b7280', '#4b5563'];
    
    const skill = skillName.toLowerCase();
    if (skill.includes('javascript') || skill.includes('js')) return ['#f7df1e', '#e6c200'];
    if (skill.includes('python')) return ['#3776ab', '#2d5a87'];
    if (skill.includes('react')) return ['#61dafb', '#21a1c4'];
    if (skill.includes('node')) return ['#68a063', '#4f7c47'];
    if (skill.includes('css')) return ['#1572b6', '#0c5aa6'];
    if (skill.includes('html')) return ['#e34f26', '#c13818'];
    if (skill.includes('angular')) return ['#dd0031', '#b30027'];
    if (skill.includes('vue')) return ['#4fc08d', '#369970'];
    return ['#6b7280', '#4b5563'];
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
          <Text style={styles.headerTitle}>Keşfet</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Sorular, konular ara..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Popular Skills */}
        <View style={styles.skillsSection}>
          <Text style={styles.sectionTitle}>Popüler Konular</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.skillsContainer}>
                {stats?.popular_skills?.map((skill, index) => (
                  <TouchableOpacity key={index} style={styles.skillCard}>
                    <LinearGradient 
                      colors={getSkillColors(skill.name)} 
                      style={styles.skillGradient}
                    >
                      <Ionicons 
                        name={getSkillIcon(skill.name)} 
                        size={24} 
                        color="#fff" 
                      />
                      <Text style={styles.skillName}>{skill.name}</Text>
                      <Text style={styles.skillStats}>
                        {skill.learner_count} öğrenci • {skill.post_count} gönderi
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )) || []}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterTabs}>
              {[
                { key: 'trending', label: 'Trend', icon: 'trending-up' },
                { key: 'popular', label: 'Popüler', icon: 'flame' },
                { key: 'recent', label: 'Yeni', icon: 'time' },
                { key: 'expert', label: 'Uzman', icon: 'star' },
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterTab,
                    selectedFilter === filter.key && styles.activeFilterTab,
                  ]}
                  onPress={() => setSelectedFilter(filter.key)}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={16} 
                    color={selectedFilter === filter.key ? '#fff' : '#6b7280'} 
                  />
                  <Text style={[
                    styles.filterText,
                    selectedFilter === filter.key && styles.activeFilterText,
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Posts */}
        <View style={styles.postsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Gönderiler yükleniyor...</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.authorInfo}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Profile', { userId: post.author_id })}
                    >
                      <Text style={[styles.authorName, styles.authorLink]}>{post.author_name}</Text>
                    </TouchableOpacity>
                    {post.is_expert_post && (
                      <View style={styles.expertBadge}>
                        <Ionicons name="star" size={12} color="#f59e0b" />
                        <Text style={styles.expertText}>Uzman</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.postTime}>
                    {formatTimeAgo(post.created_at)}
                  </Text>
                </View>

                {post.skill_name && (
                  <View style={styles.skillTag}>
                    <Text style={styles.skillTagText}>{post.skill_name}</Text>
                  </View>
                )}

                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent} numberOfLines={3}>
                  {post.content}
                </Text>

                <View style={styles.postActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleLike(post.id)}
                  >
                    <Ionicons 
                      name={post.is_liked ? "heart" : "heart-outline"} 
                      size={18} 
                      color={post.is_liked ? "#ef4444" : "#6b7280"} 
                    />
                    <Text style={[styles.actionText, post.is_liked && styles.likedText]}>
                      {post.likes_count}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => showReplies === post.id ? setShowReplies(null) : loadReplies(post.id)}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
                    <Text style={styles.actionText}>{post.replies_count}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-outline" size={18} color="#6b7280" />
                    <Text style={styles.actionText}>Paylaş</Text>
                  </TouchableOpacity>
                </View>

                {/* Replies Section */}
                {showReplies === post.id && (
                  <View style={styles.repliesSection}>
                    <View style={styles.repliesHeader}>
                      <Text style={styles.repliesTitle}>Yorumlar</Text>
                    </View>
                    
                    {replies.map((reply) => (
                      <View key={reply.id} style={styles.replyCard}>
                        <View style={styles.replyHeader}>
                          <TouchableOpacity
                            onPress={() => navigation.navigate('Profile', { userId: reply.author_id })}
                          >
                            <Text style={[styles.replyAuthor, styles.authorLink]}>{reply.author_name}</Text>
                          </TouchableOpacity>
                          <Text style={styles.replyTime}>
                            {formatTimeAgo(reply.created_at)}
                          </Text>
                        </View>
                        <Text style={styles.replyContent}>{reply.content}</Text>
                        <View style={styles.replyActions}>
                          <TouchableOpacity 
                            style={styles.replyActionButton}
                            onPress={() => handleReplyLike(reply.id)}
                          >
                            <Ionicons 
                              name={reply.is_liked ? "heart" : "heart-outline"} 
                              size={14} 
                              color={reply.is_liked ? "#ef4444" : "#9ca3af"} 
                            />
                            <Text style={[styles.replyActionText, reply.is_liked && styles.likedText]}>
                              {reply.likes_count}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    
                    {/* Reply Input */}
                    <View style={styles.replyInput}>
                      <TextInput
                        style={styles.replyTextInput}
                        placeholder="Yorumunuzu yazın..."
                        value={newReply}
                        onChangeText={setNewReply}
                        multiline
                        placeholderTextColor="#9ca3af"
                      />
                      <TouchableOpacity
                        style={[styles.replyButton, !newReply.trim() && styles.replyButtonDisabled]}
                        onPress={() => handleReply(post.id)}
                        disabled={!newReply.trim() || replySubmitting}
                      >
                        {replySubmitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="send" size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))
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
    width: 24,
    height: 24,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  skillsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  skillsContainer: {
    flexDirection: 'row',
  },
  skillCard: {
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  skillGradient: {
    padding: 16,
    width: 120,
    alignItems: 'center',
  },
  skillName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  skillStats: {
    color: '#f3f4f6',
    fontSize: 10,
    marginBottom: 2,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  activeFilterTab: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  postsContainer: {
    padding: 16,
  },
  postCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  authorLink: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  expertBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  expertText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
  },
  skillTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  skillTagText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '500',
  },
  postTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
  },
  likedText: {
    color: '#ef4444',
  },
  repliesSection: {
    marginTop: 12,
  },
  repliesHeader: {
    marginBottom: 12,
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  replyCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  replyTime: {
    fontSize: 10,
    color: '#9ca3af',
  },
  replyContent: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  replyActionButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  replyActionText: {
    fontSize: 12,
    color: '#6b7280',
  },
  replyInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  replyTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  replyButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  replyButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    marginTop: 12,
  },
}); 