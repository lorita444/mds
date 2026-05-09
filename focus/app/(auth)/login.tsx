import { useRef } from 'react';
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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });
    if (error) {
      setError('root', { message: error.message });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.md,
          justifyContent: 'center',
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Image source={APP_ICON} style={{ width: 64, height: 64 }} resizeMode="contain" />
          <Text
            style={{
              color: colors.text.primary,
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.heavy,
              textAlign: 'center',
            }}
          >
            Welcome back
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.base,
              textAlign: 'center',
            }}
          >
            Your universe is waiting
          </Text>
        </View>

        {/* Form */}
        <Card variant="elevated" padding={spacing.lg}>
          <View style={{ gap: spacing.md }}>
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
              <View
                style={{
                  backgroundColor: colors.status.errorFaint,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                }}
              >
                <Text style={{ color: colors.status.error, fontSize: typography.sizes.sm }}>
                  {errors.root.message}
                </Text>
              </View>
            ) : null}

            <Button
              label="Sign In"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />

            <Pressable onPress={() => {}} style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
                Forgot password?
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Sign up link */}
        <Pressable
          onPress={() => router.push('/(auth)/signup' as never)}
          style={{ alignItems: 'center' }}
        >
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base }}>
            No account yet?{' '}
            <Text
              style={{
                color: colors.cosmic.purpleLight,
                fontWeight: typography.weights.semibold,
              }}
            >
              Create your universe
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
