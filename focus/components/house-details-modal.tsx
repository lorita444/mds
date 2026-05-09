import { Modal, Pressable, Text, View } from "react-native";

import { type FocusHouse } from "../utils/houses";

type HouseDetailsModalProps = {
  durationLabel: string;
  house: FocusHouse | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function HouseDetailsModal({
  durationLabel,
  house,
  onClose,
  onConfirm,
}: HouseDetailsModalProps) {
  return (
    <Modal
      animationType="fade"
      visible={house !== null}
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/55 px-6">
        <View className="w-full max-w-sm rounded-[32px] bg-slate-950 px-6 py-7">
          <Text className="text-sm uppercase tracking-[3px] text-red-200">
            House selected
          </Text>
          <Text className="mt-3 text-3xl font-bold text-white">
            {house?.label}
          </Text>
          <Text className="mt-5 text-base text-slate-300">
            Focus time
          </Text>
          <Text className="mt-2 text-4xl font-bold text-white">
            {durationLabel}
          </Text>
          <Text className="mt-3 text-base leading-6 text-slate-300">
            Press OK to start the dedicated timer page with this house preset.
          </Text>

          <View className="mt-8 flex-row gap-3">
            <Pressable
              className="flex-1 items-center rounded-[22px] bg-white/10 px-4 py-4"
              onPress={onClose}
            >
              <Text className="font-semibold text-white">Close</Text>
            </Pressable>
            <Pressable
              className="flex-1 items-center rounded-[22px] bg-red-600 px-4 py-4"
              onPress={onConfirm}
            >
              <Text className="font-semibold text-white">OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
