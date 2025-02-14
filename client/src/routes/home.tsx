import { useQueries, useQuery } from "@tanstack/react-query";
import { Cog, MessageCircle, MessageSquare } from "lucide-react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router";
import type { UUID, Character } from "@elizaos/core";
import type { UseQueryResult } from "@tanstack/react-query";

export default function Home() {
    const agentsQuery = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
        refetchInterval: 5_000
    });

    const agents = agentsQuery?.data?.agents;

    type AgentDetails = {
        id: UUID;
        character: Character;
    };

    const agentQueries = useQueries<Array<UseQueryResult<AgentDetails, Error>>>({
        queries: (agents ?? []).map((agent: { id: UUID }) => ({
            queryKey: ["agent", agent.id],
            queryFn: () => apiClient.getAgent(agent.id),
            refetchInterval: 5_000
        }))
    });

    const agentsWithDetails: AgentDetails[] = agentQueries
        .filter((query): query is UseQueryResult<AgentDetails, Error> & { data: AgentDetails } => 
            query.data !== undefined
        )
        .map((query) => query.data);

    return (
        <div className="flex flex-col gap-4 h-full p-4">
            <PageTitle title="Agents" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {agentsWithDetails.map((agent) => (
                    <Card key={agent.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <img
                                    src={`/${agent.character.name.toLowerCase()}.png`}
                                    alt={agent.character.name}
                                    className="size-8"
                                />
                                <span>{agent.character.name}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <CardDescription className="line-clamp-4 text-sm">
                                {agent.character.bio?.[0] || "No bio available"}
                            </CardDescription>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <div className="flex items-center gap-4 w-full">
                                <NavLink
                                    to={`/chat/${agent.id}`}
                                    className="w-full"
                                >
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <MessageCircle className="mr-2 size-4" />
                                        Chat
                                    </Button>
                                </NavLink>
                                <NavLink to={`/settings/${agent.id}`}>
                                    <Button size="icon" variant="outline">
                                        <Cog className="size-4" />
                                    </Button>
                                </NavLink>
                            </div>
                            {agent.character.settings?.secrets?.telegram && (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    asChild
                                >
                                    <a
                                        href={`https://t.me/${agent.character.settings.secrets.telegram}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <MessageSquare className="mr-2 size-4" />
                                        Telegram
                                    </a>
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
