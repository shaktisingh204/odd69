import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Colors } from '@/utils/theme';
import { useAuth } from '@/context/AuthContext';

import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import MatchListScreen from '@/screens/matches/MatchListScreen';
import MatchDetailScreen from '@/screens/matches/MatchDetailScreen';
import CreateTeamScreen from '@/screens/team/CreateTeamScreen';
import CaptainSelectScreen from '@/screens/team/CaptainSelectScreen';
import ContestLeaderboardScreen from '@/screens/contest/ContestLeaderboardScreen';
import HistoryScreen from '@/screens/profile/HistoryScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import GlassTabBar from '@/components/ui/GlassTabBar';
import { ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type RootStackParamList = {
  MainTabs: undefined;
  MatchDetail: { matchId: string };
  CreateTeam: { matchId: string; teamId?: string };
  CaptainSelect: { matchId: string; contestId: string; playerIds: number[]; existingTeamId?: string };
  ContestLeaderboard: { contestId: string; matchId: string };
  Login: undefined;
  Register: undefined;
};

export type TabParamList = {
  Matches: undefined;
  MyTeams: undefined;
  History: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const NavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primaryLight,
    background: Colors.bg,
    card: Colors.bgSurface,
    text: '#fff',
    border: Colors.glassBorder,
    notification: Colors.primaryLight,
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Matches" component={MatchListScreen} />
      <Tab.Screen name="MyTeams" component={HistoryScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LinearGradient
          colors={['#1A1022', '#0E0F16', '#07080C']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <ActivityIndicator color={Colors.primaryLight} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="MainTabs"            component={TabNavigator} />
        <Stack.Screen name="MatchDetail"         component={MatchDetailScreen} />
        <Stack.Screen name="CreateTeam"          component={CreateTeamScreen} />
        <Stack.Screen name="CaptainSelect"       component={CaptainSelectScreen} />
        <Stack.Screen name="ContestLeaderboard"  component={ContestLeaderboardScreen} />
        <Stack.Screen name="Login"               component={LoginScreen}    options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Register"            component={RegisterScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
