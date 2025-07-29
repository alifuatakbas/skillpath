export type RootStackParamList = {
  Home: undefined;
  Assessment: {
    skillName: string;
    targetWeeks?: number;
    currentLevel?: string;
    dailyHours?: number;
  };
  Roadmap: {
    roadmapId: string;
  };
  RoadmapGeneration: undefined;
  Dashboard: undefined;
  // DailyTasks route kaldırıldı
  RoadmapDetail: {
    roadmapId: number;
  };
  Profile: {
    userId?: number; // undefined = kendi profili, number = başkasının profili
  };
  Login: undefined;
  Register: undefined;
  NotificationSettings: undefined;
  NotificationHistory: undefined;
  Paywall: {
    feature?: string;
  };
  Community: undefined;
  MyCommunity: undefined;
  Explore: undefined;
  CreatePost: undefined; // Yeni eklendi
  Pomodoro: undefined; // Pomodoro timer
  Calendar: undefined; // Calendar & planning
}; 