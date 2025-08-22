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
  createCommunityPost, 
  togglePostLike,
  toggleReplyLike,
  getPostReplies,
  createReply,
  getUserRoadmaps,
  CommunityPost,
  CreatePostRequest,
  CreateReplyRequest
} from '../services/api';
import { RoadmapSummary } from '../types';

type MyCommunityScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MyCommunity'>;

interface Props {
  navigation: MyCommunityScreenNavigationProp;
}

export default function MyCommunityScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [roadmapsLoading, setRoadmapsLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostSkill, setNewPostSkill] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState<number | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [newReply, setNewReply] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    loadMyPosts();
    loadMyRoadmaps();
  }, []);

  const loadMyPosts = async () => {
    try {
      setLoading(true);
      const myPosts = await getCommunityPosts('my');
      setPosts(myPosts);
    } catch (error) {
              Alert.alert('Error', 'An error occurred while loading posts');
    } finally {
      setLoading(false);
    }
  };

  const loadMyRoadmaps = async () => {
    try {
      setRoadmapsLoading(true);
      const userRoadmaps = await getUserRoadmaps();
      setRoadmaps(userRoadmaps);
    } catch (error) {
              Alert.alert('Error', 'An error occurred while loading roadmaps');
    } finally {
      setRoadmapsLoading(false);
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
              Alert.alert('Error', 'Like operation failed');
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
              Alert.alert('Error', 'Comment like failed');
    }
  };

  const handleNewPost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
              Alert.alert('Error', 'Please fill in title and content fields');
      return;
    }

    try {
      setSubmitting(true);
      const newPostData: CreatePostRequest = {
        title: newPostTitle,
        content: newPostContent,
        skill_name: newPostSkill || undefined,
        post_type: 'question'
      };

      const newPost = await createCommunityPost(newPostData);
      setPosts([newPost, ...posts]);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostSkill('');
      setShowNewPost(false);
              Alert.alert('Success', 'Question shared!');
    } catch (error) {
              Alert.alert('Error', 'An error occurred while creating the post');
    } finally {
      setSubmitting(false);
    }
  };

  const loadReplies = async (postId: number) => {
    try {
      const postReplies = await getPostReplies(postId);
      setReplies(postReplies);
      setShowReplies(postId);
    } catch (error) {
              Alert.alert('Error', 'An error occurred while loading comments');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} weeks ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} months ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} years ago`;
  };

  const handleReply = async (postId: number) => {
    if (!newReply.trim()) {
              Alert.alert('Error', 'Please write comment content');
      return;
    }

    try {
      setReplySubmitting(true);
      const replyData: CreateReplyRequest = {
        content: newReply
      };

      const reply = await createReply(postId, replyData);
      setReplies([...replies, reply]);
      setNewReply('');
      
      // Update replies count in posts
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, replies_count: post.replies_count + 1 }
          : post
      ));
      
              Alert.alert('Success', 'Comment added!');
    } catch (error) {
              Alert.alert('Error', 'An error occurred while adding comment');
    } finally {
      setReplySubmitting(false);
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
          <Text style={styles.headerTitle}>My Community</Text>
          <TouchableOpacity
            onPress={() => setShowNewPost(!showNewPost)}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* New Post Form */}
        {showNewPost && (
          <View style={styles.newPostContainer}>
            <Text style={styles.newPostTitle}>Yeni Soru Sor</Text>
            <TextInput
              style={styles.titleInput}
                              placeholder="Question title..."
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.contentInput}
                              placeholder="Explain your question in detail..."
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.titleInput}
                              placeholder="Skill name (optional) - ex: React, Python, CSS"
              value={newPostSkill}
              onChangeText={setNewPostSkill}
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.postActions}>
              <TouchableOpacity
                onPress={() => setShowNewPost(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNewPost}
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Share</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* My Roadmaps Section */}
        <View style={styles.myRoadmapsSection}>
          <Text style={styles.sectionTitle}>Roadmap'lerim</Text>
          {roadmapsLoading ? (
            <View style={styles.roadmapLoadingContainer}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.roadmapLoadingText}>Loading roadmaps...</Text>
            </View>
          ) : roadmaps.length === 0 ? (
            <View style={styles.emptyRoadmapsContainer}>
              <Ionicons name="map-outline" size={32} color="#9ca3af" />
              <Text style={styles.emptyRoadmapsText}>You haven't created any roadmaps yet</Text>
              <TouchableOpacity 
                style={styles.createRoadmapButton}
                onPress={() => navigation.navigate('RoadmapGeneration')}
              >
                <Text style={styles.createRoadmapButtonText}>Create Your First Roadmap</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roadmapsList}>
              {roadmaps.map((roadmap, index) => {
                // Farklı gradient renkleri
                const gradientColors = [
                  ['#667eea', '#764ba2'],
                  ['#f093fb', '#f5576c'],
                  ['#4facfe', '#00f2fe'],
                  ['#43e97b', '#38f9d7'],
                  ['#fa709a', '#fee140'],
                  ['#a8edea', '#fed6e3'],
                ];
                const colors = gradientColors[index % gradientColors.length] as [string, string];
                
                return (
                  <TouchableOpacity 
                    key={roadmap.id} 
                    style={styles.roadmapCard}
                    onPress={() => navigation.navigate('RoadmapDetail', { roadmapId: roadmap.id })}
                  >
                    <LinearGradient colors={colors} style={styles.roadmapGradient}>
                      <Text style={styles.roadmapTitle} numberOfLines={2}>
                        {roadmap.title}
                      </Text>
                      <Text style={styles.roadmapProgress}>
                        %{Math.round(roadmap.completion_percentage)} completed
                      </Text>
                      <View style={styles.roadmapStats}>
                        <Text style={styles.roadmapStatsText}>
                          {roadmap.completed_steps}/{roadmap.total_steps} steps
                        </Text>
                        <Text style={styles.roadmapStatsText}>
                          {roadmap.total_weeks} hafta
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Posts */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Son Sorular</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading posts...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
                          <Text style={styles.emptyText}>You haven't asked any questions yet</Text>
            <Text style={styles.emptySubtext}>Click the + button to ask your first question</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.postInfo}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Profile', { userId: post.author_id })}
                    >
                      <Text style={[styles.postAuthor, styles.authorLink]}>{post.author_name}</Text>
                    </TouchableOpacity>
                    {post.skill_name && (
                      <View style={styles.skillBadge}>
                        <Text style={styles.skillText}>{post.skill_name}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.timeAgo}>
                    {new Date(post.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
                
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent}>{post.content}</Text>
                
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
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>
                </View>

                {/* Replies Section */}
                {showReplies === post.id && (
                  <View style={styles.repliesSection}>
                    <View style={styles.repliesDivider} />
                    
                    {/* New Reply Input */}
                    <View style={styles.newReplyContainer}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Write your comment..."
                        value={newReply}
                        onChangeText={setNewReply}
                        multiline
                        placeholderTextColor="#9ca3af"
                      />
                      <TouchableOpacity
                        onPress={() => handleReply(post.id)}
                        style={[styles.replyButton, replySubmitting && styles.replyButtonDisabled]}
                        disabled={replySubmitting}
                      >
                        {replySubmitting ? (
                          <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                          <Ionicons name="send" size={16} color="#3b82f6" />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Replies List */}
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
  addButton: {
    padding: 8,
  },
  newPostContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  newPostTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  myRoadmapsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  roadmapsList: {
    flexDirection: 'row',
  },
  roadmapCard: {
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  roadmapGradient: {
    padding: 16,
    width: 120,
    alignItems: 'center',
  },
  roadmapTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roadmapProgress: {
    color: '#f3f4f6',
    fontSize: 12,
  },
  postsSection: {
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
  postInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  authorLink: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  skillBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  skillText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '500',
  },
  timeAgo: {
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  repliesSection: {
    marginTop: 12,
  },
  repliesDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  newReplyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  replyInput: {
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
    marginBottom: 4,
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
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  replyActions: {
    flexDirection: 'row',
  },
  replyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  replyActionText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  // Roadmap loading styles
  roadmapLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  roadmapLoadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  // Empty roadmaps styles
  emptyRoadmapsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyRoadmapsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 12,
    textAlign: 'center',
  },
  createRoadmapButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  createRoadmapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Roadmap stats styles
  roadmapStats: {
    marginTop: 8,
    alignItems: 'center',
  },
  roadmapStatsText: {
    color: '#f3f4f6',
    fontSize: 10,
    opacity: 0.8,
  },
}); 