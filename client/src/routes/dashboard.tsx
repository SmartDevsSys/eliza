import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { BarChart } from "@/components/ui/bar-chart";

interface Agent {
  id: string;
  name: string;
  status: string;
  deployment_url?: string;
  plan_type: string;
}

interface Subscription {
  plan_type: string;
  status: string;
}

interface RequestStat {
  agent_id: string;
  agent_name: string;
  request_count: number;
  date: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestStats, setRequestStats] = useState<RequestStat[]>([]);
  const [agentsByPlan, setAgentsByPlan] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    // Don't fetch if auth is still loading or no user
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      try {
        // Fetch data in parallel
        const [agentsResponse, subscriptionResponse, statsResponse] = await Promise.all([
          supabase
            .from("agents")
            .select("*")
            .eq("status", "deployed"),
          supabase
            .from("subscriptions")
            .select("plan_type, status")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("request_stats")
            .select("agent_id, agent_name, request_count, date")
            .eq("user_id", user.id)
            .order("date", { ascending: true })
            .limit(100)
        ]);

        if (mounted) {
          if (!agentsResponse.error && agentsResponse.data) {
            setAgents(agentsResponse.data);
            // Calculate agents by plan
            const planCounts: Record<string, number> = {};
            agentsResponse.data.forEach(agent => {
              planCounts[agent.plan_type] = (planCounts[agent.plan_type] || 0) + 1;
            });
            setAgentsByPlan(planCounts);
          }
          if (!subscriptionResponse.error && subscriptionResponse.data) {
            setSubscription(subscriptionResponse.data);
          }
          if (!statsResponse.error && statsResponse.data) {
            setRequestStats(statsResponse.data);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Subscribe to agent changes
    const agentSubscription = supabase
      .channel("agents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      agentSubscription.unsubscribe();
    };
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">
          {authLoading ? "Initializing..." : "Loading dashboard..."}
        </p>
      </div>
    );
  }

  // Don't render if no user
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-sm text-muted-foreground">Please sign in to view dashboard</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => window.location.href = '/deploy'}>
          <Plus className="mr-2 h-4 w-4" />
          Deploy Agent
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-sm text-muted-foreground">Username</div>
              <div className="font-medium">{user?.user_metadata?.username || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="font-medium">{user?.email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Plan</div>
              <div className="font-medium capitalize">
                {subscription?.plan_type || "Loading..."}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agents by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(agentsByPlan).length === 0 ? (
              <p className="text-muted-foreground">No agents deployed yet.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(agentsByPlan).map(([plan, count]) => (
                  <div key={plan} className="flex justify-between items-center">
                    <span className="capitalize">{plan}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Request Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {requestStats.length === 0 ? (
              <p className="text-muted-foreground">No request data available.</p>
            ) : (
              <div className="h-[300px]">
                <BarChart
                  data={requestStats}
                  xField="date"
                  yField="request_count"
                  categoryField="agent_name"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deployed Agents ({agents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-muted-foreground">No agents deployed yet.</p>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      {agent.deployment_url && (
                        <a
                          href={agent.deployment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View deployment
                        </a>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                        {agent.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
