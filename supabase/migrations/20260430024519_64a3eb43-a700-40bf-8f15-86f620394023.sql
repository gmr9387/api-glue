-- Tighten RLS on api_requests: require authenticated user, only own rows
DROP POLICY IF EXISTS "Anyone can insert api_requests" ON public.api_requests;
DROP POLICY IF EXISTS "Users can view own or anonymous api_requests" ON public.api_requests;
DROP POLICY IF EXISTS "Users can delete own api_requests" ON public.api_requests;

CREATE POLICY "Users can insert own api_requests"
ON public.api_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own api_requests"
ON public.api_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api_requests"
ON public.api_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Tighten saved_workflows policies to authenticated role explicitly
DROP POLICY IF EXISTS "Users can view own saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can insert own saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can update own saved_workflows" ON public.saved_workflows;
DROP POLICY IF EXISTS "Users can delete own saved_workflows" ON public.saved_workflows;

CREATE POLICY "Users can view own saved_workflows"
ON public.saved_workflows
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved_workflows"
ON public.saved_workflows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved_workflows"
ON public.saved_workflows
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved_workflows"
ON public.saved_workflows
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);