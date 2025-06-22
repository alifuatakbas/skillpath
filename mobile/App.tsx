import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { RootStackParamList } from './src/navigation/types';
import { PremiumProvider } from './src/contexts/PremiumContext';
import { registerPushToken, TokenManager } from './src/services/api';
import HomeScreen from './src/screens/HomeScreen';
import AssessmentScreen from './src/screens/AssessmentScreen';
import RoadmapScreen from './src/screens/RoadmapScreen';
import RoadmapGenerationScreen from './src/screens/RoadmapGenerationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
// DailyTasksScreen import'u kaldırıldı
import RoadmapDetailScreen from './src/screens/RoadmapDetailScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import NotificationHistoryScreen from './src/screens/NotificationHistoryScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import MyCommunityScreen from './src/screens/MyCommunityScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createStackNavigator<RootStackParamList>();

// Push notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ Push token obtained:', token);
      
      // Token'ı backend'e kaydet
      const isAuth = await TokenManager.isAuthenticated();
      if (isAuth) {
        try {
          await registerPushToken({
            push_token: token,
            device_type: 'mobile'
          });
          console.log('✅ Push token registered to backend');
        } catch (error) {
          console.error('❌ Failed to register push token:', error);
        }
      } else {
        console.log('⚠️ User not authenticated, push token not registered');
      }
    } catch (error) {
      console.error('❌ Failed to get push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export default function App() {
  useEffect(() => {
    // Push notification setup
    registerForPushNotificationsAsync();

    // Notification response listener
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log('Notification response:', response);
      // Handle notification tap
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  return (
    <PremiumProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{
              title: 'SkillPath',
            }}
          />
          <Stack.Screen 
            name="Assessment" 
            component={AssessmentScreen}
            options={{
              title: 'Değerlendirme',
            }}
          />
          <Stack.Screen 
            name="Roadmap" 
            component={RoadmapScreen}
            options={{
              title: 'Yol Haritası',
            }}
          />
          <Stack.Screen 
            name="RoadmapGeneration" 
            component={RoadmapGenerationScreen}
            options={{
              title: 'Roadmap Oluştur',
            }}
          />
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardScreen}
            options={{
              title: 'Dashboard',
            }}
          />
          {/* DailyTasks route kaldırıldı */}
          <Stack.Screen 
            name="RoadmapDetail" 
            component={RoadmapDetailScreen}
            options={{
              title: 'Roadmap Detayı',
            }}
          />
          <Stack.Screen 
            name="NotificationSettings" 
            component={NotificationSettingsScreen}
            options={{
              title: 'Bildirim Ayarları',
            }}
          />
          <Stack.Screen 
            name="NotificationHistory" 
            component={NotificationHistoryScreen}
            options={{
              title: 'Bildirim Geçmişi',
            }}
          />
          <Stack.Screen 
            name="Paywall" 
            component={PaywallScreen}
            options={{
              title: 'Premium',
              presentation: 'modal',
            }}
          />
          <Stack.Screen 
            name="Community" 
            component={CommunityScreen}
            options={{
              title: 'Topluluk',
            }}
          />
          <Stack.Screen 
            name="MyCommunity" 
            component={MyCommunityScreen}
            options={{
              title: 'Benim Topluluğum',
            }}
          />
          <Stack.Screen 
            name="Explore" 
            component={ExploreScreen}
            options={{
              title: 'Keşfet',
            }}
          />
          <Stack.Screen 
            name="Profile" 
            component={ProfileScreen}
            options={{
              title: 'Profil',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PremiumProvider>
  );
}
