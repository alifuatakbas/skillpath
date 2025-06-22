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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { generateAssessment, generateRoadmap } from '../services/api';
import { AssessmentQuestion, AssessmentResult } from '../types';

type AssessmentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Assessment'>;
type AssessmentScreenRouteProp = RouteProp<RootStackParamList, 'Assessment'>;

interface Props {
  navigation: AssessmentScreenNavigationProp;
  route: AssessmentScreenRouteProp;
}

export default function AssessmentScreen({ navigation, route }: Props) {
  const { skillName, targetWeeks = 12, currentLevel = 'beginner', dailyHours = 2 } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    loadAssessmentQuestions();
  }, []);

  const loadAssessmentQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await generateAssessment({
        skill_name: skillName,
        language: 'tr',
      });
      
      setQuestions(response.questions);
    } catch (error: any) {
      setError(error.message || 'Değerlendirme soruları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentQuestionAnswered()) return;

    setSubmitting(true);
    
    try {
      // Assessment sonuçlarını hazırla
      const assessmentResponses: AssessmentResult[] = questions.map((question, index) => ({
        question_id: question.id,
        question: question.question,
        selected_answer: answers[index] || '',
        correct_answer: question.correct_answer,
        is_correct: answers[index] === question.correct_answer,
      }));

      // Kullanıcı seviyesini hesapla (assessment sonuçlarına göre)
      const assessmentLevel = calculateUserLevel(assessmentResponses);
      
      console.log('Roadmap oluşturma başlıyor...');
      console.log('Skill:', skillName);
      console.log('Assessment Level:', assessmentLevel);
      console.log('Target Weeks:', targetWeeks);
      console.log('Daily Hours:', dailyHours);
      
      // Roadmap oluştur - Assessment sonuçları ve kullanıcı tercihlerine göre
      const roadmapResponse = await generateRoadmap({
        skill_name: skillName,
        target_weeks: targetWeeks,
        current_level: assessmentLevel, // Assessment sonucunu kullan
        daily_hours: dailyHours,
      });

      console.log('Roadmap response:', roadmapResponse);

      if (roadmapResponse.success) {
        Alert.alert(
          '🎉 Başarılı!',
          'Kişiselleştirilmiş yol haritanız başarıyla oluşturuldu!',
          [
            {
              text: 'Roadmap\'ı Gör',
              onPress: () => {
                navigation.navigate('RoadmapDetail', { 
                  roadmapId: roadmapResponse.roadmap_id 
                });
              },
            },
          ]
        );
      }
      
    } catch (error: any) {
      console.error('Roadmap oluşturma hatası:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      Alert.alert('Hata', error.message || 'Değerlendirme gönderilirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateUserLevel = (responses: AssessmentResult[]): string => {
    const correctAnswers = responses.filter(r => r.is_correct).length;
    const percentage = (correctAnswers / responses.length) * 100;
    
    if (percentage >= 80) return 'advanced';
    if (percentage >= 60) return 'intermediate';
    return 'beginner';
  };

  const getProgressPercentage = (): number => {
    return ((currentQuestionIndex + 1) / questions.length) * 100;
  };

  const isCurrentQuestionAnswered = (): boolean => {
    return answers.hasOwnProperty(currentQuestionIndex);
  };

  const currentQuestion = questions[currentQuestionIndex];

  // Güvenlik kontrolü - currentQuestion undefined olabilir
  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Soru yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Değerlendirme soruları hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Hata</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadAssessmentQuestions} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Soru Bulunamadı</Text>
          <Text style={styles.errorText}>Bu beceri için değerlendirme soruları bulunamadı.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Text style={styles.headerBackText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{skillName} Değerlendirmesi</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentQuestionIndex + 1} / {questions.length}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionNumber}>Soru {currentQuestionIndex + 1}</Text>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        {/* Answer Options */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = answers[currentQuestionIndex] === option;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleAnswerSelect(option)}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected
                ]}
              >
                <View style={[
                  styles.optionRadio,
                  isSelected && styles.optionRadioSelected
                ]}>
                  {isSelected && <View style={styles.optionRadioInner} />}
                </View>
                <Text style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          onPress={handlePrevious}
          disabled={currentQuestionIndex === 0}
          style={[
            styles.navButton,
            styles.prevButton,
            currentQuestionIndex === 0 && styles.navButtonDisabled
          ]}
        >
          <Text style={[
            styles.navButtonText,
            currentQuestionIndex === 0 && styles.navButtonTextDisabled
          ]}>
            Önceki
          </Text>
        </TouchableOpacity>

        {currentQuestionIndex === questions.length - 1 ? (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isCurrentQuestionAnswered() || submitting}
            style={[
              styles.navButton,
              styles.submitButton,
              (!isCurrentQuestionAnswered() || submitting) && styles.navButtonDisabled
            ]}
          >
            <Text style={[
              styles.submitButtonText,
              (!isCurrentQuestionAnswered() || submitting) && styles.navButtonTextDisabled
            ]}>
              {submitting ? 'Gönderiliyor...' : 'Tamamla'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            disabled={!isCurrentQuestionAnswered()}
            style={[
              styles.navButton,
              styles.nextButton,
              !isCurrentQuestionAnswered() && styles.navButtonDisabled
            ]}
          >
            <Text style={[
              styles.navButtonText,
              !isCurrentQuestionAnswered() && styles.navButtonTextDisabled
            ]}>
              Sonraki
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  headerBackButton: {
    paddingVertical: 4,
  },
  headerBackText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  questionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  questionNumber: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 20,
    color: '#1f2937',
    fontWeight: '600',
    lineHeight: 28,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  optionButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    borderColor: '#3b82f6',
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  optionTextSelected: {
    color: '#1f2937',
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  prevButton: {
    backgroundColor: '#f3f4f6',
  },
  nextButton: {
    backgroundColor: '#3b82f6',
  },
  submitButton: {
    backgroundColor: '#10b981',
  },
  navButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  navButtonTextDisabled: {
    color: '#9ca3af',
  },
}); 