-- Create subscriptions table
CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type text NOT NULL CHECK (plan_type IN ('basic', 'pro', 'enterprise')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription for existing users
INSERT INTO public.subscriptions (user_id, plan_type)
SELECT id, 'basic' FROM auth.users ON CONFLICT DO NOTHING;

-- Create function to automatically create basic subscription for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_type)
  VALUES (NEW.id, 'basic');
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Create trigger to add subscription when new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
