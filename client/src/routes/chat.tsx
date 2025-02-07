import { useParams } from "react-router-dom";
import Chat from "@/components/chat";
import type { UUID } from "@elizaos/core";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router-dom";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentStatus } from "@/components/ui/typing-indicator";
import { useTypingStatus } from "@/contexts/typing-status";

interface Agent {
    id: UUID;
    name: string;
}

export default function AgentRoute() {
    const { agentId } = useParams<{ agentId: UUID }>();
    const { typingAgents } = useTypingStatus();
    
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
        refetchInterval: 5_000
    });

    const agents = query?.data?.agents;
    const currentAgent = agents?.find((a: Agent) => a.id === agentId);

    if (!agentId) return <div>No agent selected.</div>;

    return (
        <div className="flex flex-col h-screen">
            {/* Chat Header */}
            <div className="border-b bg-muted/50 backdrop-blur-sm p-4 flex items-center gap-3">
                <NavLink to="/search">
                    <Button variant="ghost" size="icon" className="mr-2">
                        <ArrowLeft className="size-4" />
                    </Button>
                </NavLink>
                <Avatar className="size-9 border">
                    <AvatarImage src="/elizaos-icon.png" />
                </Avatar>
                <div className="flex flex-col flex-1">
                    <span className="font-medium">
                        {currentAgent?.name}
                    </span>
                    <AgentStatus 
                        isOnline={true}
                        isTyping={typingAgents.has(agentId)}
                    />
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1">
                <Chat agentId={agentId} />
            </div>
        </div>
    );
}
