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
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { getCommunityStats, getCommunityPosts, likePost, createComment, getPostComments, getUserRoadmaps } from '../services/api';

type CommunityScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Community'>;

interface Props {
  navigation: CommunityScreenNavigationProp;
}

interface CommunityPost {
  id: number;
  user_name: string;
  title: string;
  content: string;
  skill_name?: string;
  post_type?: string;
  likes_count: number;
  replies_count: number;
  views_count: number;  // views_count eklendi
  is_expert_post: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface CommunityComment {
  id: number;
  post_id: number;
  user_id: number;
  user_name: string;
  content: string;
  parent_comment_id?: number;
  likes: number;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export default function CommunityScreen({ navigation }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('latest'); // latest, popular, trending, my_topics, my_questions
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [userRoadmaps, setUserRoadmaps] = useState<any[]>([]);
  const [showRoadmapList, setShowRoadmapList] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [roadmapsLoading, setRoadmapsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    loadCommunityData(false);
  }, [selectedFilter, selectedSkill]);

  useEffect(() => {
    if (selectedFilter === 'my_topics' && userRoadmaps.length === 0) {
      loadUserRoadmaps();
    }
  }, [selectedFilter]);

  const loadUserRoadmaps = async () => {
    try {
      setRoadmapsLoading(true);
      const roadmaps = await getUserRoadmaps();
      setUserRoadmaps(roadmaps);
    } catch (error) {
    } finally {
      setRoadmapsLoading(false);
    }
  };

  const loadCommunityData = async (isLoadMore: boolean = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      }
      
      const currentOffset = isLoadMore ? offset : 0;
      
      const [communityStats, communityPosts] = await Promise.all([
        getCommunityStats(),
        getCommunityPosts(20, currentOffset, undefined, selectedFilter, selectedSkill || undefined)
      ]);
      
      
      setStats(communityStats);
      
      if (isLoadMore) {
        // Yeni gönderileri mevcut listeye ekle
        setPosts(prevPosts => [...prevPosts, ...communityPosts]);
        setOffset(currentOffset + 20);
      } else {
        // İlk yükleme - listeyi değiştir
        setPosts(communityPosts);
        setOffset(20);
      }
      
      // Daha fazla gönderi var mı kontrol et
      setHasMore(communityPosts.length === 20);
      
    } catch (error) {
              Alert.alert('Error', 'An error occurred while loading community data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCommunityData(false);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      loadCommunityData(true);
    }
  };

  const handleLikePost = async (postId: number) => {
    try {
      await likePost(postId);
      // Refresh posts to get updated like count
      setOffset(0);
      setHasMore(true);
      loadCommunityData(false);
    } catch (error) {
              Alert.alert('Error', 'Like operation failed');
    }
  };

  const handleShowComments = async (post: CommunityPost) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    setNewComment('');
    
