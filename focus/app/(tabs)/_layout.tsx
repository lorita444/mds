import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, typography } from '../../utils/theme';

function TabIcon({ focused, icon }: { focused: boolean; icon: string }) {
  return (
    <Text
      style={{
        fontSize: focused ? 24 : 22,
        opacity: focused ? 1 : 0.55,
        transform: [{ translateY: focused ? -1 : 0 }],
      }}
    >
      {icon}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="studyverse"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarStyle: {
          backgroundColor: colors.bg.elevated,
          borderTopWidth: 1,
          borderTopColor: 'rgba(148,163,184,0.14)',
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
      }}
    >
      <Tabs.Screen
        name="studyverse"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🪐" />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="📚" />,
        }}
      />
      <Tabs.Screen
        name="friend"
        options={{
          title: 'Friends',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="👥" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="👤" />,
        }}
      />

      {/* Hidden routes — not shown in navbar */}
      <Tabs.Screen name="universe" options={{ href: null }} />
      <Tabs.Screen name="coop" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
