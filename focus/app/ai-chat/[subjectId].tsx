import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { AI_AVATAR } from '../../utils/assets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { getChatHistory, saveMessage, getMaterials, getChapters, getSubject } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import {
  answerWithContext,
  explainCourse,
  isOllamaRunning,
} from '../../lib/ollama';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import type { AIChatMessage } from '../../lib/types';

const QUICK_PROMPTS = [
  '📋 Summarize the key concepts',
  '📖 What are the main definitions?',
  '🗺️ Create a study plan',
  '🔍 Explain the most complex concept',
  '⭐ What should I focus on?',
];

export default function AIChatScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subjectName, setSubjectName] = useState('Subject');
  const [hasMaterials, setHasMaterials] = useState(false);
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [explaining, setExplaining] = useState(false);

  const chaptersRef = useRef<{ name: string }[]>([]);
  const summariesRef = useRef<string[]>([]);

  const load = useCallback(async () => {
    if (!subjectId || !user?.id) return;
    setLoading(true);
    try {
      const [history, materials, subjectRes, chapters] = await Promise.all([
        getChatHistory(subjectId),
        getMaterials(subjectId),
        getSubject(subjectId),
        getChapters(subjectId),
      ]);
      setMessages(history);
      setHasMaterials(materials.length > 0);
      setSubjectName(subjectRes?.name ?? 'Subject');
      chaptersRef.current = chapters;
      summariesRef.current = materials
        .map((m) => m.content_text ?? m.summary)
        .filter(Boolean) as string[];
    } finally {
      setLoading(false);
    }
  }, [subjectId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Check Ollama status on mount
  useEffect(() => {
    isOllamaRunning().then(setOllamaOk);
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !user?.id || !subjectId || sending) return;

    const userMsg: AIChatMessage = {
      id: `tmp-${Date.now()}`,
      subject_id: subjectId,
      user_id: user.id,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      await saveMessage(subjectId, user.id, 'user', text.trim());

      const historyForAI = messages.slice(-6).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const reply = await answerWithContext(
        text.trim(),
        summariesRef.current,
        subjectName,
        historyForAI,
      );

      const savedReply = await saveMessage(subjectId, user.id, 'assistant', reply);
      if (savedReply) {
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== userMsg.id);
          return [
            ...without,
            { ...userMsg, id: `saved-user-${Date.now()}` },
            savedReply,
          ];
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI response error';
      Alert.alert('AI Error', `${msg}\n\nMake sure Ollama is running on your computer.`);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleExplainCourse = async () => {
    if (explaining) return;
    setExplaining(true);

    const loadingMsg: AIChatMessage = {
      id: `explain-loading`,
      subject_id: subjectId!,
      user_id: user!.id,
      role: 'assistant',
      content: '🔄 Generating a complete course explanation...',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, {
      id: `user-explain-${Date.now()}`,
      subject_id: subjectId!,
      user_id: user!.id,
      role: 'user',
      content: '📖 Explain the full course in a clear structure',
      created_at: new Date().toISOString(),
    }, loadingMsg]);

    try {
      await saveMessage(subjectId!, user!.id, 'user', '📖 Explain the full course in a clear structure');

      const explanation = await explainCourse(
        subjectName,
        chaptersRef.current,
        summariesRef.current,
      );

      const savedReply = await saveMessage(subjectId!, user!.id, 'assistant', explanation);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== 'explain-loading');
        return savedReply
          ? [...without, savedReply]
          : [...without, { ...loadingMsg, id: `explain-${Date.now()}`, content: explanation }];
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== 'explain-loading'));
      Alert.alert('Error', 'Could not generate the explanation. Make sure Ollama is running.');
    } finally {
      setExplaining(false);
    }
  };

  if (loading) return <LoadingState message="Loading chat..." />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Chat</Text>
          <Text style={styles.headerSub}>{subjectName}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: ollamaOk === false ? '#ef4444' : ollamaOk ? '#22c55e' : '#f59e0b' }]} />
          <Image source={AI_AVATAR} style={{ width: 28, height: 28 }} resizeMode="contain" />
        </View>
      </View>

      {/* Ollama warning */}
      {ollamaOk === false && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ Ollama is not running. Start it on your computer: <Text style={{ fontWeight: '700' }}>ollama serve</Text>
          </Text>
        </View>
      )}

      {/* No materials notice */}
      {!hasMaterials && ollamaOk !== false && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            💡 No materials uploaded. Upload PDFs or notes for more accurate answers.
          </Text>
        </View>
      )}

      {/* Explain Course Button */}
      <Pressable
        onPress={handleExplainCourse}
        disabled={explaining || ollamaOk === false}
        style={({ pressed }) => [
          styles.explainBtn,
          { opacity: pressed || explaining || ollamaOk === false ? 0.6 : 1 },
        ]}
      >
        <Text style={styles.explainBtnText}>
          {explaining ? '⏳ Generating...' : '📖 Explain Full Course'}
        </Text>
      </Pressable>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Image source={AI_AVATAR} style={{ width: 72, height: 72 }} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Ask me anything about {subjectName}</Text>
            <Text style={styles.emptySubtitle}>
              {hasMaterials
                ? 'I have access to your materials and will answer from them.'
                : 'Use the button above for a complete course explanation.'}
            </Text>
            <View style={styles.quickPrompts}>
              {QUICK_PROMPTS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => sendMessage(p)}
                  style={({ pressed }) => [styles.quickPrompt, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.quickPromptText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.messageBubbleWrapper,
              { alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' },
            ]}
          >
            {m.role === 'assistant' && (
              <Text style={styles.assistantLabel}>StudyVerse AI · {subjectName}</Text>
            )}
            <View
              style={[
                styles.messageBubble,
                m.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text style={styles.messageText} selectable>
                {m.content}
              </Text>
            </View>
          </View>
        ))}

        {sending && (
          <View style={[styles.messageBubbleWrapper, { alignSelf: 'flex-start' }]}>
            <View style={[styles.messageBubble, styles.aiBubble, { flexDirection: 'row', gap: spacing.sm }]}>
              <ActivityIndicator size="small" color={colors.cosmic.purpleLight} />
              <Text style={styles.messageText}>Thinking…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="Ask about your materials..."
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
        </View>
        <Pressable
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: !input.trim() || sending ? colors.bg.card : colors.cosmic.purple,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 18, color: colors.text.primary }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.text.muted, fontSize: typography.sizes.lg },
  headerTitle: { color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
  headerSub: { color: colors.text.muted, fontSize: typography.sizes.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  warningBanner: {
    margin: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { color: '#fca5a5', fontSize: typography.sizes.sm },
  infoBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  infoText: { color: colors.status.warning, fontSize: typography.sizes.xs },
  explainBtn: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.cosmic.purpleFaint,
    borderWidth: 1,
    borderColor: colors.cosmic.purpleGlow,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  explainBtnText: {
    color: colors.cosmic.purpleLight,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  emptyState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  emptySubtitle: { color: colors.text.secondary, fontSize: typography.sizes.sm, textAlign: 'center', lineHeight: 20 },
  quickPrompts: { width: '100%', gap: spacing.xs },
  quickPrompt: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  quickPromptText: { color: colors.text.secondary, fontSize: typography.sizes.sm },
  messageBubbleWrapper: { maxWidth: '85%', gap: 4 },
  assistantLabel: { color: colors.text.muted, fontSize: typography.sizes.xs, marginLeft: 4 },
  messageBubble: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: colors.cosmic.purple,
    borderColor: colors.cosmic.purpleGlow,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.bg.elevated,
    borderColor: colors.bg.cardBorder,
    borderBottomLeftRadius: 4,
  },
  messageText: { color: colors.text.primary, fontSize: typography.sizes.base, lineHeight: 22 },
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.bg.cardBorder,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.bg.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
