-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    max_agents integer NOT NULL DEFAULT 3,
    agents_created integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- Create agents table with user relationship
CREATE TABLE IF NOT EXISTS public.agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    logo_url text,
    json_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    railway_project_id text,
    deployment_url text
);

-- Function to increment agents_created count
CREATE OR REPLACE FUNCTION increment_agents_created()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_settings
    SET agents_created = agents_created + 1
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to increment agents_created on new agent
CREATE TRIGGER increment_agents_created_trigger
    AFTER INSERT ON public.agents
    FOR EACH ROW
    EXECUTE FUNCTION increment_agents_created();

-- Enable RLS on agents table
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies for user_settings
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for agents table
CREATE POLICY "Users can view own agents" ON public.agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents" ON public.agents
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.user_settings
            WHERE user_id = auth.uid()
            AND agents_created < max_agents
        )
    );

CREATE POLICY "Users can update own agents" ON public.agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON public.agents
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON public.agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create realtime publication for agents table
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE agents;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS agents_status_idx ON public.agents(status);
CREATE INDEX IF NOT EXISTS agents_name_idx ON public.agents(name);

-- Enable realtime for agents table
ALTER PUBLICATION supabase_realtime ADD TABLE agents;

-- Create and configure storage bucket
DO $$
BEGIN
    -- Drop existing bucket if exists
    BEGIN
        DELETE FROM storage.buckets WHERE id = 'agent-logos';
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Create new bucket
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('agent-logos', 'agent-logos', true);
END $$;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policies
DO $$
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Allow public access to agent-logos" ON storage.objects;
    
    -- Create new policy
    CREATE POLICY "Allow public access to agent-logos" ON storage.objects
        FOR ALL USING (bucket_id = 'agent-logos');
END $$;

-- Ensure bucket is accessible
UPDATE storage.buckets 
SET public = true 
WHERE id = 'agent-logos';
