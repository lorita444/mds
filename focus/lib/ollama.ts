/**
 * Ollama local LLM integration — proxied through the Express backend.
 *
 * All calls go to the backend's /api/ollama/* routes so the phone
 * doesn't need a direct path to port 11434 (Ollama binds to 127.0.0.1).
 *
 * The backend must be running and Ollama must be running on the same machine.
 * Start Ollama: ollama serve
 * Recommended model: ollama pull llama3.2
 */

import { API_URL } from './supabase';

// Strip the trailing /api to get the base host, then use /api/ollama/...
const OLLAMA_PROXY = `${API_URL}/ollama`;

const CHAT_MODEL =
  process.env.EXPO_PUBLIC_OLLAMA_MODEL ?? 'llama3.2';

type Role = 'system' | 'user' | 'assistant';
type Message = { role: Role; content: string };

// ── CORE CHAT ──────────────────────────────────────────────────

export async function ollamaChat(
  messages: Message[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const res = await fetch(`${OLLAMA_PROXY}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.4,
        num_predict: opts.maxTokens ?? 1024,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama error: ${text}`);
  }

  const json = await res.json();
  return (json.message?.content ?? '') as string;
}

// ── SUBJECT Q&A WITH CONTEXT ───────────────────────────────────

export async function answerWithContext(
  question: string,
  contextChunks: string[],
  subjectName: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const context = contextChunks.join('\n\n---\n\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `You are an expert study assistant for the subject "${subjectName}".
Respond clearly, concisely, and in the same language as the question.
If you have context from uploaded materials, base your answer on them. If not, say so honestly.
Use bullet points or numbered lists when they aid clarity.
Never invent information. Encourage deep understanding, not rote memorization.`,
    },
    ...(context.trim()
      ? [
          {
            role: 'system' as Role,
            content: `Context from uploaded materials:\n\n${context.slice(0, 8000)}`,
          },
        ]
      : []),
    ...chatHistory.slice(-8).map((m) => ({ role: m.role as Role, content: m.content })),
    { role: 'user', content: question },
  ];

  return ollamaChat(messages, { temperature: 0.4, maxTokens: 1024 });
}

// ── EXPLAIN FULL COURSE ────────────────────────────────────────

export async function explainCourse(
  subjectName: string,
  chapters: { name: string }[],
  materialSummaries: string[],
): Promise<string> {
  const chaptersText = chapters.map((c, i) => `  ${i + 1}. ${c.name}`).join('\n');
  const summariesText = materialSummaries.slice(0, 5).join('\n\n---\n\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `You are an expert teacher. You explain complex subjects clearly, structurally, and completely.
Always respond in the same language as the subject name.
Your response must include:
1. Introduction and context (why this subject matters)
2. Core concepts (explained simply, with examples)
3. Connections between chapters
4. Key takeaways
5. Study tips for this subject
Use clear headings (##), bullet points, and concrete examples.`,
    },
    {
      role: 'user',
      content: `Explain the subject "${subjectName}" completely and in a structured way.

Chapters:
${chaptersText || '  (no chapters defined yet)'}

${summariesText ? `Available material summaries:\n${summariesText.slice(0, 6000)}` : ''}

Create a complete, pedagogical, and well-structured explanation.`,
    },
  ];

  return ollamaChat(messages, { temperature: 0.5, maxTokens: 2048 });
}

// ── GENERATE FLASHCARDS ────────────────────────────────────────

export async function generateFlashcardsFromText(
  text: string,
  subjectName: string,
  chapterName?: string,
  count = 10,
): Promise<{ question: string; answer: string; difficulty: 'easy' | 'medium' | 'hard' }[]> {
  const context = chapterName
    ? `materia "${subjectName}", capitolul "${chapterName}"`
    : `materia "${subjectName}"`;

  const reply = await ollamaChat(
    [
      {
        role: 'system',
        content: `You are a flashcard generator for ${context}.
Return ONLY a valid JSON array, no extra text, no markdown.
Format: [{"question":"...","answer":"...","difficulty":"easy"|"medium"|"hard"}]`,
      },
      {
        role: 'user',
        content: `Generate ${count} high-quality flashcards from this material:\n\n${text.slice(0, 8000)}`,
      },
    ],
    { temperature: 0.5, maxTokens: 2048 },
  );

  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found');
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('AI a returnat un format invalid pentru flashcard-uri');
  }
}

// ── GENERATE QUIZ ─────────────────────────────────────────────

export async function generateQuizFromContext(
  context: string,
  subjectName: string,
  questionCount = 5,
): Promise<
  {
    question_text: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer';
    options: string[] | null;
    correct_answer: string;
  }[]