    try {
      const postComments = await getPostComments(post.id);
      setComments(postComments);
    } catch (error) {
              Alert.alert('Error', 'An error occurred while loading comments');
    }
  };

  const handleAddComment = async () => {
    if (!selectedPost || !newComment.trim()) return;
    
    setCommentLoading(true);
    try {
      await createComment(selectedPost.id, { content: newComment.trim() });
      setNewComment('');
      
      // Refresh comments
      const postComments = await getPostComments(selectedPost.id);
      setComments(postComments);
      
      // Refresh posts to update reply count
      setOffset(0);
      setHasMore(true);
      loadCommunityData(false);
    } catch (error) {
              Alert.alert('Error', 'An error occurred while adding comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const renderPost = ({ item }: { item: CommunityPost }) => (
    <TouchableOpacity style={styles.postCard}>
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
      
      {item.skill_name && (
        <View style={styles.skillTag}>
          <Ionicons name="code" size={14} color="#3b82f6" />
          <Text style={styles.skillText}>{item.skill_name}</Text>
        </View>
      )}
      
      <View style={styles.postStats}>
        <TouchableOpacity 
          style={styles.statItem}
          onPress={() => handleLikePost(item.id)}
        >
          <Ionicons name="heart-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.likes_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.statItem}
          onPress={() => handleShowComments(item)}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.replies_count}</Text>
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Ionicons name="eye-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.views_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getTypeColor = (type?: string) => {
    switch (type || 'question') {
      case 'question': return '#3b82f6';
      case 'discussion': return '#10b981';
      case 'tip': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type || 'question') {
              case 'question': return 'Question';
      case 'discussion': return 'Discussion';
      case 'tip': return 'Tip';
              default: return 'General';
    }
  };

  const handleCreatePost = () => {
    navigation.navigate('CreatePost');
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreatePost}>
          <Ionicons name="add-circle" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Quick Access Cards */}
      <View style={styles.quickAccessContainer}>
        <View style={styles.quickCardsGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={() => setSelectedFilter('my_questions')}>
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.quickCardGradient}>
              <Ionicons name="chatbubbles" size={28} color="#ffffff" />
              <Text style={styles.quickCardTitle}>My Questions</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickCard} onPress={() => setSelectedFilter('my_topics')}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.quickCardGradient}>
              <Ionicons name="book" size={28} color="#ffffff" />
              <Text style={styles.quickCardTitle}>My Topics</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickCard} onPress={() => setSelectedFilter('trending')}>
            <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.quickCardGradient}>
              <Ionicons name="trending-up" size={28} color="#ffffff" />
              <Text style={styles.quickCardTitle}>Trend</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickCard} onPress={() => setSelectedFilter('popular')}>
            <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.quickCardGradient}>
              <Ionicons name="star" size={28} color="#ffffff" />
              <Text style={styles.quickCardTitle}>Popular</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'latest' && styles.activeFilterTab]}
            onPress={() => setSelectedFilter('latest')}
          >
            <Text style={[styles.filterText, selectedFilter === 'latest' && styles.activeFilterText]}>
              Latest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'popular' && styles.activeFilterTab]}
            onPress={() => setSelectedFilter('popular')}
          >
            <Text style={[styles.filterText, selectedFilter === 'popular' && styles.activeFilterText]}>
              Popular
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'trending' && styles.activeFilterTab]}
            onPress={() => setSelectedFilter('trending')}
          >
            <Text style={[styles.filterText, selectedFilter === 'trending' && styles.activeFilterText]}>
              Trend
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'my_topics' && styles.activeFilterTab]}
            onPress={() => setSelectedFilter('my_topics')}
          >
            <Text style={[styles.filterText, selectedFilter === 'my_topics' && styles.activeFilterText]}>
              My Topics
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'my_questions' && styles.activeFilterTab]}
            onPress={() => setSelectedFilter('my_questions')}
          >
            <Text style={[styles.filterText, selectedFilter === 'my_questions' && styles.activeFilterText]}>
              My Questions
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Selected Skill Header */}
      {selectedSkill && (
        <View style={styles.selectedSkillHeader}>
          <View style={styles.selectedSkillContent}>
            <Ionicons name="code" size={20} color="#3b82f6" />
            <Text style={styles.selectedSkillText}>
              Showing {selectedSkill} topic
            </Text>
            <TouchableOpacity 
              style={styles.clearFilterButton}
              onPress={() => {
                setSelectedSkill(null);
                setSelectedFilter('latest');
                setOffset(0);
                setHasMore(true);
                setTimeout(() => {
                  loadCommunityData(false);
                }, 100);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      )}


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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingMoreText}>Loading more posts...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          selectedFilter === 'my_topics' ? (
            <View style={styles.emptyContainer}>
              <LinearGradient colors={['#f8fafc', '#e2e8f0']} style={styles.emptyGradient}>
                <Ionicons name="book-outline" size={80} color="#10b981" />
                <Text style={styles.emptyTitle}>Choose Your Topics 📚</Text>
                <Text style={styles.emptyDescription}>
                  Which topic would you like to see posts about? 
                  Select one of your roadmaps.
                </Text>
                {userRoadmaps.length > 0 ? (
                  <View style={styles.roadmapList}>
                    {userRoadmaps.map((roadmap, index) => {
                      // Skill ismini roadmap title'ından çıkar
                      const skillName = roadmap.title.split(' ')[0] || roadmap.title;
                      return (
                        <TouchableOpacity 
                          key={roadmap.id} 
                          style={styles.roadmapItem}
                          onPress={() => {
                            setSelectedSkill(skillName);
                            setSelectedFilter('latest');
                            setOffset(0);
                            setHasMore(true);
                            // Hemen yükle
                            setTimeout(() => {
                              loadCommunityData(false);
                            }, 100);
                          }}
                        >
                          <Ionicons name="bookmark" size={20} color="#10b981" />
                          <View style={{flex: 1, marginLeft: 12}}>
                            <Text style={{fontSize: 16, fontWeight: '600', color: '#1f2937'}}>
                              {skillName}
                            </Text>
                            <Text style={{fontSize: 12, color: '#6b7280', marginTop: 2}}>
                              {roadmap.title}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : roadmapsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Loading your topics...</Text>
                  </View>
                ) : (
                  <View style={styles.emptyActions}>
                    <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('RoadmapGeneration' as any)}>
                      <Ionicons name="add-circle" size={20} color="#ffffff" />
                      <Text style={styles.emptyButtonText}>Create Your First Roadmap</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <LinearGradient colors={['#f8fafc', '#e2e8f0']} style={styles.emptyGradient}>
                <Ionicons name="rocket-outline" size={80} color="#3b82f6" />
                <Text style={styles.emptyTitle}>Community is Just Starting! 🚀</Text>
                <Text style={styles.emptyDescription}>
                  Be the first to post and start the community! Ask questions, share your experiences, 
                  connect with other learners.
                </Text>
                <View style={styles.emptyActions}>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePost}>
                    <Ionicons name="add-circle" size={20} color="#ffffff" />
                    <Text style={styles.emptyButtonText}>Make First Post</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )
        }
      />

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
              <Ionicons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={styles.placeholder} />
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{item.user_name}</Text>
                  <Text style={styles.commentDate}>
                    {new Date(item.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
              </View>
            )}
            style={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                        <Text style={styles.emptyCommentsText}>No comments yet</Text>
        <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
              </View>
            }
          />

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
                                placeholder="Write your comment..."
              placeholderTextColor="#9ca3af"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newComment.trim() || commentLoading) && styles.sendButtonDisabled]}
              onPress={handleAddComment}
              disabled={!newComment.trim() || commentLoading}
            >
              {commentLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="send" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
  emptyGradient: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    marginHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySecondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  emptySecondaryButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  activeFilterTab: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeFilterText: {
    color: '#fff',
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  skillText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  commentsList: {
    flex: 1,
    marginBottom: 15,
  },
  commentItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  commentDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  commentContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
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
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.7,
  },
  statsGradient: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  quickAccessContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  quickCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickCard: {
    width: '48%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  quickCardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  quickCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  roadmapList: {
    width: '100%',
    marginTop: 20,
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  roadmapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  roadmapInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roadmapSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  selectedSkillHeader: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  selectedSkillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedSkillText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginLeft: 8,
    flex: 1,
  },
  clearFilterButton: {
    padding: 5,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingMoreText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 14,
  },
}); 