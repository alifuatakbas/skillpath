import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateRoadmap } from '../services/api';

const RoadmapGenerationScreen = ({ navigation }: { navigation: any }) => {
  const [skillName, setSkillName] = useState('');
  const [targetWeeks, setTargetWeeks] = useState('8');
  const [currentLevel, setCurrentLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [dailyHours, setDailyHours] = useState('2');
  const [loading, setLoading] = useState(false);

  const levels = [
    { key: 'beginner', label: 'Başlangıç', color: '#4CAF50' },
    { key: 'intermediate', label: 'Orta', color: '#FF9800' },
    { key: 'advanced', label: 'İleri', color: '#F44336' },
  ];

  const handleGenerateRoadmap = async () => {
    if (!skillName.trim()) {
      Alert.alert('Hata', 'Lütfen öğrenmek istediğiniz beceriyi girin');
      return;
    }

    setLoading(true);

    try {
      const response = await generateRoadmap({
        skill_name: skillName.trim(),
        target_weeks: parseInt(targetWeeks) || 8,
        current_level: currentLevel,
        daily_hours: parseInt(dailyHours) || 2,
      });

      if (response.success) {
        Alert.alert(
          '🎉 Başarılı!',
          'Roadmap başarıyla oluşturuldu!',
          [
            {
              text: 'Dashboard\'a Git',
              onPress: () => navigation.navigate('Dashboard'),
            },
            {
              text: 'Detayları Gör',
              onPress: () => navigation.navigate('RoadmapDetail', { 
                roadmapId: response.roadmap_id 
              }),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Roadmap generation error:', error);
      Alert.alert('Hata', error.message || 'Roadmap oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.headerTitle}>Roadmap Oluştur</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Skill Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Öğrenmek İstediğiniz Skill</Text>
            <TextInput
              style={styles.input}
              value={skillName}
              onChangeText={setSkillName}
              placeholder="Örn: React, Python, Machine Learning"
              placeholderTextColor="#999"
            />
          </View>

          {/* Target Weeks */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Hedef Süre (Hafta)</Text>
            <TextInput
              style={styles.input}
              value={targetWeeks}
              onChangeText={setTargetWeeks}
              placeholder="8"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>

          {/* Current Level */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mevcut Seviyeniz</Text>
            <View style={styles.levelContainer}>
              {levels.map((level) => (
                <TouchableOpacity
                  key={level.key}
                  style={[
                    styles.levelButton,
                    currentLevel === level.key && styles.selectedLevel,
                    { borderColor: level.color },
                    currentLevel === level.key && { backgroundColor: level.color },
                  ]}
                  onPress={() => setCurrentLevel(level.key as any)}
                >
                  <Text
                    style={[
                      styles.levelText,
                      currentLevel === level.key && styles.selectedLevelText,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Daily Hours */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Günlük Çalışma Saati</Text>
            <TextInput
              style={styles.input}
              value={dailyHours}
              onChangeText={setDailyHours}
              placeholder="2"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateButton, loading && styles.disabledButton]}
            onPress={handleGenerateRoadmap}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="map-outline" size={24} color="#fff" />
                <Text style={styles.generateButtonText}>Roadmap Oluştur</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#fff" />
            <Text style={styles.infoText}>
              AI destekli kişiselleştirilmiş öğrenme yol haritası oluşturulacak
            </Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  form: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  levelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedLevel: {
    backgroundColor: '#4CAF50',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  selectedLevelText: {
    color: '#fff',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
});

export default RoadmapGenerationScreen; 