import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: window.localStorage
    }
});

// Initialize session from URL if present (for OAuth)
const params = new URLSearchParams(window.location.hash.substring(1));
const accessToken = params.get('access_token');
const refreshToken = params.get('refresh_token');

if (accessToken && refreshToken) {
    supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
    });
}

export type AIAgent = {
    id: string;
    name: string;
    logo: string;
    tags: string[];
    bio: string[];
    lore: string[];
    model_provider: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    // Optional fields
    system?: string;
    plugins?: any[];
    clients?: any[];
    settings?: {
        secrets: Record<string, any>;
        voice: {
            model: string;
        };
    };
    message_examples?: any[];
    post_examples?: any[];
    topics?: any[];
    style?: {
        all: string[];
        chat: string[];
        post: string[];
    };
    adjectives?: string[];
};

export type Message = {
    id: string;
    text: string;
    user: string;
    roomId: string;
    createdAt: string;
    attachments?: {
        url: string;
        contentType: string;
        title: string;
    }[];
};

export async function createRoom(userId: string, agentId: string) {
    const { data: room, error } = await supabase
        .from('rooms')
        .insert({
            user_id: userId,
            name: `Chat with ${agentId}`,
        })
        .select()
        .single();

    if (error) throw error;
    return room;
}

export async function createAIAgent(agentData: Omit<AIAgent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
            throw new Error('User not authenticated');
        }

        // Check if user already has 3 agents
        const { data: existingAgents, error: countError } = await supabase
            .from('ai_agents')
            .select('id')
            .eq('user_id', user.user.id);

        if (countError) throw countError;
        if (existingAgents && existingAgents.length >= 3) {
            throw new Error('Maximum limit of 3 AI agents reached');
        }

        // Create new agent
        const { data, error } = await supabase
            .from('ai_agents')
            .insert({
                ...agentData,
                user_id: user.user.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        const errorDetails = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in createAIAgent:', {
            error: errorDetails,
            data: agentData
        });
        throw error;
    }
}

export async function getUserAIAgents() {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('user_id', user.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in getUserAIAgents:', error);
        throw error;
    }
}

export async function getOrCreateRoom(userId: string, agentId: string) {
    try {
        // Try to find existing room for this user and agent
        const { data: existingRoom, error: selectError } = await supabase
            .from('rooms')
            .select()
            .eq('user_id', userId)
            .eq('name', `Chat with ${agentId}`)
            .single();

        if (selectError && selectError.code !== 'PGRST116') { // Not found error
            console.error('Error finding room:', selectError);
            throw selectError;
        }

        if (existingRoom) {
            return existingRoom;
        }

        // Create new room if none exists
        const { data: newRoom, error: createError } = await supabase
            .from('rooms')
            .insert({
                user_id: userId,
                name: `Chat with ${agentId}`,
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating room:', createError);
            throw createError;
        }

        return newRoom;
    } catch (error) {
        console.error('Error in getOrCreateRoom:', error);
        throw error;
    }
}

export async function saveMessage(roomId: string, message: Partial<Message>) {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('logs')
            .insert({
                roomId,
                user_id: user.user.id,
                body: {
                    text: message.text,
                    user: message.user,
                    attachments: message.attachments,
                },
                type: 'message',
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving message:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in saveMessage:', error);
        throw error;
    }
}

export async function deleteAIAgent(agentId: string) {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
            throw new Error('User not authenticated');
        }

        const { error } = await supabase
            .from('ai_agents')
            .delete()
            .eq('id', agentId)
            .eq('user_id', user.user.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error in deleteAIAgent:', error);
        throw error;
    }
}

export async function getRoomMessages(roomId: string) {
    try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('logs')
            .select()
            .eq('roomId', roomId)
            .eq('type', 'message')
            .order('createdAt', { ascending: true });

        if (error) {
            console.error('Error getting messages:', error);
            throw error;
        }

        return data.map(log => ({
            id: log.id,
            text: log.body.text,
            user: log.body.user,
            createdAt: log.createdAt,
            attachments: log.body.attachments,
        }));
    } catch (error) {
        console.error('Error in getRoomMessages:', error);
        throw error;
    }
}
