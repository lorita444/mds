/**
 * AI Output Validation & Resilient JSON Parsing Module
 */

class AIValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIValidationError';
    this.status = 400;
  }
}

class AIParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIParseError';
    this.status = 422;
  }
}

/**
 * Safely extracts and parses JSON from raw LLM text responses.
 * Handles markdown code block formatting (```json ... ```) and extra text wrapping.
 */
function parseAIResponse(rawInput) {
  if (rawInput === null || rawInput === undefined) {
    throw new AIParseError('AI returned an empty response.');
  }

  if (typeof rawInput === 'object') {
    return rawInput;
  }

  if (typeof rawInput !== 'string') {
    throw new AIParseError('AI response is not a valid string or object.');
  }

  let text = rawInput.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  } else {
    // If surrounded by extra prose, extract json block starting with { or [
    const firstBrace = text.search(/[\{\[]/);
    const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new AIParseError(`Failed to parse AI JSON response: ${err.message}`);
  }
}

/**
 * Validates AI-generated summary text.
 */
function validateSummary(data) {
  const parsed = typeof data === 'string' ? { summary: data } : parseAIResponse(data);
  const summary = parsed?.summary ?? parsed;

  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new AIValidationError('Summary cannot be empty or whitespace-only.');
  }

  return { summary: summary.trim() };
}

/**
 * Validates AI-generated flashcards.
 */
function validateFlashcards(data) {
  const parsed = parseAIResponse(data);
  const cards = Array.isArray(parsed) ? parsed : parsed?.flashcards;

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new AIValidationError('AI output does not contain a valid flashcards array.');
  }

  const validDifficulties = new Set(['easy', 'medium', 'hard']);

  const validated = cards.map((card, index) => {
    if (!card || typeof card !== 'object') {
      throw new AIValidationError(`Flashcard at index ${index} is invalid.`);
    }

    const question = (card.question || '').toString().trim();
    const answer = (card.answer || '').toString().trim();

    if (!question) {
      throw new AIValidationError(`Flashcard at index ${index} has an empty or whitespace-only question.`);
    }

    if (!answer) {
      throw new AIValidationError(`Flashcard at index ${index} has an empty or whitespace-only answer.`);
    }

    const difficulty = (card.difficulty || 'medium').toString().toLowerCase().trim();
    if (!validDifficulties.has(difficulty)) {
      throw new AIValidationError(`Flashcard at index ${index} has invalid difficulty: "${card.difficulty}".`);
    }

    return {
      question,
      answer,
      difficulty,
    };
  });

  return validated;
}

/**
 * Validates AI-generated quiz questions.
 */
function validateQuiz(data) {
  const parsed = parseAIResponse(data);
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new AIValidationError('AI output does not contain a valid questions array.');
  }

  const validTypes = new Set(['multiple_choice', 'true_false', 'short_answer']);

  const validated = questions.map((q, index) => {
    if (!q || typeof q !== 'object') {
      throw new AIValidationError(`Quiz question at index ${index} is invalid.`);
    }

    const question_text = (q.question_text || '').toString().trim();
    if (!question_text) {
      throw new AIValidationError(`Quiz question at index ${index} has empty or whitespace-only question text.`);
    }

    const question_type = (q.question_type || '').toString().toLowerCase().trim();
    if (!validTypes.has(question_type)) {
      throw new AIValidationError(`Quiz question at index ${index} has invalid question_type: "${q.question_type}".`);
    }

    let correct_answer = (q.correct_answer || '').toString().trim();
    if (!correct_answer) {
      throw new AIValidationError(`Quiz question at index ${index} has empty or whitespace-only correct_answer.`);
    }

    const explanation = (q.explanation || '').toString().trim();
    if (!explanation) {
      throw new AIValidationError(`Quiz question at index ${index} has empty or whitespace-only explanation.`);
    }

    let options = null;

    if (question_type === 'multiple_choice') {
      if (!Array.isArray(q.options)) {
        throw new AIValidationError(`Multiple choice question at index ${index} must have an options array.`);
      }

      options = q.options.map(opt => (opt || '').toString().trim());

      // Check for whitespace-only options
      if (options.some(opt => !opt)) {
        throw new AIValidationError(`Multiple choice question at index ${index} contains empty or whitespace-only option.`);
      }

      // Check for duplicate options
      const uniqueOptions = new Set(options.map(opt => opt.toLowerCase()));
      if (uniqueOptions.size !== options.length) {
        throw new AIValidationError(`Multiple choice question at index ${index} has duplicate options.`);
      }

      // Check minimum unique options count (at least 3)
      if (options.length < 3) {
        throw new AIValidationError(`Multiple choice question at index ${index} must have at least 3 distinct options.`);
      }

      // Verify correct_answer matches one of the options (soft match & fallback)
      const exactMatch = options.find(opt => opt.toLowerCase() === correct_answer.toLowerCase());
      if (exactMatch) {
        correct_answer = exactMatch;
      } else {
        const cleanAnswer = correct_answer.replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ]/g, '').toLowerCase();
        const softMatch = options.find(opt => opt.replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ]/g, '').toLowerCase() === cleanAnswer);
        if (softMatch) {
          correct_answer = softMatch;
        } else if (/^\d+$/.test(correct_answer) && parseInt(correct_answer, 10) < options.length) {
          correct_answer = options[parseInt(correct_answer, 10)];
        } else {
          correct_answer = options[0];
        }
      }
    } else if (question_type === 'true_false') {
      options = Array.isArray(q.options)
        ? q.options.map(opt => (opt || '').toString().trim())
        : ['Adevărat', 'Fals'];
    }

    return {
      question_text,
      question_type,
      options,
      correct_answer,
      explanation,
    };
  });

  return validated;
}

/**
 * Validates AI chat reply.
 */
function validateChatReply(data) {
  if (data === null || data === undefined) {
    throw new AIValidationError('AI chat reply cannot be empty or null.');
  }

  let textCandidate = '';

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('```')) {
      try {
        const parsed = parseAIResponse(trimmed);
        if (typeof parsed === 'string') {
          textCandidate = parsed;
        } else if (parsed && typeof parsed === 'object') {
          textCandidate = parsed.reply || parsed.explanation || parsed.message || parsed.content || parsed.text || '';
        }
      } catch {
        textCandidate = trimmed;
      }
    } else {
      textCandidate = trimmed;
    }
  } else if (typeof data === 'object') {
    textCandidate = data.reply || data.explanation || data.message || data.content || data.text || '';
    if (typeof textCandidate === 'object' && textCandidate !== null) {
      textCandidate = textCandidate.reply || textCandidate.message || textCandidate.content || textCandidate.text || '';
    }
  }

  const reply = String(textCandidate || '').trim();

  if (!reply || reply === '[object Object]') {
    throw new AIValidationError('AI chat reply cannot be empty or whitespace-only.');
  }

  return { reply };
}

/**
 * Validates AI estimated study duration.
 */
function validateStudyEstimate(data) {
  const parsed = parseAIResponse(data);
  const minutes = Number(parsed?.minutes);
  const reasoning = (parsed?.reasoning || '').toString().trim();

  if (isNaN(minutes) || minutes <= 0) {
    throw new AIValidationError('Study duration estimate minutes must be a positive number.');
  }

  if (!reasoning) {
    throw new AIValidationError('Study duration estimate reasoning cannot be empty.');
  }

  return { minutes, reasoning };
}

module.exports = {
  AIValidationError,
  AIParseError,
  parseAIResponse,
  validateSummary,
  validateFlashcards,
  validateQuiz,
  validateChatReply,
  validateStudyEstimate,
};
