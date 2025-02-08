import type { UUID, Character } from "@elizaos/core";
import { getOrCreateRoom, saveMessage, getRoomMessages, supabase } from "./supabase";

const BASE_URL = `https://apibabythink-production.up.railway.app`;

const fetcher = async ({
    url,
    method,
    body,
    headers,
}: {
    url: string;
    method?: "GET" | "POST";
    body?: object | FormData;
    headers?: HeadersInit;
}) => {
    const options: RequestInit = {
        method: method ?? "GET",
        headers: headers
            ? headers
            : {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
    };

    if (method === "POST") {
        if (body instanceof FormData) {
            if (options.headers && typeof options.headers === 'object') {
                options.headers = Object.fromEntries(
                    Object.entries(options.headers as Record<string, string>)
                        .filter(([key]) => key !== 'Content-Type')
                );
            }
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
        }
    }

    return fetch(`${BASE_URL}${url}`, options).then(async (resp) => {
        const contentType = resp.headers.get('Content-Type');
        if (contentType === "audio/mpeg") {
            return await resp.blob();
        }

        if (!resp.ok) {
            const errorText = await resp.text();
            console.error("Error: ", errorText);

            let errorMessage = "An error occurred.";
            try {
                const errorObj = JSON.parse(errorText);
                errorMessage = errorObj.message || errorMessage;
            } catch {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(errorMessage);
        }
            
        return resp.json();
    });
};

export const apiClient = {
    sendMessage: async (
        agentId: string,
        message: string,
        selectedFile?: File | null
    ) => {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            throw new Error("User not authenticated");
        }

        // Get or create room for this chat
        const room = await getOrCreateRoom(user.data.user.id, agentId);

        // Save user message to Supabase
        const attachments = selectedFile ? [{
            url: URL.createObjectURL(selectedFile),
            contentType: selectedFile.type,
            title: selectedFile.name,
        }] : undefined;

        await saveMessage(room.id, {
            text: message,
            user: "user",
            attachments,
        });

        // Send message to API
        const formData = new FormData();
        formData.append("text", message);
        formData.append("user", "user");

        if (selectedFile) {
            formData.append("file", selectedFile);
        }

        // Get API response
        const response = await fetcher({
            url: `/${agentId}/message`,
            method: "POST",
            body: formData,
        });

        // Save agent response to Supabase
        const savedResponse = await saveMessage(room.id, {
            text: response[0].text,
            user: "system",
        });

        return [{
            ...response[0],
            id: savedResponse.id,
            createdAt: savedResponse.createdAt,
        }];
    },

    loadMessages: async (agentId: string) => {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            throw new Error("User not authenticated");
        }

        // Get room for this chat
        const room = await getOrCreateRoom(user.data.user.id, agentId);
        
        // Load messages from Supabase
        return getRoomMessages(room.id);
    },

    getAgents: () => fetcher({ url: "/agents" }),
    
    getAgent: (agentId: string): Promise<{ id: UUID; character: Character }> =>
        fetcher({ url: `/agents/${agentId}` }),
    
    tts: (agentId: string, text: string) =>
        fetcher({
            url: `/${agentId}/tts`,
            method: "POST",
            body: {
                text,
            },
            headers: {
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
                "Transfer-Encoding": "chunked",
            },
        }),
    
    whisper: async (agentId: string, audioBlob: Blob) => {
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");
        return fetcher({
            url: `/${agentId}/whisper`,
            method: "POST",
            body: formData,
        });
    },
};
