import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../../utils/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const renderTabIcon = (
    focused: boolean,
    icon: IoniconsName,
    activeIcon: IoniconsName,
    label: string,
  ) => (
    <View
      style={{
        minWidth: 58,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        borderRadius: radius.md,
        backgroundColor: focused ? 'rgba(124,58,237,0.14)' : 'transparent',
      }}
    >
      <Ionicons
        name={focused ? activeIcon : icon}
        size={23}
        color={focused ? colors.cosmic.purpleLight : colors.text.muted}
      />
      <Text
        numberOfLines={1}
        style={{
          color: focused ? colors.text.primary : colors.text.muted,
          fontSize: typography.sizes.xs,
          fontWeight: focused ? typography.weights.semibold : typography.weights.medium,
        }}
      >
        {label}
      </Text>
    </View>
  );

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
          height: 76,
          paddingBottom: 10,
          paddingTop: 8,
          paddingHorizontal: 8,
          elevation: 0,
        },
        tabBarItemStyle: {
          minHeight: 56,
        },
      }}
    >
      <Tabs.Screen
        name="studyverse"
        options={{
          tabBarIcon: ({ focused }) => (
            renderTabIcon(focused, 'planet-outline' as IoniconsName, 'planet' as IoniconsName, 'Study')
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          tabBarIcon: ({ focused }) => (
            renderTabIcon(focused, 'library-outline' as IoniconsName, 'library' as IoniconsName, 'Portfolio')
          ),
        }}
      />
      <Tabs.Screen
        name="friend"
        options={{
          tabBarIcon: ({ focused }) => (
            renderTabIcon(focused, 'people-outline' as IoniconsName, 'people' as IoniconsName, 'Friends')
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            renderTabIcon(focused, 'person-circle-outline' as IoniconsName, 'person-circle' as IoniconsName, 'Profile')
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
