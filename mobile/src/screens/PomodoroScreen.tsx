import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGamification } from '../contexts/GamificationContext';

interface Props {
  navigation: any;
}

export default function PomodoroScreen({ navigation }: Props) {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [completedBreaks, setCompletedBreaks] = useState(0);
  
  const { addXp, addStudyMinutes, recordActivity } = useGamification();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            // Timer bitti
            handleTimerComplete();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleTimerComplete = async () => {
    setIsRunning(false);
    
    if (isBreak) {
              // Break finished, switch to work mode
      setCompletedBreaks(prev => prev + 1);
      setTimeLeft(25 * 60);
      setIsBreak(false);
      Alert.alert(
        '⏰ Break Finished!',
        'Work time is starting. Are you ready?',
        [
          { text: 'Start', onPress: () => setIsRunning(true) },
          { text: 'Later', style: 'cancel' }
        ]
      );
    } else {
              // Work finished, switch to break mode
      setCompletedPomodoros(prev => prev + 1);
      setTimeLeft(5 * 60);
      setIsBreak(true);
      
              // Save XP, work minutes and activity
              await addXp(50, 'Pomodoro tamamladın! 🎯');
      await addStudyMinutes(25);
      await recordActivity();
      
      Alert.alert(
        '🎉 Pomodoro Completed!',
        'Congratulations! You completed 25 minutes of focused work. Now it\'s 5 minutes break time.',
        [
          { text: 'Start Break', onPress: () => setIsRunning(true) },
          { text: 'Later', style: 'cancel' }
        ]
      );
    }
  };

  const startTimer = () => {
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
  };

  const skipTimer = () => {
    Alert.alert(
      '⏭️ Skip Timer',
      'Are you sure you want to skip the timer?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: handleTimerComplete }
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const totalTime = isBreak ? 5 * 60 : 25 * 60;
    return ((totalTime - timeLeft) / totalTime) * 100;
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
        <Text style={styles.headerTitle}>Pomodoro Timer</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Timer Container */}
      <View style={styles.timerContainer}>
        <LinearGradient
          colors={isBreak ? ['#4facfe', '#00f2fe'] : ['#ff6b6b', '#ee5a52']}
          style={styles.timerGradient}
        >
          {/* Mode Indicator */}
          <View style={styles.modeIndicator}>
            <Ionicons 
              name={isBreak ? "cafe" : "timer"} 
              size={32} 
              color="#fff" 
            />
            <Text style={styles.modeText}>
              {isBreak ? 'Break Time' : 'Work Time'}
            </Text>
          </View>

          {/* Timer Display */}
          <View style={styles.timerDisplay}>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${getProgress()}%` }
                ]} 
              />
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={resetTimer}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.controlText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.playButton, isRunning && styles.pauseButton]}
              onPress={isRunning ? pauseTimer : startTimer}
            >
              <Ionicons 
                name={isRunning ? "pause" : "play"} 
                size={40} 
                color="#fff" 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={skipTimer}
            >
              <Ionicons name="play-skip-forward" size={24} color="#fff" />
              <Text style={styles.controlText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="timer" size={24} color="#ff6b6b" />
          <Text style={styles.statValue}>{completedPomodoros}</Text>
                      <Text style={styles.statLabel}>Completed Pomodoros</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="cafe" size={24} color="#4facfe" />
          <Text style={styles.statValue}>{completedBreaks}</Text>
                      <Text style={styles.statLabel}>Completed Breaks</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="time" size={24} color="#ffd700" />
          <Text style={styles.statValue}>{completedPomodoros * 25}</Text>
                      <Text style={styles.statLabel}>Total Minutes</Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>🎯 Pomodoro Technique</Text>
        <Text style={styles.instructionsText}>
          • 25 minutes focused work{'\n'}
          • 5 minutes short break{'\n'}
          • 15 minutes long break after every 4 pomodoros{'\n'}
          • Rest your eyes and move during breaks
        </Text>
      </View>
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
  timerContainer: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  timerGradient: {
    padding: 30,
    alignItems: 'center',
  },
  modeIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timerText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  progressBar: {
    width: 200,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  controlButton: {
    alignItems: 'center',
    padding: 16,
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  pauseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 24,
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
  instructionsContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
}); 