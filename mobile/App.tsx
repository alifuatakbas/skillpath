import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/navigation/types';
import HomeScreen from './src/screens/HomeScreen';
import AssessmentScreen from './src/screens/AssessmentScreen';
import RoadmapScreen from './src/screens/RoadmapScreen';
import RoadmapGenerationScreen from './src/screens/RoadmapGenerationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import RoadmapDetailScreen from './src/screens/RoadmapDetailScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import NotificationHistoryScreen from './src/screens/NotificationHistoryScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
