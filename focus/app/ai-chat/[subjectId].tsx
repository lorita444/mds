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
} from 'react-native';
import { AI_AVATAR } from '../../utils/assets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { getChatHistory, saveMessage, getMaterials } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { answerWithContext, generateFlashcardsFromText } from '../../lib/openai';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import type { AIChatMessage } from '../../lib/types';

async function fetchRelevantChunks(
  subjectId: string,
  userId: string,
  query: string,
): Promise<string[]> {
  // Get embedding for query
  const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? ''}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: query }),
  });
  if (!embeddingRes.ok) return [];
  const embJson = await embeddingRes.json();
  const embedding = embJson.data[0].embedding;

  const { data } = await supabase.rpc('match_material_chunks', {
    p_query_embedding: embedding,
    p_subject_id: subjectId,
    p_user_id: userId,
    p_match_count: 5,
  });
  return (data ?? []).map((row: { content: string }) => row.content);
}

const QUICK_PROMPTS = [
  'Summarize key concepts',
  'What are the main definitions?',
  'Create a study plan for this subject',
  'Explain the most complex topic',
  'What should I focus on?',
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

  const load = useCallback(async () => {
    if (!subjectId || !user?.id) return;
    setLoading(true);
    try {
      const [history, materials, subjectRes] = await Promise.all([
        getChatHistory(subjectId),
        getMaterials(subjectId),
        supabase.from('subjects').select('name').eq('id', subjectId).single(),
      ]);
      setMessages(history);
      setHasMaterials(materials.length > 0);
      setSubjectName(subjectRes.data?.name ?? 'Subject');
    } finally {
      setLoading(false);
    }
  }, [subjectId, user?.id]);

  useEffect(() => { load(); }, [load]);

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
      // Save user message to DB
      await saveMessage(subjectId, user.id, 'user', text.trim());

      // Fetch relevant context chunks
      const contextChunks = hasMaterials
        ? await fetchRelevantChunks(subjectId, user.id, text.trim())
        : [];

      // Build chat history for context (last 6 messages)
      const historyForAI = messages.slice(-6).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Get AI response
      const reply = await answerWithContext(
        text.trim(),
        contextChunks,
        subjectName,
        historyForAI,
      );

      // Save AI reply
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
      Alert.alert('AI Error', e instanceof Error ? e.message : 'Failed to get AI response');
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState message="Loading chat..." />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.bg.cardBorder,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.lg }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }}>
            AI Chat
          </Text>
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
            {subjectName}
          </Text>
        </View>
        <Image source={AI_AVATAR} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </View>

      {/* No materials warning */}
      {!hasMaterials && (
        <View
          style={{
            margin: spacing.md,
            backgroundColor: colors.status.warningFaint,
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.3)',
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        >
          <Text style={{ color: colors.status.warning, fontSize: typography.sizes.sm }}>
            ⚠️ No materials uploaded yet. Upload PDFs or notes so the AI can answer from your content.
          </Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          gap: spacing.sm,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Welcome message */}
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <Image source={AI_AVATAR} style={{ width: 72, height: 72 }} resizeMode="contain" />
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, textAlign: 'center' }}>
              Ask me anything about {subjectName}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, textAlign: 'center', lineHeight: 20 }}>
              {hasMaterials
                ? 'I have access to your uploaded materials and will answer from them.'
                : 'Upload materials first for context-aware answers.'}
            </Text>

            {/* Quick prompts */}
            <View style={{ width: '100%', gap: spacing.xs }}>
              {QUICK_PROMPTS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => sendMessage(p)}
                  style={({ pressed }) => ({
                    backgroundColor: colors.bg.card,
                    borderWidth: 1,
                    borderColor: colors.bg.cardBorder,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Chat messages */}
        {messages.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            {m.role === 'assistant' && (
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, marginBottom: 4, marginLeft: 4 }}>
                AI · {subjectName}
              </Text>
            )}
            <View
              style={{
                backgroundColor:
                  m.role === 'user' ? colors.cosmic.purple : colors.bg.elevated,
                borderRadius: radius.lg,
                borderBottomRightRadius: m.role === 'user' ? 4 : radius.lg,
                borderBottomLeftRadius: m.role === 'assistant' ? 4 : radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor:
                  m.role === 'user'
                    ? colors.cosmic.purpleGlow
                    : colors.bg.cardBorder,
              }}
            >
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.base,
                  lineHeight: 22,
                }}
                selectable
              >
                {m.content}
              </Text>
            </View>
          </View>
        ))}

        {/* Sending indicator */}
        {sending && (
          <View style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <View
              style={{
                backgroundColor: colors.bg.elevated,
                borderRadius: radius.lg,
                borderBottomLeftRadius: 4,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.bg.cardBorder,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <ActivityIndicator size="small" color={colors.cosmic.purpleLight} />
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
                Thinking...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.bg.cardBorder,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          backgroundColor: colors.bg.primary,
        }}
      >
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
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor:
              !input.trim() || sending ? colors.bg.card : colors.cosmic.purple,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ fontSize: 18 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
