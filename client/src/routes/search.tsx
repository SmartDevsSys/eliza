import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router-dom";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import type { UUID } from "@elizaos/core";
import { AgentStatus } from "@/components/ui/typing-indicator";
import { useTypingStatus } from "@/contexts/typing-status";
import Chat from "@/components/chat";

interface Agent {
    id: UUID;
    name: string;
}

export default function SearchPage() {
    const [selectedAgent, setSelectedAgent] = useState<UUID | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { typingAgents } = useTypingStatus();
    
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
        refetchInterval: 5000
    });

    const agents = query?.data?.agents;

    const filteredAgents = useMemo(() => {
        if (!agents) return [];
        if (!searchQuery.trim()) return agents;
        
        const normalizedQuery = searchQuery.toLowerCase().trim();
        return agents.filter((agent: Agent) => 
            agent.name.toLowerCase().includes(normalizedQuery)
        );
    }, [agents, searchQuery]);

    return (
        <div className="flex h-[calc(100dvh-4rem)]">
            {/* Left sidebar */}
            <div className="w-[350px] border-r flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h1 className="text-xl font-semibold">Agents</h1>
                    <NavLink to="/create">
                        <Button size="icon" variant="ghost">
                            <Plus className="size-4" />
                        </Button>
                    </NavLink>
                </div>

                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search agents..." 
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredAgents.map((agent: Agent) => (
                        <div
                            key={agent.id}
                            className={`p-4 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                                selectedAgent === agent.id ? 'bg-muted' : ''
                            }`}
                            onClick={() => setSelectedAgent(agent.id)}
                        >
                            <Avatar className="size-12 border">
                                <AvatarImage src="/elizaos-icon.png" />
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">
                                    {agent.name}
                                </h3>
                                <AgentStatus 
                                    isOnline={true}
                                    isTyping={typingAgents.has(agent.id)}
                                />
                            </div>
                        </div>
                    ))}

                    {filteredAgents.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">
                                No agents found matching your search
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right chat area */}
            <div className="flex-1 border-l bg-muted/10">
                {selectedAgent ? (
                    <Chat agentId={selectedAgent} />
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">
                            Select an agent to start chatting
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
