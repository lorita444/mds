import { Text, View } from "react-native";

import { useAppContext } from "../context/app-context";
import { APP_DESCRIPTION } from "../utils/constants";

export function HomeScreen() {
  const { focusMinutes } = useAppContext();
  const appName = process.env.EXPO_PUBLIC_APP_NAME ?? "Focus App";

  return (
    <View className="flex-1 bg-slate-950 px-6 pt-20">
      <View className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
        <Text className="text-sm font-medium uppercase tracking-[3px] text-brand-100">
          Expo Go Starter
        </Text>
        <Text className="mt-4 text-4xl font-bold text-white">{appName}</Text>
        <Text className="mt-3 text-base leading-6 text-slate-300">
          {APP_DESCRIPTION}
        </Text>

        <View className="mt-8 rounded-3xl bg-brand-500 px-5 py-4">
          <Text className="text-sm uppercase tracking-[2px] text-brand-50">
            Default session
          </Text>
          <Text className="mt-2 text-3xl font-semibold text-white">
            {focusMinutes} min
          </Text>
        </View>
      </View>
    </View>
  );
}
