import {
  Modal as RNModal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../utils/theme';

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  scrollable?: boolean;
};

export function Modal({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  scrollable = false,
}: ModalProps) {
  const Content = scrollable ? ScrollView : View;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg.overlay,
            justifyContent: 'flex-end',
          }}
        >
          {/* KeyboardAvoidingView wraps the sheet so it lifts when keyboard opens */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Plain View — no Pressable wrapper so TextInput gets the first tap */}
            <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: colors.bg.elevated,
                borderTopLeftRadius: radius.xxl,
                borderTopRightRadius: radius.xxl,
                borderTopWidth: 1,
                borderTopColor: colors.bg.cardBorder,
                borderLeftWidth: 1,
                borderLeftColor: colors.bg.cardBorder,
                borderRightWidth: 1,
                borderRightColor: colors.bg.cardBorder,
                paddingTop: spacing.md,
                paddingBottom: spacing.xl + 8,
              }}
            >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.text.dim,
                borderRadius: radius.full,
                alignSelf: 'center',
                marginBottom: spacing.md,
              }}
            />

            {(title || showCloseButton) && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.lg,
                  marginBottom: spacing.md,
                }}
              >
                {title && (
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: typography.sizes.lg,
                      fontWeight: typography.weights.bold,
                    }}
                  >
                    {title}
                  </Text>
                )}
                {showCloseButton && (
                  <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    style={{
                      backgroundColor: colors.bg.card,
                      borderWidth: 1,
                      borderColor: colors.bg.cardBorder,
                      borderRadius: radius.full,
                      width: 34,
                      height: 34,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text.secondary, fontSize: 18, lineHeight: 20 }}>
                      ×
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            <Content
              style={scrollable ? { maxHeight: 480 } : undefined}
              {...(scrollable ? { keyboardShouldPersistTaps: 'handled' } : {})}
            >
              {children}
            </Content>
            </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}
