/**
 * Ollama local LLM integration.
 *
 * Ollama exposes an OpenAI-compatible REST API at http://localhost:11434
 * Set EXPO_PUBLIC_OLLAMA_URL in .env to override (e.g. for physical devices
 * use your machine's LAN IP: http://192.168.1.x:11434)
 *
 * Recommended models (run: ollama pull <model>):
 *   - llama3.2        — fast, great for Q&A and explanations
 *   - mistral         — balanced speed/quality
 *   - qwen2.5:7b      — excellent structured output
 *   - nomic-embed-text — for embeddings (if vector search needed)
 */

const OLLAMA_BASE =
  process.env.EXPO_PUBLIC_OLLAMA_URL ?? 'http://localhost:11434';

const CHAT_MODEL =
  process.env.EXPO_PUBLIC_OLLAMA_MODEL ?? 'llama3.2';

type Role = 'system' | 'user' | 'assistant';
type Message = { role: Role; content: string };

// ── CORE CHAT ──────────────────────────────────────────────────

export async function ollamaChat(
  messages: Message[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
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
      content: `Ești un asistent de studiu expert pentru materia "${subjectName}".
Răspunde clar, concis și structurat în aceeași limbă cu întrebarea.
Dacă ai context din materiale, bazează-te pe el. Dacă nu, spune-o sincer.
Folosește bullet points sau numerotare când ajută la claritate.
Nu inventa informații. Încurajează înțelegerea profundă, nu memorarea mecanică.`,
    },
    ...(context.trim()
      ? [
          {
            role: 'system' as Role,
            content: `Context din materialele uploadate:\n\n${context.slice(0, 8000)}`,
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
      content: `Ești un profesor expert. Explici materii complexe într-un mod clar, structurat și complet.
Răspunde ÎNTOTDEAUNA în aceeași limbă cu materia (română dacă e în română, engleză dacă e în engleză).
Structura ta trebuie să conțină:
1. Introducere și context (de ce e importantă materia)
2. Concepte fundamentale (explicate simplu, cu exemple)
3. Conexiuni între capitole
4. Puncte cheie de reținut
5. Sfaturi de studiu pentru această materie
Folosește titluri clare (##), bullet points și exemple concrete.`,
    },
    {
      role: 'user',
      content: `Explică-mi materia "${subjectName}" în mod complet și structurat.

Capitole:
${chaptersText || '  (niciun capitol definit încă)'}

${summariesText ? `Rezumate materiale disponibile:\n${summariesText.slice(0, 6000)}` : ''}

Creează o explicație completă, pedagogică și bine structurată.`,
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
        content: `Ești un generator de flashcard-uri pentru ${context}.
Returnează DOAR un array JSON valid, fără text suplimentar, fără markdown.
Format: [{"question":"...","answer":"...","difficulty":"easy"|"medium"|"hard"}]`,
      },
      {
        role: 'user',
        content: `Generează ${count} flashcard-uri de calitate din acest material:\n\n${text.slice(0, 8000)}`,
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
        content: `Ești un generator de quiz pentru "${subjectName}".
Generează exact ${questionCount} întrebări. Returnează DOAR JSON valid, fără text.
Format: [{"question_text":"...","question_type":"multiple_choice"|"true_false"|"short_answer","options":["A","B","C","D"]|null,"correct_answer":"..."}]
Pentru multiple_choice: 4 opțiuni, correct_answer = una dintre ele.`,
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
        content: `Ești un planificator de studiu. Estimează durata unei sesiuni de studiu focusată pentru "${subjectName}".
Returnează DOAR JSON: {"minutes":<număr>,"reasoning":"<un propoziție>"}`,
      },
      { role: 'user', content: text || 'Nu sunt materiale disponibile.' },
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
    return { minutes: 45, reasoning: 'Estimat bazat pe complexitatea generală a materiei.' };
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

// ── HEALTH CHECK ───────────────────────────────────────────────

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
