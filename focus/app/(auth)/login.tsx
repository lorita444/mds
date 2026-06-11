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
import { loginSchema, type LoginForm } from '../../lib/schemas';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { AuthLoadingOverlay } from '../../components/auth/AuthLoadingOverlay';

type Mode = 'login' | 'forgot' | 'forgot-sent';

const LOGIN_MESSAGES = [
  'Signing you in...',
  'Securing your session...',
  'Loading your universe...',
];

const FORGOT_MESSAGES = [
  'Sending reset link...',
  'Almost done...',
];

function mapAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials'))
    return 'Incorrect email or password. Please check and try again.';
  if (msg.includes('Email not confirmed'))
    return 'Please confirm your email address before signing in. Check your inbox.';
  if (msg.includes('Too many requests') || msg.includes('rate limit') || msg.includes('over_email'))
    return 'Too many attempts. Please wait a moment before trying again.';
  if (msg.includes('Network request failed') || msg.includes('fetch') || msg.includes('network'))
    return 'Connection failed. Please check your internet and try again.';
  if (msg.includes('User not found'))
    return 'No account found with this email address.';
  return msg;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const forgotEmailRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<Mode>('login');
  const [loadingMsg, setLoadingMsg] = useState(LOGIN_MESSAGES[0]);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [sentEmail, setSentEmail] = useState('');

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!isSubmitting) {
      setLoadingMsg(LOGIN_MESSAGES[0]);
      return;
    }
    const t1 = setTimeout(() => setLoadingMsg(LOGIN_MESSAGES[1]), 1400);
    const t2 = setTimeout(() => setLoadingMsg(LOGIN_MESSAGES[2]), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isSubmitting]);

  const onSubmit = async (values: LoginForm) => {
    clearErrors();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });
    if (error) {
      setError('root', { message: mapAuthError(error.message) });
    }
  };

  const onForgotSubmit = async () => {
    const email = forgotEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    const t = setTimeout(() => setLoadingMsg(FORGOT_MESSAGES[1]), 1200);
    try {
      setLoadingMsg(FORGOT_MESSAGES[0]);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setForgotError(mapAuthError(error.message));
      } else {
        setSentEmail(email);
        setMode('forgot-sent');
      }
    } finally {
      clearTimeout(t);
      setForgotLoading(false);
      setLoadingMsg(LOGIN_MESSAGES[0]);
    }
  };

  const goToLogin = () => {
    setMode('login');
    setForgotEmail('');
    setForgotError('');
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
          {/* Header */}
          <View style={styles.header}>
            <Image source={APP_ICON} style={styles.appIcon} resizeMode="contain" />
            {mode === 'login' && (
              <>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Your universe is waiting</Text>
              </>
            )}
            {mode === 'forgot' && (
              <>
                <Text style={styles.title}>Reset password</Text>
                <Text style={styles.subtitle}>
                  {"We'll send a reset link to your email"}
                </Text>
              </>
            )}
            {mode === 'forgot-sent' && (
              <>
                <Text style={styles.title}>Check your inbox</Text>
                <Text style={styles.subtitle}>Reset link sent to {sentEmail}</Text>
              </>
            )}
          </View>

          {/* Login form */}
          {mode === 'login' && (
            <Card variant="elevated" padding={spacing.lg}>
              <View style={styles.formGap}>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="Email"
                      placeholder="you@example.com"
                      value={value}
                      onChangeText={onChange}
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
                      placeholder="Your password"
                      value={value}
                      onChangeText={onChange}
                      secure
                      textContentType="password"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                      error={errors.password?.message}
                    />
                  )}
                />

                {errors.root?.message ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{errors.root.message}</Text>
                  </View>
                ) : null}

                <Button
                  label="Sign In"
                  loadingLabel={loadingMsg}
                  onPress={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                  fullWidth
                  size="lg"
                />

                <Pressable
                  onPress={() => { clearErrors(); setMode('forgot'); }}
                  style={styles.centerLink}
                >
                  <Text style={styles.mutedLink}>Forgot password?</Text>
                </Pressable>
              </View>
            </Card>
          )}

          {/* Forgot password form */}
          {mode === 'forgot' && (
            <Card variant="elevated" padding={spacing.lg}>
              <View style={styles.formGap}>
                <Input
                  ref={forgotEmailRef}
                  label="Email address"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChangeText={v => { setForgotEmail(v); setForgotError(''); }}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={onForgotSubmit}
                  error={forgotError || undefined}
                />

                <Button
                  label="Send Reset Link"
                  loadingLabel={loadingMsg}
                  onPress={onForgotSubmit}
                  loading={forgotLoading}
                  fullWidth
                  size="lg"
                />

                <Pressable onPress={goToLogin} style={styles.centerLink}>
                  <Text style={styles.mutedLink}>Back to sign in</Text>
                </Pressable>
              </View>
            </Card>
          )}

          {/* Forgot sent success */}
          {mode === 'forgot-sent' && (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✉</Text>
              <Text style={styles.successBody}>
                {"A password reset link has been sent. Check your spam folder if you don't see it within a minute."}
              </Text>
              <Button
                label="Back to Sign In"
                variant="secondary"
                onPress={goToLogin}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {/* Sign up link */}
          {mode === 'login' && (
            <Pressable
              onPress={() => router.push('/(auth)/signup' as never)}
              style={styles.centerLink}
            >
              <Text style={styles.secondaryLink}>
                No account yet?{' '}
                <Text style={styles.accentLink}>Create your universe</Text>
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthLoadingOverlay visible={isSubmitting || forgotLoading} message={loadingMsg} />
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  errorText: {
    flex: 1,
    color: colors.status.error,
    fontSize: typography.sizes.sm,
    lineHeight: 19,
  },
  centerLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  mutedLink: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    textDecorationLine: 'underline',
    textDecorationColor: colors.text.muted,
  },
  secondaryLink: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
  },
  accentLink: {
    color: colors.cosmic.purpleLight,
    fontWeight: typography.weights.semibold,
    textDecorationLine: 'underline',
    textDecorationColor: colors.cosmic.purpleLight,
  },
  successCard: {
    backgroundColor: colors.status.successFaint,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  successIcon: {
    fontSize: 40,
  },
  successBody: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