> {
  const reply = await ollamaChat(
    [
      {
        role: 'system',
        content: `You are a quiz generator for "${subjectName}".
Generate exactly ${questionCount} questions. Return ONLY valid JSON, no extra text.
Format: [{"question_text":"...","question_type":"multiple_choice"|"true_false"|"short_answer","options":["A","B","C","D"]|null,"correct_answer":"..."}]
For multiple_choice: 4 options, correct_answer = one of them.`,
      },
      { role: 'user', content: context.slice(0, 8000) },
    ],
    { temperature: 0.4, maxTokens: 2048 },
  );

  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found');
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('AI a returnat un format invalid pentru quiz');
  }
}

// ── ESTIMATE STUDY TIME ────────────────────────────────────────

export async function estimateStudyDuration(
  materialSummaries: string[],
  subjectName: string,
): Promise<{ minutes: number; reasoning: string }> {
  const text = materialSummaries.join('\n\n---\n\n').slice(0, 6000);
  const reply = await ollamaChat(
    [
      {
        role: 'system',
        content: `You are a study planner. Estimate the duration of a focused study session for "${subjectName}".
Return ONLY JSON: {"minutes":<number>,"reasoning":"<one sentence>"}`,
      },
      { role: 'user', content: text || 'No materials available.' },
    ],
    { temperature: 0.3, maxTokens: 256 },
  );

  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1) throw new Error('No JSON');
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { minutes: 45, reasoning: 'Estimated based on general subject complexity.' };
  }
}

// ── TEXT CHUNKING ──────────────────────────────────────────────

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

// ── EXPLAIN WRONG ANSWERS ─────────────────────────────────────

export async function explainWrongAnswers(
  wrongs: { question: string; correctAnswer: string; userAnswer: string }[],
  subjectName: string,
): Promise<{ question: string; explanation: string }[]> {
  if (wrongs.length === 0) return [];
  const list = wrongs
    .map(
      (w, i) =>
        `${i + 1}. Q: "${w.question}"\n   Corect: "${w.correctAnswer}"\n   Răspuns dat: "${w.userAnswer || '(niciun răspuns)'}"`,
    )
    .join('\n\n');
  const reply = await ollamaChat(
    [
      {
        role: 'system',
        content: `You are a study assistant for "${subjectName}". For each wrong answer, give a SHORT explanation (1-2 sentences) of why the correct answer is correct. Return ONLY a valid JSON array, no extra text: [{"question":"...","explanation":"..."}]. One item per question, in the same order.`,
      },
      { role: 'user', content: list },
    ],
    { temperature: 0.3, maxTokens: 1024 },
  );
  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array');
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return wrongs.map((w) => ({ question: w.question, explanation: 'No explanation available.' }));
  }
}

// ── RECOMMEND WEAK CHAPTERS ────────────────────────────────────

export function recommendWeakChapters(
  quizHistory: { chapterIds: string[]; correctAnswers: number; totalQuestions: number }[],
  chapters: { id: string; name: string }[],
): { chapterId: string; reason: string }[] {
  if (quizHistory.length === 0 || chapters.length === 0) return [];

  const chapterStats = chapters
    .map((ch) => {
      const relevant = quizHistory.filter((h) => h.chapterIds.includes(ch.id));
      if (relevant.length === 0) return null;
      const totalCorrect = relevant.reduce((s, h) => s + h.correctAnswers, 0);
      const totalQ = relevant.reduce((s, h) => s + h.totalQuestions, 0);
      const pct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : null;
      if (pct === null) return null;
      return { id: ch.id, pct };
    })
    .filter(Boolean) as { id: string; pct: number }[];

  return chapterStats
    .filter((c) => c.pct < 70)
    .map((c) => ({ chapterId: c.id, reason: `${c.pct}% on past quizzes` }));
}

// ── GENERATE STUDY PLAN ────────────────────────────────────────

export async function generateStudyPlan(
  subjects: { name: string; description: string | null }[],
  examDate: string,
  todayDate: string,
  hoursPerDay: number,
): Promise<{ day: string; tasks: { subject: string; task: string; minutes: number }[] }[]> {
  const daysLeft = Math.max(
    1,
    Math.round((new Date(examDate).getTime() - new Date(todayDate).getTime()) / 86400000),
  );
  const maxDays = Math.min(daysLeft, 14);
  const subjectList = subjects
    .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ''}`)
    .join('\n');

  const reply = await ollamaChat(
    [
      {
        role: 'system',
        content: `You are a study planner. Generate a plan for ${daysLeft} days (starting tomorrow, until ${examDate}), with ${hoursPerDay}h available per day. Return ONLY a valid JSON array, no extra text (max ${maxDays} days): [{"day":"YYYY-MM-DD","tasks":[{"subject":"...","task":"...","minutes":<number>}]}]. Tasks should be specific (e.g., "Review Chapter 2"). Distribute subjects evenly.`,
      },
      { role: 'user', content: `Subjects:\n${subjectList}` },
    ],
    { temperature: 0.4, maxTokens: 2048 },
  );
  try {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array');
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
}

// ── HEALTH CHECK ───────────────────────────────────────────────

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_PROXY}/health`, { signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    return json.ok === true;
  } catch {
    return false;
  }
}
