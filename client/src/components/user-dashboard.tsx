import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Subscription {
  plan_type: string;
  status: string;
}

export function UserDashboard() {
  const { user, signOut } = useAuth();
  const [deployedAgentsCount, setDeployedAgentsCount] = useState<number>(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch deployed agents count
    const fetchDeployedAgents = async () => {
      const { count, error } = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("status", "deployed");

      if (!error && count !== null) {
        setDeployedAgentsCount(count);
      }
    };

    // Fetch subscription info
    const fetchSubscription = async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_type, status")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setSubscription(data);
      }
    };

    fetchDeployedAgents();
    fetchSubscription();

    // Subscribe to agent status changes
    const subscription = supabase
      .channel("agents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
          filter: `status=eq.deployed`,
        },
        () => {
          fetchDeployedAgents();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <User className="size-4" />
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
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Agents</span>
          <span className="font-medium">{deployedAgentsCount} deployed</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium capitalize">
            {subscription?.plan_type || "Loading..."}
          </span>
        </div>
      </div>
    </div>
  );
}
