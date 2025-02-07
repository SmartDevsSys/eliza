-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create new tables for chat functionality
CREATE TABLE IF NOT EXISTS public.accounts (
    "id" UUID PRIMARY KEY DEFAULT auth.uid(),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "details" JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT fk_user FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.rooms (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL REFERENCES public.accounts("id"),
    "name" TEXT,
    "isArchived" BOOLEAN DEFAULT false
);

-- Create tables for different vector sizes
CREATE TABLE IF NOT EXISTS public.memories_1536 (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(1536),
    "userId" UUID REFERENCES public.accounts("id"),
    "agentId" UUID REFERENCES public.agents("id"),
    "roomId" UUID REFERENCES public.rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES public.rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES public.accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES public.agents("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.memories_1024 (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(1024),
    "userId" UUID REFERENCES public.accounts("id"),
    "agentId" UUID REFERENCES public.agents("id"),
    "roomId" UUID REFERENCES public.rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES public.rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES public.accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES public.agents("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.memories_768 (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(768),
    "userId" UUID REFERENCES public.accounts("id"),
    "agentId" UUID REFERENCES public.agents("id"),
    "roomId" UUID REFERENCES public.rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES public.rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES public.accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES public.agents("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.memories_384 (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(384),
    "userId" UUID REFERENCES public.accounts("id"),
    "agentId" UUID REFERENCES public.agents("id"),
    "roomId" UUID REFERENCES public.rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES public.rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES public.accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES public.agents("id") ON DELETE CASCADE
);

-- Create unified view for memories
CREATE OR REPLACE VIEW public.memories AS
    SELECT * FROM public.memories_1536
    UNION ALL
    SELECT * FROM public.memories_1024
    UNION ALL
    SELECT * FROM public.memories_768
    UNION ALL
    SELECT * FROM public.memories_384;

-- Create tables for chat functionality
CREATE TABLE IF NOT EXISTS public.logs (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL REFERENCES public.accounts("id"),
    "body" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "roomId" UUID NOT NULL REFERENCES public.rooms("id"),
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES public.rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES public.accounts("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.participants (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID REFERENCES public.accounts("id"),
    "roomId" UUID REFERENCES public.rooms("id"),
    "userState" TEXT,
    "last_message_read" TEXT,
    UNIQUE("userId", "roomId"),
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES public.rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES public.accounts("id") ON DELETE CASCADE
);

-- Create cache table for chat state
CREATE TABLE IF NOT EXISTS public.cache (
    "key" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" UUID NOT NULL REFERENCES public.accounts("id"),
    "value" JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP,
    PRIMARY KEY ("key", "agentId", "userId")
);

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_memories_1536_embedding ON public.memories_1536 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_memories_1024_embedding ON public.memories_1024 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_memories_768_embedding ON public.memories_768 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_memories_384_embedding ON public.memories_384 USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_memories_1536_type_room ON public.memories_1536("type", "roomId");
CREATE INDEX IF NOT EXISTS idx_memories_1024_type_room ON public.memories_1024("type", "roomId");
CREATE INDEX IF NOT EXISTS idx_memories_768_type_room ON public.memories_768("type", "roomId");
CREATE INDEX IF NOT EXISTS idx_memories_384_type_room ON public.memories_384("type", "roomId");

CREATE INDEX IF NOT EXISTS idx_rooms_user ON public.rooms("userId");
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.participants("userId");
CREATE INDEX IF NOT EXISTS idx_participants_room ON public.participants("roomId");
CREATE INDEX IF NOT EXISTS idx_logs_room ON public.logs("roomId");
CREATE INDEX IF NOT EXISTS idx_logs_user ON public.logs("userId");
CREATE INDEX IF NOT EXISTS idx_cache_user ON public.cache("userId");

-- Enable Row Level Security
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories_1536 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories_1024 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories_768 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories_384 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own account" ON public.accounts
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own rooms" ON public.rooms
    FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "Users can create own rooms" ON public.rooms
    FOR INSERT WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update own rooms" ON public.rooms
    FOR UPDATE USING (auth.uid() = "userId");

CREATE POLICY "Users can delete own rooms" ON public.rooms
    FOR DELETE USING (auth.uid() = "userId");

-- Memories policies (same for all vector sizes)
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN SELECT unnest(ARRAY['memories_1536', 'memories_1024', 'memories_768', 'memories_384'])
    LOOP
        EXECUTE format($policy$
            CREATE POLICY "Users can view own memories" ON public.%I
                FOR SELECT USING (auth.uid() = "userId");

            CREATE POLICY "Users can create own memories" ON public.%I
                FOR INSERT WITH CHECK (auth.uid() = "userId");

            CREATE POLICY "Users can update own memories" ON public.%I
                FOR UPDATE USING (auth.uid() = "userId");

            CREATE POLICY "Users can delete own memories" ON public.%I
                FOR DELETE USING (auth.uid() = "userId");
        $policy$, table_name, table_name, table_name, table_name);
    END LOOP;
END
$$;

CREATE POLICY "Users can view own logs" ON public.logs
    FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "Users can create own logs" ON public.logs
    FOR INSERT WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can manage own participants" ON public.participants
    FOR ALL USING (auth.uid() = "userId");

CREATE POLICY "Users can manage own cache" ON public.cache
    FOR ALL USING (auth.uid() = "userId");

-- Create function to automatically create account on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.accounts (id, email, name, username)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email)
    );
    RETURN NEW;
END;
$$ language plpgsql security definer;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
