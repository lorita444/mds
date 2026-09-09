const request = require('supertest');
const app = require('../index');
const db = require('../db');
const {
  parseAIResponse,
  validateSummary,
  validateFlashcards,
  validateQuiz,
  validateChatReply,
  validateStudyEstimate,
  AIValidationError,
  AIParseError,
} = require('../utils/aiValidator');

// Mock db module
jest.mock('../db', () => ({
  query: jest.fn(),
  querySingle: jest.fn(),
}));

describe('AI Output Parsing, Validation, and Endpoint Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. RESILIENT JSON PARSING ───────────────────────────────────
  describe('Resilient JSON Parsing (parseAIResponse)', () => {
    it('should parse clean JSON strings', () => {
      const input = '{"summary": "This is a clean summary."}';
      const parsed = parseAIResponse(input);
      expect(parsed).toEqual({ summary: 'This is a clean summary.' });
    });

    it('should parse objects directly if already parsed', () => {
      const input = { summary: 'Already an object' };
      expect(parseAIResponse(input)).toEqual(input);
    });

    it('should extract JSON from markdown code blocks (```json ... ```)', () => {
      const input = `\`\`\`json
{
  "summary": "Extracted from markdown codeblock"
}
\`\`\``;
      const parsed = parseAIResponse(input);
      expect(parsed).toEqual({ summary: 'Extracted from markdown codeblock' });
    });

    it('should extract JSON from generic markdown code blocks (``` ... ```)', () => {
      const input = `\`\`\`
{
  "reply": "Extracted from generic codeblock"
}
\`\`\``;
      const parsed = parseAIResponse(input);
      expect(parsed).toEqual({ reply: 'Extracted from generic codeblock' });
    });

    it('should extract JSON when surrounded by extra prose before and after', () => {
      const input = `Here is the requested output:
{
  "minutes": 45,
  "reasoning": "Standard chapter length."
}
Hope this helps your study session!`;
      const parsed = parseAIResponse(input);
      expect(parsed).toEqual({ minutes: 45, reasoning: 'Standard chapter length.' });
    });

    it('should throw AIParseError when JSON is truncated mid-stream (finish_reason: length / SyntaxError)', () => {
      const truncatedInput = '{"questions": [{"question_text": "What is water?", "options": ["H2O", "CO2"';
      expect(() => parseAIResponse(truncatedInput)).toThrow(AIParseError);
    });

    it('should throw AIParseError for empty or null input', () => {
      expect(() => parseAIResponse('')).toThrow(AIParseError);
      expect(() => parseAIResponse(null)).toThrow(AIParseError);
      expect(() => parseAIResponse(undefined)).toThrow(AIParseError);
    });
  });

  // ── 2. LOGIC VALIDATIONS FOR QUIZ, FLASHCARDS, & SUMMARIES ──────
  describe('Specific Logic Validations', () => {
    describe('Summary Validation', () => {
      it('should validate valid non-empty summary string', () => {
        const valid = validateSummary('Valid summary of material.');
        expect(valid).toEqual({ summary: 'Valid summary of material.' });
      });

      it('should reject empty or whitespace-only summary', () => {
        expect(() => validateSummary('   ')).toThrow(AIValidationError);
        expect(() => validateSummary('')).toThrow(AIValidationError);
        expect(() => validateSummary({ summary: '   ' })).toThrow(AIValidationError);
      });
    });

    describe('Chat Reply Validation', () => {
      it('should validate plain string reply', () => {
        const valid = validateChatReply('Clean response text');
        expect(valid).toEqual({ reply: 'Clean response text' });
      });

      it('should extract reply from JSON object or nested message property', () => {
        expect(validateChatReply({ reply: 'Reply text' })).toEqual({ reply: 'Reply text' });
        expect(validateChatReply({ message: 'Message text' })).toEqual({ reply: 'Message text' });
        expect(validateChatReply({ reply: { message: 'Nested text' } })).toEqual({ reply: 'Nested text' });
        expect(validateChatReply('{"message": "JSON string message"}')).toEqual({ reply: 'JSON string message' });
      });

      it('should reject empty or invalid object reply', () => {
        expect(() => validateChatReply('')).toThrow(AIValidationError);
        expect(() => validateChatReply({})).toThrow(AIValidationError);
      });
    });

    describe('Flashcard Validation', () => {
      it('should validate clean flashcards array', () => {
        const input = {
          flashcards: [
            { question: 'What is 2+2?', answer: '4', difficulty: 'easy' },
            { question: 'What is photosynthesis?', answer: 'Plant light conversion.', difficulty: 'medium' },
          ],
        };
        const validated = validateFlashcards(input);
        expect(validated).toHaveLength(2);
        expect(validated[0].question).toBe('What is 2+2?');
      });

      it('should reject flashcard with empty or whitespace-only question or answer', () => {
        const inputWithWhitespaceQuestion = {
          flashcards: [{ question: '   ', answer: 'Valid answer', difficulty: 'easy' }],
        };
        expect(() => validateFlashcards(inputWithWhitespaceQuestion)).toThrow(AIValidationError);

        const inputWithWhitespaceAnswer = {
          flashcards: [{ question: 'Valid Question', answer: '  \n  ', difficulty: 'easy' }],
        };
        expect(() => validateFlashcards(inputWithWhitespaceAnswer)).toThrow(AIValidationError);
      });

      it('should reject flashcard with invalid difficulty enum', () => {
        const input = {
          flashcards: [{ question: 'Q', answer: 'A', difficulty: 'extreme' }],
        };
        expect(() => validateFlashcards(input)).toThrow(AIValidationError);
      });
    });

    describe('Quiz Validation', () => {
      it('should validate a valid multiple choice quiz question', () => {
        const input = {
          questions: [
            {
              question_text: 'What is the capital of France?',
              question_type: 'multiple_choice',
              options: ['Paris', 'London', 'Berlin', 'Madrid'],
              correct_answer: 'Paris',
              explanation: 'Paris is the capital of France.',
            },
          ],
        };
        const validated = validateQuiz(input);
        expect(validated).toHaveLength(1);
        expect(validated[0].question_text).toBe('What is the capital of France?');
      });

      it('should reject multiple choice question with duplicate options (case-insensitive)', () => {
        const inputWithDuplicates = {
          questions: [
            {
              question_text: 'Which element has symbol H?',
              question_type: 'multiple_choice',
              options: ['Hydrogen', 'Helium', 'hydrogen', 'Oxygen'],
              correct_answer: 'Hydrogen',
              explanation: 'Hydrogen symbol is H.',
            },
          ],
        };
        expect(() => validateQuiz(inputWithDuplicates)).toThrow(AIValidationError);
      });

      it('should reject multiple choice question with fewer than 3 distinct options', () => {
        const inputWithTooFewOptions = {
          questions: [
            {
              question_text: 'Is gravity real?',
              question_type: 'multiple_choice',
              options: ['Yes', 'No'],
              correct_answer: 'Yes',
              explanation: 'Gravity pulls objects toward center.',
            },
          ],
        };
        expect(() => validateQuiz(inputWithTooFewOptions)).toThrow(AIValidationError);
      });

      it('should reject quiz question with empty/whitespace-only text or explanation', () => {
        const emptyQuestionText = {
          questions: [
            {
              question_text: '   ',
              question_type: 'short_answer',
              options: null,
              correct_answer: 'Answer',
              explanation: 'Explanation',
            },
          ],
        };
        expect(() => validateQuiz(emptyQuestionText)).toThrow(AIValidationError);

        const emptyExplanation = {
          questions: [
            {
              question_text: 'Valid Question?',
              question_type: 'short_answer',
              options: null,
              correct_answer: 'Answer',
              explanation: '   ',
            },
          ],
        };
        expect(() => validateQuiz(emptyExplanation)).toThrow(AIValidationError);
      });
    });

    describe('Study Estimate Validation', () => {
      it('should validate study duration estimate', () => {
        const valid = validateStudyEstimate({ minutes: 30, reasoning: 'Covers two chapters.' });
        expect(valid).toEqual({ minutes: 30, reasoning: 'Covers two chapters.' });
      });

      it('should reject negative or zero minutes', () => {
        expect(() => validateStudyEstimate({ minutes: 0, reasoning: 'Reason' })).toThrow(AIValidationError);
        expect(() => validateStudyEstimate({ minutes: -15, reasoning: 'Reason' })).toThrow(AIValidationError);
      });
    });
  });

  // ── 3. BACKEND ROUTES SECURITY & RESILIENCE ───────────────────
  describe('Backend AI Routes Security & Resilience', () => {
    describe('Authentication enforcement (401 Unauthorized)', () => {
      it('POST /api/quizzes/generate should return 401 if JWT token is missing', async () => {
        const response = await request(app)
          .post('/api/quizzes/generate')
          .send({ subjectId: 'sub-1' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Access token missing' });
      });

      it('POST /api/flashcards/generate should return 401 if JWT token is missing', async () => {
        const response = await request(app)
          .post('/api/flashcards/generate')
          .send({ subjectId: 'sub-1' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Access token missing' });
      });

      it('POST /api/materials/:id/summarize-file should return 401 if JWT token is missing', async () => {
        const response = await request(app)
          .post('/api/materials/mat-123/summarize-file');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Access token missing' });
      });

      it('POST /api/chat/respond should return 401 if JWT token is missing', async () => {
        const response = await request(app)
          .post('/api/chat/respond')
          .send({ subject_id: 'sub-1', message: 'Hello AI' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Access token missing' });
      });

      it('POST /api/chat/explain-course should return 401 if JWT token is missing', async () => {
        const response = await request(app)
          .post('/api/chat/explain-course')
          .send({ subject_id: 'sub-1' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Access token missing' });
      });
    });

    describe('Payload Size Limit (413 Payload Too Large)', () => {
      it('POST /api/chat/respond should return 413 if message exceeds 25,000 characters', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET || 'studyverse_secret_key_2026');
        const hugeMessage = 'A'.repeat(26000);

        const response = await request(app)
          .post('/api/chat/respond')
          .set('Authorization', `Bearer ${token}`)
          .send({ subject_id: 'sub-1', message: hugeMessage });

        expect(response.status).toBe(413);
        expect(response.body.error).toContain('Payload too large');
      });
    });
  });
});
