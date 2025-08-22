import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getRoadmapProgress, completeStep, uncompleteStep } from '../services/api';
import { RoadmapProgress, StepProgress } from '../types';
import { useGamification } from '../contexts/GamificationContext';

const RoadmapDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { roadmapId } = route.params;
  const [roadmapData, setRoadmapData] = useState<RoadmapProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const { addXp, recordActivity } = useGamification();

  const loadRoadmapData = async () => {
    try {
      const data = await getRoadmapProgress(roadmapId);
      setRoadmapData(data);
    } catch (error) {
              Alert.alert('Error', 'Could not load roadmap details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoadmapData();
  }, [roadmapId]);

  const toggleStepCompletion = async (step: StepProgress) => {
    try {
      if (step.is_completed) {
        await uncompleteStep(roadmapId, step.step_id);
      } else {
        await completeStep(roadmapId, step.step_id);
        
        // XP kazan
        await addXp(25, `"${step.title}" adımını tamamladın!`);
        await recordActivity();
      }
      
      // Reload data
      await loadRoadmapData();
    } catch (error) {
              Alert.alert('Error', 'Could not update step status');
    }
  };

  const openResource = (url: string) => {
    if (url.startsWith('http')) {
      Linking.openURL(url);
    } else {
      Alert.alert('Kaynak', url);
    }
  };

  const StepCard = ({ step, index }: { step: StepProgress; index: number }) => (
    <View style={[styles.stepCard, step.is_completed && styles.completedStepCard]}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stepInfo}>
          <Text style={[styles.stepTitle, step.is_completed && styles.completedText]}>
            {step.title}
          </Text>
          <Text style={styles.stepHours}>{step.estimated_hours} saat</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkButton, step.is_completed && styles.checkedButton]}
          onPress={() => toggleStepCompletion(step)}
        >
          <Ionicons
            name={step.is_completed ? "checkmark" : "ellipse-outline"}
            size={24}
            color={step.is_completed ? "#fff" : "#666"}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.stepDescription, step.is_completed && styles.completedText]}>
        {step.description}
      </Text>

      {step.resources.length > 0 && (
        <View style={styles.resourcesContainer}>
          <Text style={styles.resourcesTitle}>📚 Kaynaklar:</Text>
          {step.resources.map((resource, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.resourceItem}
              onPress={() => openResource(resource)}
            >
              <Ionicons name="link-outline" size={16} color="#2196F3" />
              <Text style={styles.resourceText}>{resource}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step.projects.length > 0 && (
        <View style={styles.projectsContainer}>
          <Text style={styles.projectsTitle}>🚀 Projeler:</Text>
          {step.projects.map((project, idx) => (
            <View key={idx} style={styles.projectItem}>
              <Ionicons name="code-outline" size={16} color="#FF9800" />
              <Text style={styles.projectText}>{project}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading roadmap...</Text>
      </View>
    );
  }

  if (!roadmapData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Roadmap not found</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{roadmapData.title}</Text>
        </View>

        {/* Progress Summary */}
        <View style={styles.progressSummary}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressValue}>
              {roadmapData.completed_steps}/{roadmapData.total_steps} steps
            </Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${roadmapData.completion_percentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressPercentage}>
              %{roadmapData.completion_percentage}
            </Text>
          </View>
        </View>

        {/* Next Step Highlight */}
        {roadmapData.next_step && (
          <View style={styles.nextStepContainer}>
            <Text style={styles.nextStepTitle}>🎯 Next Step</Text>
            <Text style={styles.nextStepText}>{roadmapData.next_step.title}</Text>
          </View>
        )}

        {/* Steps List */}
        <View style={styles.stepsContainer}>
                      <Text style={styles.stepsTitle}>Steps</Text>
          {roadmapData.steps.map((step, index) => (
            <StepCard key={step.step_id} step={step} index={index} />
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  progressSummary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    minWidth: 40,
  },
  nextStepContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  nextStepTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
  },
  nextStepText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  stepsContainer: {
    marginBottom: 30,
  },
  stepsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  completedStepCard: {
    backgroundColor: '#f8f9fa',
    opacity: 0.8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  stepHours: {
    fontSize: 12,
    color: '#666',
  },
  checkButton: {
    padding: 4,
  },
  checkedButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  resourcesContainer: {
    marginBottom: 12,
  },
  resourcesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resourceText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    textDecorationLine: 'underline',
  },
  projectsContainer: {
    marginBottom: 12,
  },
  projectsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  projectText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default RoadmapDetailScreen; 