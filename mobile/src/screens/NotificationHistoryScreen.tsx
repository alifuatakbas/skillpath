import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNotificationHistory, TokenManager } from '../services/api';
import { NotificationResponse } from '../types';

const NotificationHistoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const isAuth = await TokenManager.isAuthenticated();
      if (!isAuth) {
        Alert.alert(
          'Giriş Gerekli',
          'Bildirim geçmişini görüntülemek için giriş yapmanız gerekiyor.',
          [
            {
              text: 'Giriş Yap',
              onPress: () => navigation?.navigate('Home')
            }
          ]
        );
        return;
      }
      
      loadNotifications();
    } catch (error) {
      console.error('Auth check failed:', error);
      setLoading(false);
    }
  };

  const loadNotifications = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const data = await getNotificationHistory(50); // Son 50 bildirim
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      
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
      
      Alert.alert('Hata', 'Bildirim geçmişi yüklenirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return `Bugün ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
      return `Dün ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays <= 7) {
      return `${diffDays - 1} gün önce`;
    } else {
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'daily_reminder':
        return '🔔';
      case 'step_completion':
        return '✅';
      case 'streak_warning':
        return '⚠️';
      case 'weekly_progress':
        return '📊';
      default:
        return '📱';
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'daily_reminder':
        return 'Günlük Hatırlatma';
      case 'step_completion':
        return 'Adım Tamamlandı';
      case 'streak_warning':
        return 'Seri Uyarısı';
      case 'weekly_progress':
        return 'Haftalık İlerleme';
      default:
        return 'Bildirim';
    }
  };

  const renderNotificationItem = ({ item }: { item: NotificationResponse }) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationHeader}>
        <View style={styles.notificationTypeContainer}>
          <Text style={styles.notificationIcon}>
            {getNotificationIcon(item.notification_type)}
          </Text>
          <Text style={styles.notificationType}>
            {getNotificationTypeText(item.notification_type)}
          </Text>
        </View>
        <Text style={styles.notificationDate}>
          {formatDate(item.sent_at)}
        </Text>
      </View>
      
      <Text style={styles.notificationTitle}>{item.title}</Text>
      <Text style={styles.notificationMessage}>{item.message}</Text>
      
      {(item.roadmap_title || item.step_title) && (
        <View style={styles.notificationContext}>
          {item.roadmap_title && (
            <Text style={styles.contextText}>
              📚 {item.roadmap_title}
            </Text>
          )}
          {item.step_title && (
            <Text style={styles.contextText}>
              📝 {item.step_title}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>Henüz bildirim yok</Text>
      <Text style={styles.emptyMessage}>
        Bildirim ayarlarınızı yapılandırdığınızda, bildirimlerin geçmişi burada görünecek.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Bildirim geçmişi yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bildirim Geçmişi</Text>
        <Text style={styles.subtitle}>
          {notifications.length > 0 
            ? `${notifications.length} bildirim gösteriliyor`
            : 'Henüz bildirim bulunmuyor'
          }
        </Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4A90E2']}
            tintColor="#4A90E2"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  notificationType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90E2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
    lineHeight: 22,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationContext: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
    marginTop: 8,
  },
  contextText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NotificationHistoryScreen; 