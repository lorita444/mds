import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, radius } from '../../utils/theme';

type TabIconProps = {
  emoji: string;
  focused: boolean;
  label: string;
};

function TabIcon({ emoji, focused, label }: TabIconProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 2,
        paddingTop: 4,
      }}
    >
      <View
        style={{
          width: 40,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          backgroundColor: focused ? colors.cosmic.purpleFaint : 'transparent',
        }}
      >
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '600' : '400',
          color: focused ? colors.cosmic.purpleLight : colors.text.muted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.elevated,
          borderTopWidth: 1,
          borderTopColor: colors.bg.cardBorder,
          height: 72,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="universe"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🌌" focused={focused} label="Universe" />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📚" focused={focused} label="Portfolio" />
          ),
        }}
      />
      <Tabs.Screen
        name="coop"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🤝" focused={focused} label="Co-op" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" focused={focused} label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}
