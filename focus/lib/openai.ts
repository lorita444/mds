/**
 * OpenAI API calls — kept separate from db.ts so they can be swapped.
 * All calls go directly to OpenAI REST API (no SDK needed in React Native).
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const BASE = 'https://api.openai.com/v1';

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };
}

// ── EMBEDDINGS ───────────────────────────────────────────────

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.statusText}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

// ── CHAT COMPLETION ──────────────────────────────────────────

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatCompletion(
  messages: Message[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI error: ${res.statusText}`);
  }
  const json = await res.json();
  return json.choices[0].message.content as string;
}

// ── SUBJECT AI ACTIONS ───────────────────────────────────────

export async function summarizeMaterial(
  materialText: string,
  subjectName: string,
): Promise<string> {
  return chatCompletion([
    {
      role: 'system',
      content: `You are a concise study assistant for the subject "${subjectName}". Summarize the provided material clearly. Use short paragraphs. Focus on key concepts, definitions, and relationships. Do not pad with introductory phrases.`,
    },
    { role: 'user', content: `Summarize this material:\n\n${materialText.slice(0, 12000)}` },
  ]);
}

export async function generateFlashcardsFromText(
  text: string,
  subjectName: string,
  chapterName?: string,
  count = 10,
): Promise<{ question: string; answer: string; difficulty: 'easy' | 'medium' | 'hard' }[]> {
  const context = chapterName ? `subject "${subjectName}", chapter "${chapterName}"` : `subject "${subjectName}"`;
  const reply = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are a flashcard generator for ${context}. Output ONLY a JSON array, no extra text. Each item: { "question": "...", "answer": "...", "difficulty": "easy"|"medium"|"hard" }.`,
      },
      {
        role: 'user',
        content: `Generate ${count} high-quality flashcards from this material:\n\n${text.slice(0, 10000)}`,
      },
    ],
    { temperature: 0.5 },
  );
  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid flashcard format');
  }
}

export async function generateQuizFromContext(
  context: string,
  subjectName: string,
  questionCount = 5,
): Promise<{
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options: string[] | null;
  correct_answer: string;
}[]> {
  const reply = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are a quiz generator for "${subjectName}". Generate exactly ${questionCount} quiz questions from the provided study material. Output ONLY a JSON array, no extra text. Each item: { "question_text": "...", "question_type": "multiple_choice"|"true_false"|"short_answer", "options": ["A","B","C","D"] or null, "correct_answer": "..." }. For multiple_choice, options must have 4 items and correct_answer must be one of them.`,
      },
      { role: 'user', content: context.slice(0, 12000) },
    ],
    { temperature: 0.4 },
  );
  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid quiz format');
  }
}

export async function estimateStudyDuration(
  materialSummaries: string[],
  subjectName: string,
): Promise<{ minutes: number; reasoning: string }> {
  const text = materialSummaries.join('\n\n---\n\n').slice(0, 8000);
  const reply = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are a study planning assistant. Based on the provided material summaries, estimate how long a focused study session should take for "${subjectName}". Be realistic. Output ONLY JSON: { "minutes": <number>, "reasoning": "<one sentence>" }`,
      },
      { role: 'user', content: text },
    ],
    { temperature: 0.3 },
  );
  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { minutes: 45, reasoning: 'Estimated based on material complexity.' };
  }
}

export async function answerWithContext(
  question: string,
  contextChunks: string[],
  subjectName: string,
  chatHistory: Message[],
): Promise<string> {
  const context = contextChunks.join('\n\n---\n\n');
  const systemPrompt = `You are a helpful, concise study assistant for "${subjectName}".
Answer questions using the provided context.
If the answer is not in the context, say so honestly — do not invent information.
Use clear language. Encourage active recall. Keep answers focused.
When helpful, mention related concepts from the material.`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'system',
      content: `Context from uploaded materials:\n\n${context.slice(0, 10000)}`,
    },
    ...chatHistory.slice(-8),
    { role: 'user', content: question },
  ];

  return chatCompletion(messages, { maxTokens: 768 });
}

// ── TEXT EXTRACTION ───────────────────────────────────────────

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}
