
-- Profiles table (idempotent)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- api_requests: ensure column + policies
ALTER TABLE public.api_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Anyone can view api_requests" ON public.api_requests;
DROP POLICY IF EXISTS "Anyone can insert api_requests" ON public.api_requests;
DROP POLICY IF EXISTS "Users can view own or anonymous api_requests" ON public.api_requests;
DROP POLICY IF EXISTS "Users can delete own api_requests" ON public.api_requests;

CREATE POLICY "Users can view own or anonymous api_requests"
  ON public.api_requests FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Anyone can insert api_requests"
  ON public.api_requests FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can delete own api_requests"
  ON public.api_requests FOR DELETE
  USING (auth.uid() = user_id);

-- saved_workflows
ALTER TABLE public.saved_workflows ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Anyone can view saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Anyone can insert saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Anyone can update saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Anyone can delete saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can view own saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can insert own saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can update own saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can delete own saved_workflows" ON public.saved_workflows;

CREATE POLICY "Users can view own saved_workflows"
  ON public.saved_workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved_workflows"
  ON public.saved_workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved_workflows"
  ON public.saved_workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved_workflows"
  ON public.saved_workflows FOR DELETE USING (auth.uid() = user_id);
