import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { getPlanetImage, BG_COSMIC_DEEP, BG_STARS } from '../../utils/assets';

const { width: SW } = Dimensions.get('window');

const STARTER_ITEMS = [
  {
    id: 'planet',
    emoji: '🪐',
    title: 'Starter World',
    subtitle: 'Your first planet',
    description:
      'A mysterious world waiting to be explored. Complete study sessions to unlock its secrets.',
    color: colors.cosmic.purpleLight,
    bgColor: colors.cosmic.purpleFaint,
    borderColor: colors.cosmic.purpleGlow,
  },
  {
    id: 'alien',
    emoji: '👾',
    title: 'Starter Alien',
    subtitle: 'Your first companion',
    description:
      'A friendly alien that grows stronger as you study. Feed it with knowledge every day!',
    color: colors.cosmic.tealLight,
    bgColor: colors.cosmic.tealFaint,
    borderColor: colors.cosmic.teal,
  },
  {
    id: 'crystals',
    emoji: '💎',
    title: '50 Crystals',
    subtitle: 'Starting currency',
    description:
      'Use crystals to place elements in your universe and unlock special cosmic abilities.',
    color: colors.cosmic.goldLight,
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
] as const;

const HOW_IT_GROWS = [
  { icon: '⏱', text: 'Complete focus sessions to earn crystals and universe elements' },
  { icon: '🪐', text: 'Place planets, aliens, and structures into your universe' },
  { icon: '⚡', text: 'Longer sessions unlock rarer, more powerful items' },
  { icon: '👥', text: 'Study with friends in co-op for exclusive rewards' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animated values
  const starsOpacity = useRef(new Animated.Value(0)).current;
  const planetScale = useRef(new Animated.Value(0.4)).current;
  const planetOpacity = useRef(new Animated.Value(0)).current;
  const planetFloat = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  const [currentItem, setCurrentItem] = useState(0);

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      Animated.timing(starsOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(planetScale, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
        Animated.timing(planetOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Floating loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(planetFloat, { toValue: -14, duration: 2200, useNativeDriver: true }),
        Animated.timing(planetFloat, { toValue: 14, duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.55, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Auto-cycle starter items
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentItem((p) => (p + 1) % STARTER_ITEMS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const active = STARTER_ITEMS[currentItem];

  return (
    <View style={styles.root}>
      {/* Background */}
      <Animated.Image
        source={BG_COSMIC_DEEP}
        style={[StyleSheet.absoluteFillObject, { opacity: starsOpacity }]}
        resizeMode="cover"
      />
      <Animated.Image
        source={BG_STARS}
        style={[StyleSheet.absoluteFillObject, { opacity: starsOpacity }]}
        resizeMode="cover"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* Title block */}
        <Animated.View style={[styles.titleBlock, { opacity: titleOpacity }]}>
          <Text style={styles.welcomeLabel}>WELCOME TO YOUR</Text>
          <Text style={styles.mainTitle}>Universe</Text>
          <Text style={styles.subtitle}>
            Your cosmic journey begins now.{'\n'}Study hard to grow your universe.
          </Text>
        </Animated.View>

        {/* Planet hero */}
        <View style={styles.planetSection}>
          <Animated.View
            style={[
              styles.glowRing,
              { opacity: glowPulse, transform: [{ scale: glowPulse }] },
            ]}
          />
          <Animated.Image
            source={getPlanetImage('starter')}
            style={[
              styles.planetImage,
              { opacity: planetOpacity, transform: [{ scale: planetScale }, { translateY: planetFloat }] },
            ]}
            resizeMode="contain"
          />
          <Text style={styles.planetLabel}>Starter World</Text>
        </View>

        {/* Starter kit */}
        <Animated.View style={[styles.section, { opacity: cardsOpacity }]}>
          <Text style={styles.sectionLabel}>YOUR STARTER KIT</Text>

          {/* Tab row */}
          <View style={styles.tabRow}>
            {STARTER_ITEMS.map((item, idx) => (
              <Pressable
                key={item.id}
                onPress={() => setCurrentItem(idx)}
                style={[
                  styles.tab,
                  idx === currentItem && {
                    backgroundColor: item.bgColor,
                    borderColor: item.borderColor,
                  },
                ]}
              >
                <Text style={styles.tabEmoji}>{item.emoji}</Text>
              </Pressable>
            ))}
          </View>

          {/* Active card */}
          <View style={[styles.starterCard, { backgroundColor: active.bgColor, borderColor: active.borderColor }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardEmoji}>{active.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: active.color }]}>{active.title}</Text>
                <Text style={styles.cardSubtitle}>{active.subtitle}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{active.description}</Text>
          </View>

          {/* Dots */}
          <View style={styles.dots}>
            {STARTER_ITEMS.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.dot,
                  idx === currentItem && { width: 22, backgroundColor: active.color },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* How it grows */}
        <Animated.View style={[styles.section, { opacity: cardsOpacity }]}>
          <Text style={styles.sectionLabel}>HOW YOUR UNIVERSE GROWS</Text>
          {HOW_IT_GROWS.map((tip) => (
            <View key={tip.text} style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Text style={styles.tipIconText}>{tip.icon}</Text>
              </View>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.btnWrap, { opacity: btnOpacity }]}>
          <Pressable
            onPress={() => router.replace('/(tabs)/studyverse' as never)}
            style={({ pressed }) => [
              styles.ctaBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.ctaIcon}>🚀</Text>
            <Text style={styles.ctaText}>Enter My Universe</Text>
          </Pressable>
          <Text style={styles.ctaHint}>Your starter planet is ready to explore</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.xl,
    alignItems: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  welcomeLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  mainTitle: {
    color: colors.text.primary,
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: SW * 0.76,
  },
  planetSection: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 260,
    width: '100%',
    gap: spacing.sm,
  },
  glowRing: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(124,58,237,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.32)',
  },
  planetImage: {
    width: 185,
    height: 185,
  },
  planetLabel: {
    position: 'absolute',
    bottom: 0,
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  section: {
    width: '100%',
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabEmoji: {
    fontSize: 22,
  },
  starterCard: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardEmoji: {
    fontSize: 38,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  cardDesc: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.dim,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.cosmic.purpleFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipIconText: {
    color: colors.cosmic.purpleLight,
    fontSize: 15,
    lineHeight: 18,
  },
  tipText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  btnWrap: {
    width: '100%',
    gap: spacing.sm,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cosmic.purple,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    shadowColor: colors.cosmic.purple,
    shadowOpacity: 0.65,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  ctaText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ctaIcon: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 22,
  },
  ctaHint: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
  },
});
