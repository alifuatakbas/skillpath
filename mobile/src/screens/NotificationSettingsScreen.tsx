import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences,
  registerPushToken,
  TokenManager 
} from '../services/api';
import { 
  NotificationPreferenceRequest, 
  NotificationPreferenceResponse,
  TimezoneInfo 
} from '../types';
import { detectTimezone } from '../utils/timezone';

const NotificationSettingsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'reminder' | 'dnd_start' | 'dnd_end' | null>(null);
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const isAuth = await TokenManager.isAuthenticated();
      if (!isAuth) {
        Alert.alert(
          'Giriş Gerekli',
          'Bildirim ayarlarını görüntülemek için giriş yapmanız gerekiyor.',
          [
            {
              text: 'Giriş Yap',
              onPress: () => navigation?.navigate('Home')
            }
          ]
        );
        return;
      }
      
      loadPreferences();
      loadTimezoneInfo();
    } catch (error) {
      console.error('Auth check failed:', error);
      setLoading(false);
    }
  };

  const loadTimezoneInfo = async () => {
    try {
      const info = await detectTimezone();
      setTimezoneInfo(info);
      console.log('Timezone detected:', info);
    } catch (error) {
      console.error('Timezone detection failed:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      
      // Auth hatası kontrolü
      if (error instanceof Error && error.message.includes('Oturum süresi dolmuş')) {
        Alert.alert(
          'Oturum Süresi Doldu',
          'Lütfen tekrar giriş yapın.',
          [
            {
              text: 'Giriş Yap',
              onPress: () => navigation?.navigate('Home')
            }
          ]
        );
        return;
      }
      
      Alert.alert('Hata', 'Bildirim ayarları yüklenirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updatedPrefs: Partial<NotificationPreferenceRequest>) => {
    if (!preferences) return;

    try {
      setSaving(true);
      
      const requestData: NotificationPreferenceRequest = {
        daily_reminder_enabled: preferences.daily_reminder_enabled,
        daily_reminder_time: preferences.daily_reminder_time,
        step_completion_enabled: preferences.step_completion_enabled,
        streak_warning_enabled: preferences.streak_warning_enabled,
        weekly_progress_enabled: preferences.weekly_progress_enabled,
        do_not_disturb_start: preferences.do_not_disturb_start,
        do_not_disturb_end: preferences.do_not_disturb_end,
        timezone: timezoneInfo?.timezone || preferences.timezone,
        device_timezone: timezoneInfo?.deviceTimezone || preferences.device_timezone,
        ...updatedPrefs,
      };

      const updated = await updateNotificationPreferences(requestData);
      setPreferences(updated);
      
      Alert.alert('Başarılı', 'Bildirim ayarları güncellendi');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      Alert.alert('Hata', 'Bildirim ayarları kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchChange = (key: keyof NotificationPreferenceRequest, value: boolean) => {
    if (preferences) {
      const updated = { ...preferences, [key]: value };
      setPreferences(updated);
      savePreferences({ [key]: value });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime && showTimePicker && preferences) {
      const timeString = selectedTime.toTimeString().slice(0, 5); // HH:MM format
      
      const updateKey = 
        showTimePicker === 'reminder' ? 'daily_reminder_time' :
        showTimePicker === 'dnd_start' ? 'do_not_disturb_start' :
        'do_not_disturb_end';
      
      const updated = { ...preferences, [updateKey]: timeString };
      setPreferences(updated);
      savePreferences({ [updateKey]: timeString });
    }
    setShowTimePicker(null);
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };

  const createTimeFromString = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Bildirim ayarları yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!preferences) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bildirim ayarları yüklenemedi</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPreferences}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Bildirim Ayarları</Text>
          <Text style={styles.subtitle}>
            Bildirim tercihlerinizi yönetin
          </Text>
        </View>

        {/* Timezone Info */}
        {timezoneInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saat Dilimi Bilgisi</Text>
            <View style={styles.timezoneInfo}>
              <Text style={styles.timezoneText}>
                🌍 {timezoneInfo.timezone}
              </Text>
              <Text style={styles.timezoneSubtext}>
                {timezoneInfo.locale} - {timezoneInfo.country}
              </Text>
            </View>
          </View>
        )}

        {/* Daily Reminders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Günlük Hatırlatmalar</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Günlük Hatırlatma</Text>
              <Text style={styles.settingDescription}>
                Her gün öğrenme hedeflerinizi hatırlatır
              </Text>
            </View>
            <Switch
              value={preferences.daily_reminder_enabled}
              onValueChange={(value) => handleSwitchChange('daily_reminder_enabled', value)}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={preferences.daily_reminder_enabled ? '#FFFFFF' : '#F4F4F4'}
            />
          </View>

          {preferences.daily_reminder_enabled && (
            <TouchableOpacity
              style={styles.timeSelector}
              onPress={() => setShowTimePicker('reminder')}
            >
              <Text style={styles.timeSelectorLabel}>Hatırlatma Saati</Text>
              <Text style={styles.timeSelectorValue}>
                {formatTime(preferences.daily_reminder_time)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İlerleme Bildirimleri</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Adım Tamamlama</Text>
              <Text style={styles.settingDescription}>
                Bir adımı tamamladığınızda bildirim alın
              </Text>
            </View>
            <Switch
              value={preferences.step_completion_enabled}
              onValueChange={(value) => handleSwitchChange('step_completion_enabled', value)}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={preferences.step_completion_enabled ? '#FFFFFF' : '#F4F4F4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Seri Uyarısı</Text>
              <Text style={styles.settingDescription}>
                Öğrenme serinizi kaybetme riski olduğunda uyarır
              </Text>
            </View>
            <Switch
              value={preferences.streak_warning_enabled}
              onValueChange={(value) => handleSwitchChange('streak_warning_enabled', value)}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={preferences.streak_warning_enabled ? '#FFFFFF' : '#F4F4F4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Haftalık İlerleme</Text>
              <Text style={styles.settingDescription}>
                Haftalık ilerleme raporları alın
              </Text>
            </View>
            <Switch
              value={preferences.weekly_progress_enabled}
              onValueChange={(value) => handleSwitchChange('weekly_progress_enabled', value)}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={preferences.weekly_progress_enabled ? '#FFFFFF' : '#F4F4F4'}
            />
          </View>
        </View>

        {/* Do Not Disturb */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rahatsız Etme Saatleri</Text>
          <Text style={styles.sectionDescription}>
            Bu saatler arasında bildirim almayacaksınız
          </Text>
          
          <View style={styles.timeRangeContainer}>
            <TouchableOpacity
              style={styles.timeSelector}
              onPress={() => setShowTimePicker('dnd_start')}
            >
              <Text style={styles.timeSelectorLabel}>Başlangıç</Text>
              <Text style={styles.timeSelectorValue}>
                {formatTime(preferences.do_not_disturb_start)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.timeSelector}
              onPress={() => setShowTimePicker('dnd_end')}
            >
              <Text style={styles.timeSelectorLabel}>Bitiş</Text>
              <Text style={styles.timeSelectorValue}>
                {formatTime(preferences.do_not_disturb_end)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Indicator */}
        {saving && (
          <View style={styles.savingContainer}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.savingText}>Kaydediliyor...</Text>
          </View>
        )}
      </ScrollView>

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={
            showTimePicker === 'reminder' ? createTimeFromString(preferences.daily_reminder_time) :
            showTimePicker === 'dnd_start' ? createTimeFromString(preferences.do_not_disturb_start) :
            createTimeFromString(preferences.do_not_disturb_end)
          }
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  timezoneInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  timezoneText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  timezoneSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  timeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeSelectorLabel: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  timeSelectorValue: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '600',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4A90E2',
  },
});

export default NotificationSettingsScreen; 