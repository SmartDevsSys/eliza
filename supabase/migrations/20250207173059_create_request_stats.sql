-- Create request_stats table
CREATE TABLE IF NOT EXISTS request_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS request_stats_user_id_idx ON request_stats(user_id);
CREATE INDEX IF NOT EXISTS request_stats_agent_id_idx ON request_stats(agent_id);
CREATE INDEX IF NOT EXISTS request_stats_date_idx ON request_stats(date);

-- Add RLS policies
ALTER TABLE request_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own request stats"
    ON request_stats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own request stats"
    ON request_stats FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own request stats"
    ON request_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Add function to increment request count
CREATE OR REPLACE FUNCTION increment_request_count(
    p_agent_id UUID,
    p_agent_name TEXT,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO request_stats (agent_id, agent_name, user_id, request_count, date)
    VALUES (p_agent_id, p_agent_name, p_user_id, 1, CURRENT_DATE)
    ON CONFLICT (agent_id, date) DO UPDATE
    SET request_count = request_stats.request_count + 1,
        updated_at = timezone('utc'::text, now());
END;
$$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_request_stats_updated_at
    BEFORE UPDATE ON request_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add unique constraint to prevent duplicate entries for same agent on same day
ALTER TABLE request_stats ADD CONSTRAINT unique_agent_date UNIQUE (agent_id, date);
