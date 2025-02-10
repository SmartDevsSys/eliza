import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase, getUserAIAgents, type AIAgent } from "@/lib/supabase";
import { LogOut, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Subscription {
  plan_type: string;
  status: string;
}

export function UserDashboard() {
  const { user, signOut } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [agentCount, setAgentCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch agent count and subscription info
    const fetchData = async () => {
      try {
        const agents = await getUserAIAgents();
        setAgentCount(agents.length);
      } catch (error) {
        console.error('Error fetching AI agents:', error);
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_type, status")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setSubscription(data);
      }
    };

    fetchData();
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-card rounded-lg p-6 border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="size-5" />
            <span className="font-medium truncate">{user.email}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            title="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <span className="text-sm text-muted-foreground block">Current Plan</span>
            <span className="font-medium capitalize block mt-1">
              {subscription?.plan_type || "Free"}
            </span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground block">AI Agents</span>
            <span className="font-medium block mt-1">{agentCount} / 3</span>
          </div>
        </div>

        {agentCount < 3 && (
          <Button
            onClick={() => window.location.href = '/create'}
            className="w-full mt-6 flex items-center gap-2"
          >
            <Plus className="size-4" />
            Create AI Agent
          </Button>
        )}
      </div>
    </div>
  );
}
