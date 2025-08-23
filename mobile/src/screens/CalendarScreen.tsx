import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGamification } from '../contexts/GamificationContext';

interface Props {
  navigation: any;
}

interface DailyGoal {
  id: string;
  title: string;
  completed: boolean;
  type: 'pomodoro' | 'streak' | 'custom';
  target: number;
  current: number;
  date: string; // YYYY-MM-DD formatında
  isCustom: boolean;
}

interface WeeklyStats {
  totalStudyDays: number;
  totalStudyHours: number;
  completedTasks: number;
  totalTasks: number;
  streakDays: number;
}

export default function CalendarScreen({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalStudyDays: 0,
    totalStudyHours: 0,
    completedTasks: 0,
    totalTasks: 0,
    streakDays: 0,
  });
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  
  const { gamificationData, addXp, recordActivity } = useGamification();

  useEffect(() => {
    loadWeeklyData();
    generateDailyGoals();
  }, [selectedDate, gamificationData]);

  const loadWeeklyData = () => {
    // Bu haftanın verilerini hesapla
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    // Gerçek verilerden hesapla
    const studyHours = Math.floor(gamificationData.totalStudyMinutes / 60);
    const studyDays = gamificationData.currentStreak;
    
    setWeeklyStats({
      totalStudyDays: studyDays,
      totalStudyHours: studyHours,
      completedTasks: gamificationData.achievements.filter(a => a.isUnlocked).length,
      totalTasks: gamificationData.achievements.length,
      streakDays: gamificationData.currentStreak,
    });
  };

  const generateDailyGoals = () => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    
    // Only user-added goals (no default goals)
    const customGoals: DailyGoal[] = [
      // User can add their own goals here
    ];
    
    setDailyGoals(customGoals);
  };

  const toggleGoal = async (goalId: string) => {
    const updatedGoals = dailyGoals.map(goal => {
      if (goal.id === goalId) {
        const newCompleted = !goal.completed;
        
        // XP kazan
        if (newCompleted) {
          addXp(10, `"${goal.title}" hedefini tamamladın!`);
        }
        
        return { ...goal, completed: newCompleted };
      }
      return goal;
    });
    
    setDailyGoals(updatedGoals);
    
    // Aktivite kaydet
    await recordActivity();
  };

  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      day: 'numeric'
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case 'pomodoro': return 'timer';
      case 'streak': return 'flame';
      case 'custom': return 'star';
      default: return 'checkmark';
    }
  };

  const getGoalColor = (type: string) => {
    switch (type) {
      case 'pomodoro': return '#ff6b6b';
      case 'streak': return '#ffd700';
      case 'custom': return '#8b5cf6';
      default: return '#4CAF50';
    }
  };

  const addCustomGoal = () => {
    if (newGoalTitle.trim() && newGoalTarget.trim()) {
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      const newGoal: DailyGoal = {
        id: `custom_${Date.now()}`,
        title: newGoalTitle.trim(),
        completed: false,
        type: 'custom',
        target: parseInt(newGoalTarget) || 1,
        current: 0,
        date: selectedDateStr,
        isCustom: true,
      };
      
      setDailyGoals(prev => [...prev, newGoal]);
      setNewGoalTitle('');
      setNewGoalTarget('');
      setShowAddGoal(false);
    }
  };

  const deleteGoal = (goalId: string) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setDailyGoals(prev => prev.filter(goal => goal.id !== goalId));
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar & Planning</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Weekly Calendar */}
        <View style={styles.calendarSection}>
          <Text style={styles.sectionTitle}>📅 This Week</Text>
          <View style={styles.weekGrid}>
            {getWeekDays().map((date, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCard,
                  isToday(date) && styles.todayCard
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[
                  styles.dayText,
                  isToday(date) && styles.todayText
                ]}>
                  {formatDate(date)}
                </Text>
                {isToday(date) && (
                  <View style={styles.todayIndicator}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Weekly Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 Weekly Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={24} color="#667eea" />
              <Text style={styles.statValue}>{weeklyStats.totalStudyDays}</Text>
              <Text style={styles.statLabel}>Study Days</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color="#4facfe" />
              <Text style={styles.statValue}>{weeklyStats.totalStudyHours}</Text>
              <Text style={styles.statLabel}>Total Hours</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.statValue}>
                {weeklyStats.completedTasks}/{weeklyStats.totalTasks}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="flame" size={24} color="#ff6b6b" />
              <Text style={styles.statValue}>{weeklyStats.streakDays}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
        </View>

        {/* Daily Goals */}
        <View style={styles.goalsSection}>
          <View style={styles.goalsHeader}>
            <Text style={styles.sectionTitle}>
              🎯 {selectedDate.toLocaleDateString('en-US', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })} Goals
            </Text>
            <TouchableOpacity
              style={styles.addGoalButton}
              onPress={() => setShowAddGoal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {dailyGoals.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={[
                styles.goalCard,
                goal.completed && styles.completedGoalCard
              ]}
              onPress={() => toggleGoal(goal.id)}
            >
              <View style={styles.goalHeader}>
                <View style={styles.goalIcon}>
                  <Ionicons 
                    name={getGoalIcon(goal.type) as any} 
                    size={20} 
                    color={goal.completed ? '#4CAF50' : getGoalColor(goal.type)} 
                  />
                </View>
                <View style={styles.goalContent}>
                  <Text style={[
                    styles.goalTitle,
                    goal.completed && styles.completedGoalTitle
                  ]}>
                    {goal.title}
                  </Text>
                  <Text style={styles.goalProgress}>
                    {goal.current}/{goal.target}
                  </Text>
                </View>
                <View style={styles.goalActions}>
                  <TouchableOpacity
                    style={[
                      styles.completeButton,
                      goal.completed && styles.completedButton
                    ]}
                    onPress={() => toggleGoal(goal.id)}
                  >
                    <Ionicons 
                      name={goal.completed ? "checkmark-circle" : "ellipse-outline"} 
                      size={24} 
                      color={goal.completed ? "#4CAF50" : "#ccc"} 
                    />
                  </TouchableOpacity>
                  {goal.isCustom && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteGoal(goal.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Progress Summary */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>📈 Progress Summary</Text>
          <View style={styles.progressCard}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.progressGradient}
            >
              <Text style={styles.progressTitle}>This Week</Text>
              <View style={styles.progressStats}>
                <View style={styles.progressStat}>
                  <Text style={styles.progressValue}>
                    {Math.floor((weeklyStats.completedTasks / weeklyStats.totalTasks) * 100)}%
                  </Text>
                  <Text style={styles.progressLabel}>Success Rate</Text>
                </View>
                <View style={styles.progressStat}>
                  <Text style={styles.progressValue}>
                    {weeklyStats.totalStudyHours}
                  </Text>
                  <Text style={styles.progressLabel}>Study Hours</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal
        visible={showAddGoal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddGoal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Goal</Text>
              <TouchableOpacity
                onPress={() => setShowAddGoal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Goal Title</Text>
              <TextInput
                style={styles.textInput}
                                  placeholder="Ex: Learn React Native"
                value={newGoalTitle}
                onChangeText={setNewGoalTitle}
              />
              
                              <Text style={styles.inputLabel}>Goal Amount</Text>
              <TextInput
                style={styles.textInput}
                                  placeholder="Ex: 60 (minutes)"
                value={newGoalTarget}
                onChangeText={setNewGoalTarget}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddGoal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={addCustomGoal}
              >
                <Text style={styles.saveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#667eea',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  calendarSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  todayCard: {
    backgroundColor: '#667eea',
  },
  dayText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  todayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  todayIndicator: {
    marginTop: 4,
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
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
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  goalsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  goalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  completedGoalCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completedGoalTitle: {
    color: '#4CAF50',
    textDecorationLine: 'line-through',
  },
  goalProgress: {
    fontSize: 14,
    color: '#666',
  },
  completeButton: {
    padding: 8,
  },
  completedButton: {
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  progressGradient: {
    padding: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Goals Header
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addGoalButton: {
    backgroundColor: '#667eea',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Goal Actions
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 