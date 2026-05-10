import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="studyverse"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.bg.elevated,
          borderTopWidth: 1,
          borderTopColor: 'rgba(139,92,246,0.14)',
          height: 56,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="studyverse"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={(focused ? 'planet' : 'planet-outline') as IoniconsName}
              size={26}
              color={focused ? colors.text.primary : colors.text.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={(focused ? 'library' : 'library-outline') as IoniconsName}
              size={26}
              color={focused ? colors.text.primary : colors.text.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="friend"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={(focused ? 'people' : 'people-outline') as IoniconsName}
              size={26}
              color={focused ? colors.text.primary : colors.text.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={(focused ? 'person-circle' : 'person-circle-outline') as IoniconsName}
              size={26}
              color={focused ? colors.text.primary : colors.text.muted}
            />
          ),
        }}
      />

      {/* Hidden routes — not shown in navbar */}
      <Tabs.Screen name="universe" options={{ href: null }} />
      <Tabs.Screen name="coop" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
