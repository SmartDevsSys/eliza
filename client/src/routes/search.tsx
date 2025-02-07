import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router-dom";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import type { UUID } from "@elizaos/core";
import { AgentStatus } from "@/components/ui/typing-indicator";
import { useTypingStatus } from "@/contexts/typing-status";

interface Agent {
    id: UUID;
    name: string;
}

export default function SearchPage() {
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
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">Available Agents</h1>
                <NavLink to="/create">
                    <Button className="gap-2">
                        <Plus className="size-4" />
                        Create New Agent
                    </Button>
                </NavLink>
            </div>

            <div className="max-w-xl mx-auto mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search agents by name..." 
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgents.map((agent: Agent) => (
                    <div
                        key={agent.id}
                        className="group relative rounded-lg border bg-card p-6 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-4">
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
                            <NavLink to={`/chat/${agent.id}`}>
                                <Button variant="secondary" size="icon">
                                    <MessageSquare className="size-4" />
                                </Button>
                            </NavLink>
                        </div>
                    </div>
                ))}
            </div>

            {filteredAgents.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                        No agents found matching your search
                    </p>
                </div>
            )}
        </div>
    );
}
