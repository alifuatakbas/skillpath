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
import { getRoadmap } from '../services/api';
import { RoadmapData, RoadmapStep } from '../types';

type RoadmapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Roadmap'>;
type RoadmapScreenRouteProp = RouteProp<RootStackParamList, 'Roadmap'>;

interface Props {
  navigation: RoadmapScreenNavigationProp;
  route: RoadmapScreenRouteProp;
}

export default function RoadmapScreen({ navigation, route }: Props) {
  const { roadmapId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadRoadmap();
  }, []);

  const loadRoadmap = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await getRoadmap(roadmapId);
      setRoadmap(response.roadmap);
    } catch (error: any) {
              setError(error.message || 'Could not load roadmap');
    } finally {
      setLoading(false);
    }
  };

  const toggleStepCompletion = (stepOrder: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepOrder)) {
        newSet.delete(stepOrder);
      } else {
        newSet.add(stepOrder);
      }
      return newSet;
    });
  };

  const getProgressPercentage = (): number => {
    if (!roadmap) return 0;
    return (completedSteps.size / roadmap.steps.length) * 100;
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
      case 'başlangıç':
        return '#10b981';
      case 'intermediate':
      case 'orta':
        return '#f59e0b';
      case 'advanced':
      case 'ileri':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading roadmap...</Text>
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
          <TouchableOpacity onPress={loadRoadmap} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!roadmap) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Roadmap Not Found</Text>
          <Text style={styles.errorText}>The requested roadmap could not be found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = completedSteps.size === roadmap.steps.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Learning Roadmap</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Roadmap Info */}
        <LinearGradient
          colors={['#f1f5f9', '#e0f2fe']}
          style={styles.infoSection}
        >
          <Text style={styles.roadmapTitle}>{roadmap.title}</Text>
          <Text style={styles.roadmapDescription}>{roadmap.description}</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{roadmap.total_weeks} weeks</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Steps</Text>
              <Text style={styles.infoValue}>{roadmap.steps.length} steps</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Difficulty</Text>
              <View style={[styles.difficultyBadge, { backgroundColor: `${getDifficultyColor(roadmap.difficulty_level)}20` }]}>
                <Text style={[styles.difficultyText, { color: getDifficultyColor(roadmap.difficulty_level) }]}>
                  {roadmap.difficulty_level}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progress</Text>
            <Text style={styles.progressText}>
              {completedSteps.size} / {roadmap.steps.length} completed
            </Text>
          </View>
          
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]}
            />
          </View>
          
          <Text style={styles.progressPercentage}>
            %{Math.round(getProgressPercentage())} completed
          </Text>
        </View>

        {/* Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>Learning Steps</Text>
          
          {roadmap.steps.map((step, index) => (
            <View key={step.step_order} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.step_order}</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepHours}>⏱️ {step.estimated_hours} saat</Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleStepCompletion(step.step_order)}
                  style={[
                    styles.checkButton,
                    completedSteps.has(step.step_order) && styles.checkButtonCompleted
                  ]}
                >
                  <Text style={[
                    styles.checkButtonText,
                    completedSteps.has(step.step_order) && styles.checkButtonTextCompleted
                  ]}>
                    {completedSteps.has(step.step_order) ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.stepDescription}>{step.description}</Text>
              
              {step.resources.length > 0 && (
                <View style={styles.stepResources}>
                  <Text style={styles.resourcesTitle}>📚 Kaynaklar:</Text>
                  {step.resources.map((resource, resourceIndex) => (
                    <Text key={resourceIndex} style={styles.resourceItem}>
                      • {resource}
                    </Text>
                  ))}
                </View>
              )}
              
              {step.projects.length > 0 && (
                <View style={styles.stepProjects}>
                  <Text style={styles.projectsTitle}>🚀 Projeler:</Text>
                  {step.projects.map((project, projectIndex) => (
                    <Text key={projectIndex} style={styles.projectItem}>
                      • {project}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Completion Message */}
        {isCompleted && (
          <View style={styles.completionSection}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.completionCard}
            >
              <Text style={styles.completionTitle}>🎉 Tebrikler!</Text>
              <Text style={styles.completionText}>
                Tüm adımları tamamladınız! Artık {roadmap.title} konusunda yetkin durumdasınız.
              </Text>
            </LinearGradient>
          </View>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  roadmapTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  roadmapDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
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
  progressPercentage: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
  },
  stepsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  stepHours: {
    fontSize: 12,
    color: '#6b7280',
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkButtonText: {
    fontSize: 16,
    color: '#d1d5db',
  },
  checkButtonTextCompleted: {
    color: 'white',
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  stepResources: {
    marginBottom: 12,
  },
  resourcesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  resourceItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    paddingLeft: 8,
  },
  stepProjects: {
    marginBottom: 8,
  },
  projectsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  projectItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    paddingLeft: 8,
  },
  completionSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  completionCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  completionText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
  },
}); 