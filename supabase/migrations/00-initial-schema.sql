-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create agents table
CREATE TABLE public.agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    name text NOT NULL,
    logo_url text,
    json_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    railway_project_id text,
    deployment_url text
);

-- Create storage bucket for agent logos
INSERT INTO storage.buckets (id, name) 
VALUES ('agent-logos', 'agent-logos');

-- Enable RLS on agents table
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Create policies for agents table
CREATE POLICY "Enable read access for all users" ON public.agents
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.agents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.agents
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create policy for agent-logos bucket
CREATE POLICY "Allow public read access" ON storage.objects
    FOR SELECT USING (bucket_id = 'agent-logos');

CREATE POLICY "Allow authenticated users to upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'agent-logos' 
        AND auth.role() = 'authenticated'
    );

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
CREATE PUBLICATION supabase_realtime FOR TABLE agents;

-- Enable realtime for agents table
ALTER PUBLICATION supabase_realtime ADD TABLE agents;

-- Create index for faster queries
CREATE INDEX agents_status_idx ON public.agents(status);
CREATE INDEX agents_name_idx ON public.agents(name);
