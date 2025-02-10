import { useAuth } from "@/contexts/auth-context";
import { UserDashboard } from "@/components/user-dashboard";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-sm text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-sm text-muted-foreground">Please sign in to view dashboard</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <UserDashboard />
    </div>
  );
}
