import { useRef, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  View,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  type TextInput,
} from 'react-native';
import { APP_ICON } from '../../utils/assets';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { signupSchema, type SignupForm } from '../../lib/schemas';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { AuthLoadingOverlay } from '../../components/auth/AuthLoadingOverlay';

const SIGNUP_MESSAGES = [
  'Creating your account...',
  'Setting up your universe...',
  'Preparing your starter kit...',
];

function mapAuthError(msg: string): string {
  if (msg.includes('User already registered') || msg.includes('already been registered'))
    return 'An account with this email already exists. Try signing in instead.';
  if (msg.includes('Password should be at least') || msg.includes('password'))
    return 'Password must be at least 8 characters long.';
  if (msg.includes('Unable to validate email') || msg.includes('invalid format'))
    return 'Please enter a valid email address.';
  if (msg.includes('over_email_send_rate_limit') || msg.includes('rate limit'))
    return 'Too many attempts. Please wait a moment before trying again.';
  if (msg.includes('Network request failed') || msg.includes('fetch') || msg.includes('network'))
    return 'Connection failed. Please check your internet and try again.';
  return msg;
}

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [loadingMsg, setLoadingMsg] = useState(SIGNUP_MESSAGES[0]);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!isSubmitting) {
      setLoadingMsg(SIGNUP_MESSAGES[0]);
      return;
    }
    const t1 = setTimeout(() => setLoadingMsg(SIGNUP_MESSAGES[1]), 1400);
    const t2 = setTimeout(() => setLoadingMsg(SIGNUP_MESSAGES[2]), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isSubmitting]);

  const onSubmit = async (values: SignupForm) => {
    clearErrors();
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: { data: { username: values.username.trim() } },
    });

    if (error) {
      setError('root', { message: mapAuthError(error.message) });
      return;
    }

    if (data.session) {
      router.replace('/(auth)/welcome' as never);
    } else if (data.user && !data.session) {
      setNeedsConfirm(true);
    } else {
      router.replace('/(auth)/welcome' as never);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={APP_ICON} style={styles.appIcon} resizeMode="contain" />
            <Text style={styles.title}>Begin your journey</Text>
            <Text style={styles.subtitle}>
              Create your universe with every study session
            </Text>
          </View>

          <Card variant="elevated" padding={spacing.lg}>
            <View style={styles.formGap}>
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Username"
                    placeholder="cosmiclearner"
                    value={value}
                    onChangeText={v => { onChange(v); clearErrors('root'); }}
                    autoCapitalize="none"
                    autoComplete="username"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    error={errors.username?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input
                    ref={emailRef}
                    label="Email"
                    placeholder="you@example.com"
                    value={value}
                    onChangeText={v => { onChange(v); clearErrors('root'); }}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    error={errors.email?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <Input
                    ref={passwordRef}
                    label="Password"
                    placeholder="Min. 8 characters"
                    value={value}
                    onChangeText={v => { onChange(v); clearErrors('root'); }}
                    secure
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    error={errors.password?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <Input
                    ref={confirmRef}
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    value={value}
                    onChangeText={onChange}
                    secure
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    error={errors.confirmPassword?.message}
                  />
                )}
              />

              {errors.root?.message ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errors.root.message}</Text>
                </View>
              ) : null}

              {needsConfirm ? (
                <View style={[styles.errorBanner, { backgroundColor: 'rgba(13,148,136,0.12)', borderColor: 'rgba(13,148,136,0.3)' }]}>
                  <Text style={[styles.errorText, { color: '#5eead4' }]}>
                    ✅ Account created! Check your email to confirm your address, then sign in.
                  </Text>
                  <Pressable
                    onPress={() => router.replace('/(auth)/login' as never)}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: '#5eead4', fontSize: 13, fontWeight: '700' }}>Go to Sign In →</Text>
                  </Pressable>
                </View>
              ) : null}

              <Button
                label="Create Account"
                loadingLabel={loadingMsg}
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                fullWidth
                size="lg"
              />
            </View>
          </Card>

          <View style={styles.starterKit}>
            <Text style={styles.starterTitle}>Your Starter Kit</Text>
            <Text style={styles.starterBody}>
              {"You'll receive a starter planet, a companion alien, and 50 crystals to begin building your universe."}
            </Text>
          </View>

          <Pressable
            onPress={() => router.replace('/(auth)/login' as never)}
            style={styles.centerLink}
          >
            <Text style={styles.secondaryLink}>
              Already exploring?{' '}
              <Text style={styles.accentLink}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthLoadingOverlay
        visible={isSubmitting}
        message={loadingMsg}
        subtitle="Your universe is being born..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  appIcon: {
    width: 64,
    height: 64,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text.primary,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.heavy,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
    textAlign: 'center',
  },
  formGap: {
    gap: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.status.errorFaint,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  errorText: {
    color: colors.status.error,
    fontSize: typography.sizes.sm,
    lineHeight: 19,
  },
  starterKit: {
    backgroundColor: colors.cosmic.purpleFaint,
    borderWidth: 1,
    borderColor: colors.cosmic.purpleGlow,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  starterTitle: {
    color: colors.cosmic.purpleLight,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  starterBody: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  centerLink: {
    alignItems: 'center',
  },
  secondaryLink: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
  },
  accentLink: {
    color: colors.cosmic.purpleLight,
    fontWeight: typography.weights.semibold,
  },
});
