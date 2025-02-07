-- Add RLS policies for accounts table
CREATE POLICY "Enable insert for authentication service" ON public.accounts
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id" ON public.accounts
    FOR UPDATE USING (auth.uid() = id);

-- Add RLS policies for logs table
CREATE POLICY "Enable insert for users based on user_id" ON public.logs
    FOR INSERT WITH CHECK (auth.uid() = "userId");

-- Add RLS policies for rooms table
CREATE POLICY "Enable insert for users based on user_id" ON public.rooms
    FOR INSERT WITH CHECK (auth.uid() = "userId");

-- Add RLS policies for participants table
CREATE POLICY "Enable insert for users based on user_id" ON public.participants
    FOR INSERT WITH CHECK (auth.uid() = "userId");

-- Add RLS policies for cache table
CREATE POLICY "Enable insert for users based on user_id" ON public.cache
    FOR INSERT WITH CHECK (auth.uid() = "userId");

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure the handle_new_user function has proper permissions
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;
