-- ============================================================
-- StudyVerse – 003_functions.sql
-- Database functions, triggers, and business logic
-- ============================================================

-- ── HELPERS ──────────────────────────────────────────────────

-- Generate a random 6-character room code (uppercase letters + digits, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  chars  TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT    := '';
  i      INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Auto-assign unique join_code before inserting a coop room
CREATE OR REPLACE FUNCTION public.auto_set_coop_join_code()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_code  TEXT;
  v_clash BOOLEAN;
BEGIN
  IF NEW.join_code IS NOT NULL AND NEW.join_code <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    v_code := public.generate_join_code();
    SELECT EXISTS(SELECT 1 FROM public.coop_rooms WHERE join_code = v_code) INTO v_clash;
    EXIT WHEN NOT v_clash;
  END LOOP;
  NEW.join_code := v_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_coop_join_code
  BEFORE INSERT ON public.coop_rooms
  FOR EACH ROW
  WHEN (NEW.join_code IS NULL OR NEW.join_code = '')
  EXECUTE FUNCTION public.auto_set_coop_join_code();

-- ── USER CREATION ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_starter_universe(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_universe_items
    (user_id, item_type, item_name, rarity, placeholder_key, earned_from)
  VALUES
    (p_user_id, 'planet', 'Starter Planet', 'common', 'planet_starter', 'signup'),
    (p_user_id, 'alien',  'Zorp',           'common', 'alien_basic',    'signup');
END;
$$;

-- Trigger: create public.users row + starter universe on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  -- Deduplicate username if needed
  IF EXISTS (SELECT 1 FROM public.users WHERE username = v_username) THEN
    v_username := v_username || '_' || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
  END IF;

  INSERT INTO public.users (id, email, username)
  VALUES (NEW.id, NEW.email, v_username);

  PERFORM public.create_starter_universe(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── STREAK & MULTIPLIER ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_streak_and_multiplier(
  p_user_id        UUID,
  p_duration_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today      DATE    := CURRENT_DATE;
  v_streak     INTEGER;
  v_longest    INTEGER;
  v_multiplier DECIMAL(4,2);
BEGIN
  -- Upsert today's streak record
  INSERT INTO public.streaks (user_id, study_date, total_seconds, session_count)
  VALUES (p_user_id, v_today, p_duration_seconds, 1)
  ON CONFLICT (user_id, study_date)
  DO UPDATE SET
    total_seconds = streaks.total_seconds + EXCLUDED.total_seconds,
    session_count = streaks.session_count + 1;

  -- Calculate current consecutive-day streak using a simple recursive CTE
  WITH RECURSIVE cons AS (
    SELECT study_date, 1 AS n
    FROM public.streaks
    WHERE user_id = p_user_id AND study_date = v_today

    UNION ALL

    SELECT s.study_date, cons.n + 1
    FROM public.streaks s
    JOIN cons ON s.study_date = cons.study_date - INTERVAL '1 day'
    WHERE s.user_id = p_user_id
  )
  SELECT COALESCE(MAX(n), 1) INTO v_streak FROM cons;

  SELECT longest_streak INTO v_longest
  FROM public.users WHERE id = p_user_id;

  -- Multiplier: 1.0 base + 0.05 per streak day, capped at 3.0
  v_multiplier := LEAST(3.00, ROUND(1.00 + (v_streak * 0.05), 2));

  UPDATE public.users SET
    streak_days            = v_streak,
    longest_streak         = GREATEST(v_longest, v_streak),
    consistency_multiplier = v_multiplier,
    total_study_seconds    = total_study_seconds + p_duration_seconds
  WHERE id = p_user_id;
END;
$$;

-- ── REWARD CALCULATION ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.grant_session_reward(
  p_session_id       UUID,
  p_duration_seconds INTEGER,
  p_user_id          UUID,
  p_quiz_passed      BOOLEAN DEFAULT false,
  p_coop_bonus       BOOLEAN DEFAULT false
)
RETURNS UUID        -- reward.id
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_multiplier      DECIMAL(4,2);
  v_reward_type     public.reward_type;
  v_crystal_amount  INTEGER;
  v_item_name       TEXT;
  v_rarity          public.rarity_type;
  v_description     TEXT;
  v_reward_id       UUID;
  v_item_id         UUID;
  v_cons_bonus      BOOLEAN := false;
  v_mins            INTEGER := p_duration_seconds / 60;
BEGIN
  SELECT consistency_multiplier INTO v_multiplier
  FROM public.users WHERE id = p_user_id;

  v_cons_bonus := v_multiplier >= 1.2;

  -- ── Tier logic ────────────────────────────────────────────
  IF p_duration_seconds < 1800 THEN                              -- < 30 min → crystals
    v_reward_type    := 'crystals';
    v_crystal_amount := CEIL(v_mins * 2.0 * v_multiplier);
    v_rarity         := 'common';
    v_description    := FORMAT(
      'You earned %s crystals for a %s-minute session.',
      v_crystal_amount, v_mins);

  ELSIF p_duration_seconds < 3600 THEN                           -- 30–60 min → more crystals
    v_reward_type    := 'crystals';
    v_crystal_amount := CEIL(v_mins * 3.5 * v_multiplier);
    v_rarity         := 'common';
    v_description    := FORMAT(
      'You earned %s crystals for a %s-minute session.',
      v_crystal_amount, v_mins);

  ELSIF p_duration_seconds < 7200 THEN                           -- 60–120 min → crystals + chance of alien
    IF RANDOM() < 0.40 OR p_quiz_passed THEN
      v_reward_type := 'alien';
      v_item_name   := (ARRAY['Glimmer','Zyx','Blobkin','Flikko','Nudo'])[CEIL(RANDOM()*5)];
      v_rarity      := CASE WHEN p_quiz_passed THEN 'uncommon' ELSE 'common' END;
      v_description := FORMAT('You unlocked %s, a new alien companion!', v_item_name);
    ELSE
      v_reward_type    := 'crystals';
      v_crystal_amount := CEIL(v_mins * 5.0 * v_multiplier);
      v_rarity         := 'uncommon';
      v_description    := FORMAT(
        'You earned %s crystals for a focused %s-minute session.',
        v_crystal_amount, v_mins);
    END IF;

  ELSE                                                            -- 120+ min → guaranteed physical
    IF p_quiz_passed AND p_coop_bonus THEN
      v_reward_type := 'cosmic_structure';
      v_item_name   := (ARRAY['Nebula Beacon','Star Gate','Void Monolith','Apex Spire'])[CEIL(RANDOM()*4)];
      v_rarity      := 'legendary';
    ELSIF p_quiz_passed THEN
      -- epic: rare_alien, planet, or habitat
      CASE FLOOR(RANDOM()*3)::INTEGER
        WHEN 0 THEN v_reward_type := 'rare_alien'; v_item_name := (ARRAY['Luminos','Vexor','Crystara','Orbitex'])[CEIL(RANDOM()*4)];
        WHEN 1 THEN v_reward_type := 'planet';     v_item_name := (ARRAY['Nebula Prime','Ice World','Lava Rock','Drift World'])[CEIL(RANDOM()*4)];
        ELSE        v_reward_type := 'habitat';    v_item_name := (ARRAY['Crystal Cave','Nebula Nest','Void Den','Spark Dome'])[CEIL(RANDOM()*4)];
      END CASE;
      v_rarity := 'epic';
    ELSIF p_coop_bonus THEN
      v_reward_type := 'coop_element';
      v_item_name   := (ARRAY['Sync Station','Unity Beacon','Bond Crystal','Orbit Link'])[CEIL(RANDOM()*4)];
      v_rarity      := 'rare';
    ELSE
      IF RANDOM() < 0.5 THEN
        v_reward_type := 'alien';
        v_item_name   := (ARRAY['Moonling','Dustmite','Starshell','Quarklet'])[CEIL(RANDOM()*4)];
      ELSE
        v_reward_type := 'habitat';
        v_item_name   := (ARRAY['Glow Cave','Spark Dome','Dust Hive','Moon Burrow'])[CEIL(RANDOM()*4)];
      END IF;
      v_rarity := CASE WHEN v_multiplier >= 1.5 THEN 'rare' ELSE 'uncommon' END;
    END IF;
    v_description := FORMAT(
      'You unlocked %s after completing a %.1f-hour session!',
      v_item_name, p_duration_seconds / 3600.0);
  END IF;

  -- Co-op crystal bonus
  IF p_coop_bonus AND v_reward_type = 'crystals' THEN
    v_crystal_amount := CEIL(v_crystal_amount * 1.5);
  END IF;

  -- ── Create universe item if not crystals ─────────────────
  IF v_reward_type <> 'crystals' THEN
    INSERT INTO public.user_universe_items
      (user_id, item_type, item_name, rarity, placeholder_key, earned_at, earned_from)
    VALUES
      (p_user_id, v_reward_type::public.item_type, v_item_name, v_rarity,
       v_reward_type::TEXT, NOW(), p_session_id::TEXT)
    RETURNING id INTO v_item_id;
  END IF;

  -- ── Insert reward record ──────────────────────────────────
  INSERT INTO public.rewards
    (user_id, session_id, reward_type, crystal_amount, item_name,
     universe_item_id, rarity, consistency_bonus, coop_bonus, quiz_bonus, description)
  VALUES
    (p_user_id, p_session_id, v_reward_type, v_crystal_amount, v_item_name,
     v_item_id, v_rarity, v_cons_bonus, p_coop_bonus, p_quiz_passed, v_description)
  RETURNING id INTO v_reward_id;

  -- ── Apply reward to user ──────────────────────────────────
  IF v_reward_type = 'crystals' THEN
    UPDATE public.users
    SET crystal_balance = crystal_balance + v_crystal_amount
    WHERE id = p_user_id;
  END IF;

  RETURN v_reward_id;
END;
$$;

-- ── COMPLETE SESSION ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_study_session(
  p_session_id       UUID,
  p_duration_seconds INTEGER,
  p_quiz_passed      BOOLEAN DEFAULT false,
  p_coop_bonus       BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   UUID;
  v_reward_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.study_sessions WHERE id = p_session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;

  -- Mark session complete
  UPDATE public.study_sessions SET
    completed        = true,
    duration_seconds = p_duration_seconds,
    abandoned_at     = NULL
  WHERE id = p_session_id;

  -- Update streak + multiplier + total time
  PERFORM public.update_streak_and_multiplier(v_user_id, p_duration_seconds);

  -- Grant reward
  v_reward_id := public.grant_session_reward(
    p_session_id, p_duration_seconds, v_user_id, p_quiz_passed, p_coop_bonus
  );

  RETURN (
    SELECT ROW_TO_JSON(r) FROM (
      SELECT
        rw.id            AS reward_id,
        rw.reward_type,
        rw.crystal_amount,
        rw.item_name,
        rw.rarity::TEXT,
        rw.consistency_bonus,
        rw.coop_bonus,
        rw.quiz_bonus,
        rw.description,
        rw.universe_item_id,
        u.streak_days,
        u.consistency_multiplier,
        u.crystal_balance
      FROM public.rewards rw
      JOIN public.users   u  ON u.id = rw.user_id
      WHERE rw.id = v_reward_id
    ) r
  );
END;
$$;

-- ── ABANDON SESSION ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.abandon_study_session(
  p_session_id       UUID,
  p_duration_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id       UUID;
  v_planned       INTEGER;
  v_completion    DECIMAL;
BEGIN
  SELECT user_id, planned_seconds INTO v_user_id, v_planned
  FROM public.study_sessions WHERE id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  v_completion := p_duration_seconds::DECIMAL / GREATEST(v_planned, 1);

  UPDATE public.study_sessions SET
    abandoned_at     = NOW(),
    duration_seconds = p_duration_seconds,
    completed        = false
  WHERE id = p_session_id;

  -- Count partial time toward total (only if > 10% done)
  IF v_completion > 0.10 THEN
    UPDATE public.users
    SET total_study_seconds = total_study_seconds + p_duration_seconds
    WHERE id = v_user_id;
  END IF;

  -- Forfeit any pending wager
  UPDATE public.wagers
  SET resolved = true, won = false
  WHERE session_id = p_session_id AND resolved = false;

  -- Penalty: if > 50% done, deactivate one random common alien or habitat
  IF v_completion > 0.50 THEN
    UPDATE public.user_universe_items
    SET is_active = false
    WHERE id = (
      SELECT id FROM public.user_universe_items
      WHERE user_id = v_user_id
        AND is_active = true
        AND rarity = 'common'
        AND item_type IN ('alien', 'habitat')
      ORDER BY RANDOM()
      LIMIT 1
    );
  END IF;
END;
$$;

-- ── PLACE WAGER ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_wager(
  p_session_id     UUID,
  p_user_id        UUID,
  p_wager_type     public.wager_type,
  p_crystal_amount INTEGER  DEFAULT NULL,
  p_item_id        UUID     DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wager_id UUID;
BEGIN
  -- Validate crystals
  IF p_wager_type = 'crystals' THEN
    IF p_crystal_amount IS NULL OR p_crystal_amount <= 0 THEN
      RAISE EXCEPTION 'crystal_amount must be positive for crystal wager';
    END IF;
    IF (SELECT crystal_balance FROM public.users WHERE id = p_user_id) < p_crystal_amount THEN
      RAISE EXCEPTION 'Insufficient crystals';
    END IF;
    -- Deduct crystals immediately (held in escrow)
    UPDATE public.users SET crystal_balance = crystal_balance - p_crystal_amount
    WHERE id = p_user_id;
  END IF;

  -- Validate item wager
  IF p_wager_type = 'universe_item' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_universe_items
      WHERE id = p_item_id AND user_id = p_user_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Item not found or not owned';
    END IF;
    -- Lock item
    UPDATE public.user_universe_items SET is_active = false
    WHERE id = p_item_id;
  END IF;

  INSERT INTO public.wagers
    (session_id, user_id, wager_type, crystal_amount, universe_item_id)
  VALUES
    (p_session_id, p_user_id, p_wager_type, p_crystal_amount, p_item_id)
  RETURNING id INTO v_wager_id;

  RETURN v_wager_id;
END;
$$;

-- ── RESOLVE WAGER ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_wager(
  p_wager_id UUID,
  p_won      BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wager public.wagers%ROWTYPE;
BEGIN
  SELECT * INTO v_wager FROM public.wagers WHERE id = p_wager_id;

  IF v_wager.resolved THEN RETURN; END IF;

  UPDATE public.wagers SET resolved = true, won = p_won WHERE id = p_wager_id;

  IF p_won THEN
    -- Return escrowed crystals / reactivate item
    IF v_wager.wager_type = 'crystals' THEN
      UPDATE public.users
      SET crystal_balance = crystal_balance + v_wager.crystal_amount
      WHERE id = v_wager.user_id;
    ELSE
      UPDATE public.user_universe_items SET is_active = true
      WHERE id = v_wager.universe_item_id;
    END IF;
  END IF;
  -- If lost: crystals already deducted; item remains inactive (destroyed)
END;
$$;

-- ── VECTOR SEARCH ─────────────────────────────────────────────

-- Matches the top k chunks for a query embedding within a user's subject
CREATE OR REPLACE FUNCTION public.match_material_chunks(
  p_query_embedding vector(1536),
  p_subject_id      UUID,
  p_user_id         UUID,
  p_match_count     INTEGER DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.content,
    1 - (mc.embedding <=> p_query_embedding) AS similarity
  FROM public.material_chunks mc
  WHERE mc.subject_id = p_subject_id
    AND mc.user_id    = p_user_id
    AND mc.embedding  IS NOT NULL
  ORDER BY mc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;
