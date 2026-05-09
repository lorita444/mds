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
import { signupSchema, type SignupForm } from '../../lib/schemas';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: SignupForm) => {
    const { error } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: { data: { username: values.username.trim() } },
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
            Begin your journey
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.base,
              textAlign: 'center',
            }}
          >
            Create your universe with every study session
          </Text>
        </View>

        {/* Form */}
        <Card variant="elevated" padding={spacing.lg}>
          <View style={{ gap: spacing.md }}>
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Username"
                  placeholder="cosmiclearner"
                  value={value}
                  onChangeText={onChange}
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
                  placeholder="Min. 8 characters"
                  value={value}
                  onChangeText={onChange}
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
              label="Create Account"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />
          </View>
        </Card>

        {/* Starter kit info */}
        <View
          style={{
            backgroundColor: colors.cosmic.purpleFaint,
            borderWidth: 1,
            borderColor: colors.cosmic.purpleGlow,
            borderRadius: radius.lg,
            padding: spacing.md,
            gap: spacing.xs,
          }}
        >
          <Text
            style={{
              color: colors.cosmic.purpleLight,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.bold,
            }}
          >
            🎁 Your Starter Kit
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.sm,
              lineHeight: 20,
            }}
          >
            You'll receive a starter planet, a companion alien, and 50 crystals to begin your
            universe.
          </Text>
        </View>

        {/* Sign in link */}
        <Pressable
          onPress={() => router.replace('/(auth)/login' as never)}
          style={{ alignItems: 'center' }}
        >
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base }}>
            Already exploring?{' '}
            <Text
              style={{
                color: colors.cosmic.purpleLight,
                fontWeight: typography.weights.semibold,
              }}
            >
              Sign in
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
