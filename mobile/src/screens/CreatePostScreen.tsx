import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { createCommunityPost } from '../services/api';

type CreatePostScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreatePost'>;

interface Props {
  navigation: CreatePostScreenNavigationProp;
}

export default function CreatePostScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [skillName, setSkillName] = useState('');
  const [postType, setPostType] = useState('question');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Hata', 'Başlık ve içerik alanları zorunludur!');
      return;
    }

    setLoading(true);
    try {
      await createCommunityPost({
        title: title.trim(),
        content: content.trim(),
        skill_name: skillName.trim() || undefined,
        post_type: postType,
      });
      
      Alert.alert(
        'Başarılı!', 
        'Gönderiniz başarıyla oluşturuldu.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Hata', 'Gönderi oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const postTypes = [
    { key: 'question', label: 'Soru', icon: 'help-circle' },
    { key: 'discussion', label: 'Tartışma', icon: 'chatbubbles' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Gönderi</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Post Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gönderi Türü</Text>
            <View style={styles.typeContainer}>
              {postTypes.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeButton,
                    postType === type.key && styles.typeButtonActive
                  ]}
                  onPress={() => setPostType(type.key)}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={20} 
                    color={postType === type.key ? '#ffffff' : '#6b7280'} 
                  />
                  <Text style={[
                    styles.typeText,
                    postType === type.key && styles.typeTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Başlık *</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Gönderinizin başlığını yazın..."
              placeholderTextColor="#9ca3af"
              maxLength={200}
            />
            <Text style={styles.charCount}>{title.length}/200</Text>
          </View>

          {/* Skill Name Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beceri/Teknoloji</Text>
            <TextInput
              style={styles.input}
              value={skillName}
              onChangeText={setSkillName}
              placeholder="Örn: React Native, Python, Java..."
              placeholderTextColor="#9ca3af"
              maxLength={100}
            />
          </View>

          {/* Content Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>İçerik *</Text>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="Gönderinizin detaylarını yazın..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{content.length}/2000</Text>
          </View>

        </ScrollView>

        {/* Submit Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.submitButton, (!title.trim() || !content.trim() || loading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!title.trim() || !content.trim() || loading}
          >
            <LinearGradient
              colors={(!title.trim() || !content.trim() || loading) ? ['#d1d5db', '#d1d5db'] : ['#3b82f6', '#2563eb']}
              style={styles.submitGradient}
            >
              {loading ? (
                <Text style={styles.submitText}>Gönderiliyor...</Text>
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#ffffff" />
                  <Text style={styles.submitText}>Gönder</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  typeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  typeTextActive: {
    color: '#ffffff',
  },
  titleInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    color: '#1f2937',
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    color: '#1f2937',
  },
  contentInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    color: '#1f2937',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
}); 