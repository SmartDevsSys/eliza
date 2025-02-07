import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserSettings {
  max_agents: number;
  agents_created: number;
}

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Don't fetch if auth is still loading or no user
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      if (!mounted) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (mounted) {
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        if (mounted) {
          setError('Failed to load settings');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const handleSignOut = async () => {
    try {
      setError(null);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out');
    }
  };

  // Show loading state while auth is initializing or data is loading
  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">
          {authLoading ? "Initializing..." : "Loading settings..."}
        </p>
      </div>
    );
  }

  // Don't render if no user
  if (!user) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Please sign in to view settings</p>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-2">
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {user?.email}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">AI Agents</h2>
          <div className="space-y-2">
            <p>
              <span className="text-muted-foreground">Agents Created:</span>{" "}
              {settings?.agents_created || 0} / {settings?.max_agents || 3}
            </p>
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div
                className="bg-primary rounded-full h-2.5"
                style={{
                  width: `${((settings?.agents_created || 0) / (settings?.max_agents || 3)) * 100}%`,
                }}
              ></div>
            </div>
            <p className="text-sm text-muted-foreground">
              You can create up to {settings?.max_agents || 3} AI agents with your account.
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="space-y-4">
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="w-full sm:w-auto"
            >
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
