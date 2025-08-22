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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { usePremium } from '../contexts/PremiumContext';
import { useGamification } from '../contexts/GamificationContext';
import { subscriptionService } from '../services/subscriptionService';
import {
  TokenManager,
  login,
  register,
  logout,
  suggestSkill,
  generateAssessment,
  generateRoadmap,
  getOwnProfile,
  socialLogin,
  // Daily task import'ları kaldırıldı
} from '../services/api';
import {
  User,
  UserLogin,
  UserCreate,
  SkillSuggestionResponse,
  UserProfile,
  // DailyTask type kaldırıldı
} from '../types';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showSkillInput, setShowSkillInput] = useState(false);
  const [error, setError] = useState('');
  
  // Premium hooks - simplified
  const { isPremium, refreshSubscription } = usePremium();
  const { gamificationData } = useGamification();
  
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



  // Sosyal medya giriş fonksiyonları


  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Apple Sign-In servisini kullan
      const { signInWithApple } = await import('../services/socialAuthService');
      const result = await signInWithApple();
      
      if (result.success) {
        setUser(result.user);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        refreshSubscription();
      } else {
        setError(result.error || 'Apple sign-in failed');
      }
    } catch (error) {
              setError('Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    checkAuthStatus();
  }, []);

  const loadProfile = async () => {
    if (!isLoggedIn) return;
    
    try {
      const userProfile = await getOwnProfile();
      setProfile(userProfile);
    } catch (error) {
    }
  };



  useEffect(() => {
    if (isLoggedIn) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [isLoggedIn]);


  const checkAuthStatus = async () => {
    try {
      const isAuth = await TokenManager.isAuthenticated();
      
      if (isAuth) {
        // Token varsa user data'yı da al
        const userData = await TokenManager.getUser();
        
        if (userData) {
          // User data varsa otomatik login yap
          setIsLoggedIn(true);
          setUser(userData);
          
          // Premium status'u da refresh et
          await refreshSubscription();
        } else {
          // Token var ama user data yok - backend'den al
          try {
            // Backend'den current user bilgilerini al
            const response = await fetch('http://192.168.1.133:8000/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${await TokenManager.getToken()}`
              }
            });
            
            if (response.ok) {
              const currentUser = await response.json();
              await TokenManager.setUser(currentUser);
              setIsLoggedIn(true);
              setUser(currentUser);
              await refreshSubscription();
            } else {
              // Token geçersiz, temizle
              await TokenManager.removeToken();
              setIsLoggedIn(false);
              setUser(null);
            }
          } catch (error) {
            // Backend bağlantısı yoksa mevcut durumu koru
            setIsLoggedIn(false);
            setUser(null);
          }
        }
      } else {
        // Token yok
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch (error) {
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setError('Please fill in all fields');
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
      
      // Premium context'i refresh et
      await refreshSubscription();
      
      Alert.alert('Success', 'Login successful!');
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      setError('Please fill in all fields');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Password must be at least 6 characters');
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
      
      // Premium context'i refresh et
      await refreshSubscription();
      
      Alert.alert('Success', 'Registration successful!');
    } catch (error: any) {
      setError(error.message || 'Registration failed');
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
      Alert.alert('Success', 'Logged out successfully');
    } catch (error) {
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
      setError(error.message || 'Could not get skill suggestion');
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
    setSkillInput('');
    setSkillSuggestions(null);
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
            <Image 
              source={require('../../assets/Skillpath.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>SkillPath</Text>
          </View>
          
          <View style={styles.headerActions}>
            {isLoggedIn ? (
              <View style={styles.userSection}>
                <View style={styles.welcomeContainer}>
                  <Text style={styles.welcomeText}>
                    {isPremium ? 'Hello,' : 'Hello,'}
                  </Text>
                  <Text style={styles.userName}>{user?.name}</Text>
                  {!isPremium && (
                    <Text style={styles.freeUserText}>Free User</Text>
                  )}
                </View>
                
                <View style={styles.userActions}>
                  {isPremium ? (
                    <View style={styles.premiumBadgeNew}>
                      <LinearGradient
                        colors={['#fbbf24', '#f59e0b']}
                        style={styles.premiumGradient}
                      >
                        <Ionicons name="diamond" size={14} color="#fff" />
                        <Text style={styles.premiumTextNew}>Premium</Text>
                      </LinearGradient>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.upgradeButtonNew}
                      onPress={() => navigation.navigate('Paywall', {})}
                    >
                      <LinearGradient
                        colors={['#f59e0b', '#d97706']}
                        style={styles.upgradeGradient}
                      >
                        <Ionicons name="diamond-outline" size={14} color="#fff" />
                        <Text style={styles.upgradeTextNew}>Get Premium</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity style={styles.logoutButtonNew} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowAuthModal(true)}
                style={styles.loginButtonNew}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  style={styles.loginGradient}
                >
                  <Ionicons name="person" size={14} color="#fff" />
                  <Text style={styles.loginButtonTextNew}>Login</Text>
                </LinearGradient>
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
            Improve Your{'\n'}
            <Text style={styles.heroGradientText}>Skills</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Achieve your goals with AI-powered personalized learning roadmaps
          </Text>
          </LinearGradient>

        {/* Profile Card */}
        {isLoggedIn && profile && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionTitle}>👤 My Profile</Text>
            <View style={styles.profileCard}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
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
                    <Text style={styles.profileLevel}>
                      Level {profile.gamification.current_level} • {profile.gamification.level_name}
                    </Text>
                    {profile.subscription_type === 'premium' && (
                      <View style={styles.premiumBadgeProfile}>
                        <Text style={styles.premiumTextProfile}>👑 Premium</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.profileStats}>
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
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatValue}>{profile.total_roadmaps}</Text>
                    <Text style={styles.profileStatLabel}>Roadmap</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={() => navigation.navigate('Profile', {})}
                >
                  <Text style={styles.viewProfileText}>View Profile</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        )}



        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (isLoggedIn) {
                // RoadmapGeneration screen'ine git
                navigation.navigate('RoadmapGeneration');
              } else {
                Alert.alert('Login Required', 'Please login first to create a roadmap.');
              }
            }}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.actionGradient}>
              <Ionicons name="map-outline" size={26} color="#fff" />
              <Text style={styles.actionText}>
                Generate Roadmap
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.actionGradient}>
              <Ionicons name="analytics-outline" size={26} color="#fff" />
              <Text style={styles.actionText}>Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Community')}
          >
            <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.actionGradient}>
              <Ionicons name="people-outline" size={26} color="#fff" />
              <Text style={styles.actionText}>Community</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile', {})}
          >
            <LinearGradient colors={['#ff9a9e', '#fecfef']} style={styles.actionGradient}>
              <Ionicons name="person-circle-outline" size={26} color="#fff" />
              <Text style={styles.actionText}>Profile</Text>
              {isLoggedIn && (
                                  <Text style={styles.profileStatText}>
                    Level {gamificationData.currentLevel} • {gamificationData.currentStreak}🔥
                  </Text>
              )}
            </LinearGradient>
                    </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Pomodoro')}
          >
            <LinearGradient colors={['#ff6b6b', '#ee5a52']} style={styles.actionGradient}>
              <Ionicons name="timer-outline" size={26} color="#fff" />
              <Text style={styles.actionText}>Pomodoro</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Calendar')}
          >
            <LinearGradient colors={['#10b981', '#059669']} style={styles.actionGradient}>
              <Ionicons name="calendar-outline" size={26} color="#fff" />
              <Text style={styles.actionText}>Calendar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Daily Study Time Card */}
        {isLoggedIn && (
          <View style={styles.dailyStudySection}>
            <View style={styles.dailyStudyCard}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.dailyStudyGradient}>
                <View style={styles.dailyStudyHeader}>
                  <Ionicons name="time" size={24} color="#fff" />
                  <Text style={styles.dailyStudyTitle}>Today's Study</Text>
                </View>
                <View style={styles.dailyStudyStats}>
                  <View style={styles.dailyStudyStat}>
                    <Text style={styles.dailyStudyValue}>
                      {Math.floor(gamificationData.totalStudyMinutes / 60)}
                    </Text>
                    <Text style={styles.dailyStudyLabel}>Hours</Text>
                  </View>
                  <View style={styles.dailyStudyStat}>
                    <Text style={styles.dailyStudyValue}>
                      {gamificationData.totalStudyMinutes % 60}
                    </Text>
                    <Text style={styles.dailyStudyLabel}>Minutes</Text>
                  </View>
                  <View style={styles.dailyStudyStat}>
                    <Text style={styles.dailyStudyValue}>
                      {Math.floor(gamificationData.totalStudyMinutes / 25)}
                    </Text>
                    <Text style={styles.dailyStudyLabel}>Pomodoro</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>
        )}
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
                  {isRegisterMode ? 'Register' : 'Login'}
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
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsRegisterMode(true)}
                style={[styles.tab, isRegisterMode && styles.activeTab]}
              >
                <Text style={[styles.tabText, isRegisterMode && styles.activeTabText]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {!isRegisterMode ? (
              <View style={styles.formContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={loginForm.email}
                  onChangeText={(text) => setLoginForm({ ...loginForm, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
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
                    {loading ? 'Logging in...' : 'Login'}
                  </Text>
                </TouchableOpacity>

                {/* Sosyal Medya Giriş Bölümü */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>



                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  disabled={loading}
                  style={[styles.socialButton, styles.appleButton]}
                >
                  <View style={styles.socialButtonContent}>
                    <Ionicons name="logo-apple" size={20} color="white" />
                    <Text style={[styles.socialButtonText, styles.appleButtonText]}>Sign in with Apple</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={registerForm.name}
                  onChangeText={(text) => setRegisterForm({ ...registerForm, name: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={registerForm.email}
                  onChangeText={(text) => setRegisterForm({ ...registerForm, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
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
                    {loading ? 'Registering...' : 'Register'}
                  </Text>
                </TouchableOpacity>

                {/* Sosyal Medya Giriş Bölümü */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>



                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  disabled={loading}
                  style={[styles.socialButton, styles.appleButton]}
                >
                  <View style={styles.socialButtonContent}>
                    <Ionicons name="logo-apple" size={20} color="white" />
                    <Text style={[styles.socialButtonText, styles.appleButtonText]}>Sign up with Apple</Text>
                  </View>
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
  logoImage: {
    width: 32,
    height: 32,
    marginRight: 8,
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
  // Yeni modern header tasarımı
  userSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  welcomeContainer: {
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  userName: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  freeUserText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumBadgeNew: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#fbbf24',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  premiumGradient: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  premiumTextNew: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  upgradeButtonNew: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  upgradeGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  upgradeTextNew: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logoutButtonNew: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loginButtonNew: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loginButtonTextNew: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Eski stiller (geriye dönük uyumluluk için)
  userInfo: {
    alignItems: 'flex-end',
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  logoutButton: {
    marginTop: 4,
  },
  logoutText: {
    color: '#6b7280',
    fontSize: 12,
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
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginBottom: 12,
    minHeight: 100,
  },
  actionGradient: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 6,
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  closeInputButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeInputText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  // Profile Card Styles
  profileSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  profileCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
  // Sosyal Medya Buton Stilleri
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  socialButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    color: '#ffffff',
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileLevel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  premiumBadgeProfile: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  premiumTextProfile: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  viewProfileText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginRight: 8,
  },

  // Profile card styles
  profileCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileStatText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  // Quick Stats Section
  quickStatsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickStatCard: {
    backgroundColor: 'white',
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
    fontSize: 18,
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
  // Features Section
  featuresSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    backgroundColor: 'white',
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
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  // Daily Study Section
  dailyStudySection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dailyStudyCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dailyStudyGradient: {
    padding: 20,
  },
  dailyStudyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dailyStudyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  dailyStudyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dailyStudyStat: {
    alignItems: 'center',
    flex: 1,
  },
  dailyStudyValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  dailyStudyLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
