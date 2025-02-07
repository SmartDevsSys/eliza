import { createContext, useContext, useState, useCallback } from "react";
import type { UUID } from "@elizaos/core";

interface TypingStatusContextType {
    typingAgents: Set<UUID>;
    setAgentTyping: (agentId: UUID, isTyping: boolean) => void;
}

const TypingStatusContext = createContext<TypingStatusContextType | undefined>(undefined);

export function TypingStatusProvider({ children }: { children: React.ReactNode }) {
    const [typingAgents, setTypingAgents] = useState<Set<UUID>>(new Set());

    const setAgentTyping = useCallback((agentId: UUID, isTyping: boolean) => {
        setTypingAgents(prev => {
            const next = new Set(prev);
            if (isTyping) {
                next.add(agentId);
            } else {
                next.delete(agentId);
            }
            return next;
        });
    }, []);

    return (
        <TypingStatusContext.Provider value={{ typingAgents, setAgentTyping }}>
            {children}
        </TypingStatusContext.Provider>
    );
}

export function useTypingStatus() {
    const context = useContext(TypingStatusContext);
    if (!context) {
        throw new Error("useTypingStatus must be used within a TypingStatusProvider");
    }
    return context;
}
