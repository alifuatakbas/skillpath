import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import {
  TokenManager,
  login,
  register,
  logout,
  suggestSkill,
  generateAssessment,
  generateRoadmap,
} from '../services/api';
import {
  User,
  UserLogin,
  UserCreate,
  SkillSuggestionResponse,
} from '../types';
import { Ionicons } from '@expo/vector-icons';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showSkillInput, setShowSkillInput] = useState(false);
  const [error, setError] = useState('');
  
  // Auth form states
  const [loginForm, setLoginForm] = useState<UserLogin>({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<UserCreate>({ 
    name: '', 
    email: '', 
    password: '' 
  });
  
  // Skill states
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestionResponse | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const testApiConnection = async () => {
    try {
      setError('');
      console.log('Testing API connection...');
      
      // Test health endpoint
      const healthResponse = await fetch('http://192.168.1.133:8000/api/health');
      const healthData = await healthResponse.json();
      console.log('Health API Test Success:', healthData);
      
      // Test skill suggestion
      const skillResponse = await suggestSkill({
        user_input: 'Python programming',
        language: 'tr',
      });
      console.log('Skill API Test Success:', skillResponse);
      
      // Test assessment
      const assessmentResponse = await generateAssessment({
        skill_name: 'Python',
        language: 'tr',
      });
      console.log('Assessment API Test Success:', assessmentResponse);
      
      // Test roadmap generation (with correct POST body)
      const roadmapResponse = await generateRoadmap({
        skill_name: 'Python',
        target_weeks: 8,
        current_level: 'beginner',
        daily_hours: 2,
      });
      console.log('Roadmap API Test Success:', roadmapResponse);
      
      Alert.alert('🎉 Tüm API Testleri Başarılı!', 
        `✅ Health: ${healthData.service}\n✅ Skill Suggestions: OK\n✅ Assessment: ${assessmentResponse.questions.length} soru\n✅ Roadmap: ${roadmapResponse.roadmap.steps.length} adım`
      );
      
    } catch (error: any) {
      console.error('API Test Failed:', error);
      Alert.alert('❌ API Test Hatası', error.message || 'Backend bağlantısı başarısız');
    }
  };

  const checkAuthStatus = async () => {
    try {
      const isAuth = await TokenManager.isAuthenticated();
      const userData = await TokenManager.getUser();
      
      setIsLoggedIn(isAuth);
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await login(loginForm);
      setUser(response.user);
      setIsLoggedIn(true);
      setShowAuthModal(false);
      setLoginForm({ email: '', password: '' });
      Alert.alert('Başarılı', 'Giriş başarılı!');
    } catch (error: any) {
      setError(error.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await register(registerForm);
      setUser(response.user);
      setIsLoggedIn(true);
      setShowAuthModal(false);
      setRegisterForm({ name: '', email: '', password: '' });
      Alert.alert('Başarılı', 'Kayıt başarılı!');
    } catch (error: any) {
      setError(error.message || 'Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsLoggedIn(false);
      setUser(null);
      setShowSkillInput(false);
      Alert.alert('Başarılı', 'Çıkış yapıldı');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSkillSuggestion = async () => {
    if (!skillInput.trim()) return;

    setSkillLoading(true);
    setError('');

    try {
      const suggestion = await suggestSkill({
        user_input: skillInput,
        language: 'tr',
      });
      setSkillSuggestions(suggestion);
    } catch (error: any) {
      setError(error.message || 'Skill önerisi alınamadı');
    } finally {
      setSkillLoading(false);
    }
  };

  const handleStartLearning = () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    setShowSkillInput(true);
  };

  const handleStartAssessment = () => {
    if (!skillSuggestions) return;
    
    navigation.navigate('Assessment', {
      skillName: skillSuggestions.normalized_name,
    });
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(price);
  };

  const getLevelColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'başlangıç':
        return '#10b981';
      case 'orta':
        return '#f59e0b';
      case 'ileri':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#3b82f6', '#8b5cf6']}
              style={styles.logoGradient}
            >
              <Text style={styles.logoText}>S</Text>
            </LinearGradient>
            <Text style={styles.brandText}>SkillPath</Text>
          </View>
          
          <View style={styles.headerActions}>
            {isLoggedIn ? (
              <View style={styles.userInfo}>
                <Text style={styles.userName}>Merhaba, {user?.name}</Text>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                  <Text style={styles.logoutText}>Çıkış</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                onPress={() => setShowAuthModal(true)}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Giriş Yap</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Hero Section */}
        <LinearGradient
          colors={['#f1f5f9', '#e0f2fe']}
          style={styles.heroSection}
        >
          <Text style={styles.heroTitle}>
            Yeteneklerinizi{'\n'}
            <Text style={styles.heroGradientText}>Geliştirin</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            AI destekli kişiselleştirilmiş öğrenme yol haritaları ile hedeflerinize ulaşın
          </Text>
          
          <View style={styles.heroButtons}>
            <TouchableOpacity onPress={testApiConnection} style={styles.testApiButton}>
              <Text style={styles.testApiButtonText}>API Test</Text>
            </TouchableOpacity>
          </View>
          
          {!showSkillInput ? (
            <TouchableOpacity onPress={handleStartLearning} style={styles.heroCTA}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>Öğrenmeye Başla</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.skillInputContainer}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.skillInput}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder="Hangi beceriyi öğrenmek istiyorsunuz?"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  onPress={handleSkillSuggestion}
                  disabled={skillLoading || !skillInput.trim()}
                  style={[styles.searchButton, (!skillInput.trim() || skillLoading) && styles.searchButtonDisabled]}
                >
                  <Text style={styles.searchButtonText}>
                    {skillLoading ? '...' : 'Ara'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {skillSuggestions && (
                <View style={styles.suggestionCard}>
                  <Text style={styles.suggestionTitle}>AI Önerisi:</Text>
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionItem}>
                      <Text style={styles.suggestionLabel}>Beceri:</Text> {skillSuggestions.normalized_name}
                    </Text>
                    <Text style={styles.suggestionItem}>
                      <Text style={styles.suggestionLabel}>Kategori:</Text> {skillSuggestions.category}
                    </Text>
                    <Text style={styles.suggestionItem}>
                      <Text style={styles.suggestionLabel}>Zorluk:</Text> {skillSuggestions.difficulty}
                    </Text>
                    <Text style={styles.suggestionItem}>
                      <Text style={styles.suggestionLabel}>Tahmini süre:</Text> {skillSuggestions.estimated_weeks} hafta
                    </Text>
                    {skillSuggestions.similar_skills.length > 0 && (
                      <Text style={styles.suggestionItem}>
                        <Text style={styles.suggestionLabel}>Benzer beceriler:</Text> {skillSuggestions.similar_skills.join(', ')}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.suggestionActions}>
                    <TouchableOpacity 
                      onPress={handleStartAssessment}
                      style={styles.assessmentButton}
                    >
                      <Text style={styles.assessmentButtonText}>Değerlendirmeye Başla</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => {
                        setSkillSuggestions(null);
                        setSkillInput('');
                      }}
                      style={styles.resetButton}
                    >
                      <Text style={styles.resetButtonText}>Yeniden Ara</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('RoadmapGeneration')}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.actionGradient}>
              <Ionicons name="map-outline" size={28} color="#fff" />
              <Text style={styles.actionText}>Roadmap Oluştur</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.actionGradient}>
              <Ionicons name="analytics-outline" size={28} color="#fff" />
              <Text style={styles.actionText}>Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Auth Modal */}
      <Modal
        visible={showAuthModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAuthModal(false);
                  setError('');
                  setIsRegisterMode(false);
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => setIsRegisterMode(false)}
                style={[styles.tab, !isRegisterMode && styles.activeTab]}
              >
                <Text style={[styles.tabText, !isRegisterMode && styles.activeTabText]}>
                  Giriş Yap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsRegisterMode(true)}
                style={[styles.tab, isRegisterMode && styles.activeTab]}
              >
                <Text style={[styles.tabText, isRegisterMode && styles.activeTabText]}>
                  Kayıt Ol
                </Text>
              </TouchableOpacity>
            </View>

            {!isRegisterMode ? (
              <View style={styles.formContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="E-posta"
                  value={loginForm.email}
                  onChangeText={(text) => setLoginForm({ ...loginForm, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Şifre"
                  value={loginForm.password}
                  onChangeText={(text) => setLoginForm({ ...loginForm, password: text })}
                  secureTextEntry
                />
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ad Soyad"
                  value={registerForm.name}
                  onChangeText={(text) => setRegisterForm({ ...registerForm, name: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="E-posta"
                  value={registerForm.email}
                  onChangeText={(text) => setRegisterForm({ ...registerForm, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Şifre"
                  value={registerForm.password}
                  onChangeText={(text) => setRegisterForm({ ...registerForm, password: text })}
                  secureTextEntry
                />
                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={loading}
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoGradient: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: 12,
    color: '#6b7280',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 16,
  },
  heroGradientText: {
    color: '#3b82f6',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  heroCTA: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  ctaText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skillInputContainer: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  skillInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  suggestionContent: {
    marginBottom: 16,
  },
  suggestionItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  suggestionLabel: {
    fontWeight: '600',
    color: '#1f2937',
  },
  suggestionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assessmentButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  assessmentButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  formContainer: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  heroButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  testApiButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  testApiButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  actionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionGradient: {
    padding: 12,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
}); 