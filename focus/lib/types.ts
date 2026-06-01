export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  crystal_balance: number;
  streak_days: number;
  longest_streak: number;
  consistency_multiplier: number;
  total_study_seconds: number;
  created_at: string;
};

export type UniverseItemType =
  | 'planet'
  | 'alien'
  | 'rare_alien'
  | 'alien_type'
  | 'habitat'
  | 'cosmic_structure'
  | 'civilization'
  | 'coop_element';

export type UniverseItem = {
  id: string;
  user_id: string;
  item_type: UniverseItemType;
  item_name: string;
  rarity: Rarity;
  is_active: boolean;
  position_x: number | null;
  position_y: number | null;
  placeholder_key: string;
  earned_at: string;
  earned_from: string;
};

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  emoji: string;
  created_at: string;
};

export type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  order_index: number;
  created_at: string;
};

export type Material = {
  id: string;
  chapter_id: string | null;
  subject_id: string;
  name: string;
  file_url: string;
  file_type: string;
  size_bytes: number;
  summary: string | null;
  is_summarized: boolean;
  embedding_done: boolean;
  created_at: string;
};

export type SessionType = 'casual' | 'mission';

export type StudySession = {
  id: string;
  user_id: string;
  session_type: SessionType;
  duration_seconds: number;
  planned_seconds: number;
  completed: boolean;
  abandoned_at: string | null;
  subject_id: string | null;
  chapter_ids: string[];
  reward_id: string | null;
  created_at: string;
};

export type RewardType =
  | 'crystals'
  | 'alien'
  | 'rare_alien'
  | 'alien_type'
  | 'planet'
  | 'habitat'
  | 'cosmic_structure'
  | 'civilization'
  | 'coop_element';

export type Reward = {
  id: string;
  user_id: string;
  session_id: string | null;
  reward_type: RewardType;
  crystal_amount: number | null;
  item_name: string | null;
  rarity: Rarity;
  consistency_bonus: boolean;
  coop_bonus: boolean;
  quiz_bonus: boolean;
  description: string;
  created_at: string;
};

export type QuizStatus = 'pending' | 'in_progress' | 'passed' | 'failed';

export type Quiz = {
  id: string;
  session_id: string;
  user_id: string;
  status: QuizStatus;
  total_questions: number;
  correct_answers: number | null;
  pass_score: number;
  created_at: string;
};

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'concept';

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer: string;
  order_index: number;
};

export type Wager = {
  id: string;
  session_id: string;
  user_id: string;
  wager_type: 'crystals' | 'universe_item';
  crystal_amount: number | null;
  universe_item_id: string | null;
  resolved: boolean;
  won: boolean | null;
  created_at: string;
};

export type Flashcard = {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  user_id: string;
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  review_status: 'new' | 'known' | 'needs_review';
  created_at: string;
};

export type AIChatMessage = {
  id: string;
  subject_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type CoopRoomStatus = 'waiting' | 'starting' | 'active' | 'completed' | 'abandoned';

export type CoopRoom = {
  id: string;
  created_by: string;
  join_code: string;
  duration_seconds: number;
  status: CoopRoomStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type CoopMemberStatus = 'joined' | 'ready' | 'accepted' | 'active' | 'completed' | 'abandoned';

export type CoopRoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  status: CoopMemberStatus;
  joined_at: string;
};

export type Streak = {
  id: string;
  user_id: string;
  study_date: string;
  total_seconds: number;
  session_count: number;
  created_at: string;
};
