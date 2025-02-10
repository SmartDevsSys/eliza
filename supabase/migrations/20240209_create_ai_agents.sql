-- Create AI agents table
create table if not exists public.ai_agents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    logo text not null,
    tags text[] not null default '{}',
    bio text[] not null default '{}',
    lore text[] not null default '{}',
    model_provider text not null default 'mistral',
    plugins jsonb[] not null default '{}',
    clients jsonb[] not null default '{}',
    settings jsonb not null default '{
        "secrets": {},
        "voice": {
            "model": "en_US-male-medium"
        }
    }',
    message_examples jsonb[] not null default '{}',
    post_examples jsonb[] not null default '{}',
    topics jsonb[] not null default '{}',
    style jsonb not null default '{
        "all": [],
        "chat": [],
        "post": []
    }',
    adjectives jsonb[] not null default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create RLS policies
alter table public.ai_agents enable row level security;

create policy "Users can view their own AI agents"
    on public.ai_agents for select
    using (auth.uid() = user_id);

create policy "Users can insert their own AI agents"
    on public.ai_agents for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own AI agents"
    on public.ai_agents for update
    using (auth.uid() = user_id);

create policy "Users can delete their own AI agents"
    on public.ai_agents for delete
    using (auth.uid() = user_id);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

create trigger handle_ai_agents_updated_at
    before update on public.ai_agents
    for each row
    execute procedure public.handle_updated_at();

-- Create index for faster queries
create index ai_agents_user_id_idx on public.ai_agents(user_id);
