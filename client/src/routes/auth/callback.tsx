import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Check if profile exists
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          // Create profile if it doesn't exist and we have username in metadata
          if (!profile && session.user.user_metadata?.username) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([{ 
                id: session.user.id, 
                username: session.user.user_metadata.username 
              }]);
            
            if (profileError) {
              console.error('Error creating profile:', profileError);
            }
          }

          // Initialize user settings if needed
          const { data: existingSettings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (!existingSettings) {
            await supabase
              .from('user_settings')
              .insert([
                {
                  user_id: session.user.id,
                  max_agents: 3,
                  agents_created: 0
                }
              ]);
          }

          // Redirect to home page
          navigate('/', { replace: true });
        } catch (error) {
          console.error('Error in callback:', error);
          // Still redirect even if there's an error
          navigate('/', { replace: true });
        }
      }
    });

    // Handle the OAuth callback
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        <p className="mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}
