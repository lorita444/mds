import { useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";

import { type FocusHouse } from "../utils/houses";

const MAX_ZOOM = 2.8;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 1600;
const PAN_SPEED_MULTIPLIER = 1.75;

type FocusMapProps = {
  houses: FocusHouse[];
  onSelectHouse: (house: FocusHouse) => void;
};

type Point = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMinimumScale(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return 1;
  }

  return Math.max(width / MAP_WIDTH, height / MAP_HEIGHT);
}

function distanceBetweenTouches(event: GestureResponderEvent) {
  const [firstTouch, secondTouch] = event.nativeEvent.touches;

  if (!firstTouch || !secondTouch) {
    return 0;
  }

  return Math.hypot(
    secondTouch.pageX - firstTouch.pageX,
    secondTouch.pageY - firstTouch.pageY,
  );
}

export function FocusMap({ houses, onSelectHouse }: FocusMapProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoomIndicator, setZoomIndicator] = useState({
    visible: false,
    percent: 100,
  });
  const containerSizeRef = useRef({ width: 0, height: 0 });
  const scaleValue = useRef(new Animated.Value(1)).current;
  const translateXValue = useRef(new Animated.Value(0)).current;
  const translateYValue = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const translateRef = useRef<Point>({ x: 0, y: 0 });
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const pinchStartScaleRef = useRef(1);
  const pinchStartDistanceRef = useRef(0);
  const modeRef = useRef<"none" | "pan" | "pinch">("none");

  const syncAnimatedValues = (nextScale: number, nextX: number, nextY: number) => {
    scaleRef.current = nextScale;
    translateRef.current = { x: nextX, y: nextY };
    scaleValue.setValue(nextScale);
    translateXValue.setValue(nextX);
    translateYValue.setValue(nextY);
  };

  const getBounds = (nextScale: number) => {
    const { width, height } = containerSizeRef.current;

    return {
      x: Math.max(0, (MAP_WIDTH * nextScale - width) / 2),
      y: Math.max(0, (MAP_HEIGHT * nextScale - height) / 2),
    };
  };

  const applyClampedTransform = (nextScale: number, nextX: number, nextY: number) => {
    const minimumScale = getMinimumScale(
      containerSizeRef.current.width,
      containerSizeRef.current.height,
    );
    const clampedScale = clamp(nextScale, minimumScale, MAX_ZOOM);
    const bounds = getBounds(clampedScale);
    const clampedX = clamp(nextX, -bounds.x, bounds.x);
    const clampedY = clamp(nextY, -bounds.y, bounds.y);

    syncAnimatedValues(clampedScale, clampedX, clampedY);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextSize = {
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    };
    containerSizeRef.current = nextSize;
    setContainerSize(nextSize);
    const minimumScale = getMinimumScale(nextSize.width, nextSize.height);
    setZoomIndicator((current) => ({
      ...current,
      percent: Math.round(minimumScale * 100),
    }));

    applyClampedTransform(
      Math.max(scaleRef.current, minimumScale),
      translateRef.current.x,
      translateRef.current.y,
    );
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      gestureState.numberActiveTouches > 1 ||
      Math.abs(gestureState.dx) > 3 ||
      Math.abs(gestureState.dy) > 3,
    onMoveShouldSetPanResponderCapture: (_, gestureState) =>
      gestureState.numberActiveTouches > 1,
    onPanResponderGrant: (event) => {
      if (event.nativeEvent.touches.length >= 2) {
        modeRef.current = "pinch";
        pinchStartScaleRef.current = scaleRef.current;
        pinchStartDistanceRef.current = distanceBetweenTouches(event);
        setZoomIndicator({
          visible: true,
          percent: Math.round(scaleRef.current * 100),
        });
        return;
      }

      modeRef.current = "pan";
      panStartRef.current = { ...translateRef.current };
    },
    onPanResponderMove: (event, gestureState) => {
      if (event.nativeEvent.touches.length >= 2) {
        const nextDistance = distanceBetweenTouches(event);

        if (modeRef.current !== "pinch") {
          modeRef.current = "pinch";
          pinchStartScaleRef.current = scaleRef.current;
          pinchStartDistanceRef.current = nextDistance;
          setZoomIndicator({
            visible: true,
            percent: Math.round(scaleRef.current * 100),
          });
          return;
        }

        if (pinchStartDistanceRef.current <= 0) {
          return;
        }

        const nextScale = clamp(
          pinchStartScaleRef.current *
            (nextDistance / pinchStartDistanceRef.current),
          getMinimumScale(
            containerSizeRef.current.width,
            containerSizeRef.current.height,
          ),
          MAX_ZOOM,
        );

        applyClampedTransform(
          nextScale,
          translateRef.current.x,
          translateRef.current.y,
        );
        setZoomIndicator({
          visible: true,
          percent: Math.round(nextScale * 100),
        });
        return;
      }

      if (modeRef.current === "pinch") {
        modeRef.current = "pan";
        panStartRef.current = { ...translateRef.current };
        setZoomIndicator((current) => ({ ...current, visible: false }));
      }

      const movementScale = PAN_SPEED_MULTIPLIER / Math.max(scaleRef.current, 0.1);
      const nextX = panStartRef.current.x + gestureState.dx * movementScale;
      const nextY = panStartRef.current.y + gestureState.dy * movementScale;

      applyClampedTransform(scaleRef.current, nextX, nextY);
    },
    onPanResponderRelease: () => {
      modeRef.current = "none";
      setZoomIndicator((current) => ({ ...current, visible: false }));
    },
    onPanResponderTerminate: () => {
      modeRef.current = "none";
      setZoomIndicator((current) => ({ ...current, visible: false }));
    },
  });

  return (
    <View
      className="flex-1 overflow-hidden bg-[#450a0a]"
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {zoomIndicator.visible ? (
        <View className="absolute right-5 top-14 z-20 rounded-full bg-black/30 px-3 py-2">
          <Text className="text-xs font-semibold tracking-[1.5px] text-white">
            {zoomIndicator.percent}%
          </Text>
        </View>
      ) : null}

      <Animated.View
        className="absolute"
        style={{
          left: (containerSize.width - MAP_WIDTH) / 2,
          top: (containerSize.height - MAP_HEIGHT) / 2,
          transform: [
            { translateX: translateXValue },
            { translateY: translateYValue },
            { scale: scaleValue },
          ],
        }}
      >
        <View
          className="relative overflow-hidden bg-[#7f1d1d]"
          style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
        >
          <View className="absolute inset-0 bg-[#991b1b]" />
          <View className="absolute left-[7%] top-[8%] h-56 w-44 rounded-[40px] border border-white/10 bg-white/10" />
          <View className="absolute left-[58%] top-[10%] h-40 w-52 rounded-[46px] border border-black/10 bg-black/10" />
          <View className="absolute left-[14%] top-[48%] h-52 w-80 rounded-[54px] border border-white/10 bg-black/10" />
          <View className="absolute left-[60%] top-[62%] h-44 w-60 rounded-[50px] border border-white/10 bg-white/10" />

          {houses.map((house) => (
            <Pressable
              key={house.id}
              className="absolute rounded-[30px] border-2 border-white/75"
              style={{
                left: house.left,
                top: house.top,
                width: house.width,
                height: house.height,
                backgroundColor: house.color,
              }}
              onPress={() => onSelectHouse(house)}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
