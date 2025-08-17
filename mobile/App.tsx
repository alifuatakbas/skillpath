import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { RootStackParamList } from './src/navigation/types';
import { PremiumProvider } from './src/contexts/PremiumContext';
import { GamificationProvider } from './src/contexts/GamificationContext';
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
import CreatePostScreen from './src/screens/CreatePostScreen'; // Yeni eklendi
import PomodoroScreen from './src/screens/PomodoroScreen'; // Pomodoro timer
import CalendarScreen from './src/screens/CalendarScreen'; // Calendar & planning
import TrialWrapper from './src/components/TrialWrapper'; // Trial wrapper

const Stack = createStackNavigator<RootStackParamList>();

// Push notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
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
      Alert.alert('Failed to get push token for push notification!');
      return;
    }
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log(token);
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  } else {
    Alert.alert('Must use physical device for Push Notifications');
  }

  return token;
}

export default function App() {
  useEffect(() => {
    // Push notifications
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        registerPushToken({
          push_token: token,
          device_type: 'mobile'
        }).catch(console.error);
      }
    });
  }, []);

  return (
    <PremiumProvider>
      <GamificationProvider>
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
          />
          <Stack.Screen 
            name="Assessment" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <AssessmentScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="Roadmap" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <RoadmapScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="RoadmapGeneration" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <RoadmapGenerationScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="Dashboard" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <DashboardScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="RoadmapDetail" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <RoadmapDetailScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="NotificationHistory" component={NotificationHistoryScreen} />
          <Stack.Screen name="Paywall" component={PaywallScreen} />
          <Stack.Screen 
            name="Community" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <CommunityScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="MyCommunity" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <MyCommunityScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="Explore" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <ExploreScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="Profile" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <ProfileScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="CreatePost" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <CreatePostScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="Pomodoro" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <PomodoroScreen {...props} />
              </TrialWrapper>
            )} 
          />
          <Stack.Screen 
            name="Calendar" 
            component={(props: any) => (
              <TrialWrapper navigation={props.navigation}>
                <CalendarScreen {...props} />
              </TrialWrapper>
            )} 
          />
        </Stack.Navigator>
      </NavigationContainer>
      </GamificationProvider>
    </PremiumProvider>
  );
}
