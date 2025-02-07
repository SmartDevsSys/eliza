import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type AgentStatus = "pending" | "deploying" | "deployed" | "failed";

interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  railway_project_id?: string;
}

export default function AgentStatusPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const fetchAgent = async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      setAgent(data);
    };

    // Initial fetch
    fetchAgent();

    // Subscribe to changes
    const subscription = supabase
      .channel(`agent-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
          filter: `id=eq.${agentId}`,
        },
        (payload) => {
          setAgent(payload.new as Agent);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [agentId]);

  const getStatusMessage = (status: AgentStatus) => {
    switch (status) {
      case "pending":
        return "Preparing to deploy your agent...";
      case "deploying":
        return "Deploying your agent to Railway...";
      case "deployed":
        return "Your agent has been successfully deployed!";
      case "failed":
        return "Failed to deploy your agent.";
      default:
        return "Unknown status";
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6 bg-destructive/10 text-destructive">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error}</p>
        </Card>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="p-6 max-w-2xl mx-auto">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          
          <div className="flex justify-center">
            {agent.status !== "deployed" && (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
          </div>

          <p className="text-lg">
            {getStatusMessage(agent.status)}
          </p>

          {agent.status === "deployed" && (
            <Button
              onClick={() => navigate(`/agents/${agent.id}/chat`)}
              className="mt-4"
            >
              Start Chatting
            </Button>
          )}

          {agent.status === "failed" && (
            <Button
              variant="outline"
              onClick={() => navigate("/create")}
              className="mt-4"
            >
              Try Again
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
