-- Migration: Create Gamification XP & Level Progression System
-- Enables persistent XP tracking, milestone bonuses, and level calculations for students

-- 1. Create student_xp_transactions table
CREATE TABLE IF NOT EXISTS public.student_xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  xp_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_xp_student_date ON public.student_xp_transactions(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_student_xp_reason ON public.student_xp_transactions(reason);

-- 2. Enable RLS
ALTER TABLE public.student_xp_transactions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Students can view own XP transactions" ON public.student_xp_transactions;
CREATE POLICY "Students can view own XP transactions"
ON public.student_xp_transactions FOR SELECT
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'tutor', 'ultimate_tutor')
  )
);

-- 4. Secure function to award XP
CREATE OR REPLACE FUNCTION public.award_student_xp(
  _student_id UUID,
  _xp_amount INTEGER,
  _reason TEXT,
  _reference_id TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_db_id uuid;
  v_target_auth_id uuid;
  v_total_xp integer := 0;
BEGIN
  -- Resolve student ID
  SELECT id, auth_user_id INTO v_target_db_id, v_target_auth_id
  FROM public.users
  WHERE id = _student_id OR auth_user_id = _student_id
  LIMIT 1;

  IF v_target_db_id IS NULL AND v_target_auth_id IS NULL THEN
    v_target_db_id := _student_id;
  END IF;

  -- Prevent duplicate award if reference_id is provided and already exists for this reason
  IF _reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.student_xp_transactions
      WHERE (student_id = v_target_db_id OR student_id = v_target_auth_id)
        AND reason = _reason
        AND reference_id = _reference_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'Already awarded');
    END IF;
  END IF;

  -- Insert XP transaction (use auth_user_id if available, otherwise db_id)
  INSERT INTO public.student_xp_transactions (
    student_id,
    xp_amount,
    reason,
    reference_id,
    created_at
  ) VALUES (
    COALESCE(v_target_auth_id, v_target_db_id),
    _xp_amount,
    _reason,
    _reference_id,
    now()
  );

  -- Compute new total XP
  SELECT COALESCE(SUM(xp_amount), 0) INTO v_total_xp
  FROM public.student_xp_transactions
  WHERE student_id = v_target_db_id OR student_id = v_target_auth_id;

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', _xp_amount,
    'total_xp', v_total_xp,
    'reason', _reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_student_xp TO authenticated;

-- 5. Function to calculate student's total XP
CREATE OR REPLACE FUNCTION public.get_student_xp(_student_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_target_db_id uuid;
  v_target_auth_id uuid;
  v_total_xp integer := 0;
  v_transaction_count integer := 0;
BEGIN
  IF _student_id IS NOT NULL THEN
    SELECT id, auth_user_id INTO v_target_db_id, v_target_auth_id
    FROM public.users
    WHERE id = _student_id OR auth_user_id = _student_id
    LIMIT 1;
    IF v_target_db_id IS NULL THEN
      v_target_db_id := _student_id;
    END IF;
  ELSE
    v_target_auth_id := v_auth_id;
    SELECT id INTO v_target_db_id FROM public.users WHERE auth_user_id = v_auth_id LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(xp_amount), 0), COUNT(*)
  INTO v_total_xp, v_transaction_count
  FROM public.student_xp_transactions
  WHERE student_id = v_target_db_id 
     OR (v_target_auth_id IS NOT NULL AND student_id = v_target_auth_id);

  RETURN jsonb_build_object(
    'total_xp', v_total_xp,
    'transactions_count', v_transaction_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_xp TO authenticated;
