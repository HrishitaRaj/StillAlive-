import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Mode = 'login' | 'signup';

export default function RescuerAuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === 'signup' && !name)) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, role: 'rescuer' },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: 'Account created!', description: 'Check your email to verify, then log in.' });
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Welcome back!', description: 'Redirecting to emergency network...' });
        navigate('/join');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center p-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">Rescuer Portal</span>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border bg-secondary p-1 mb-8">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${
              mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rescuer@example.com"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-5 font-bold"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : mode === 'login' ? 'Login as Rescuer' : 'Create Rescuer Account'}
          </Button>
        </form>

        <div className="mt-6 p-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">
            <Shield className="w-3 h-3 inline mr-1 text-primary" />
            Rescuer accounts get priority access, coordination tools, and the ability to manage emergency zones.
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 font-mono">
          Not a rescuer? <button onClick={() => navigate('/join')} className="text-primary hover:underline">Enter as civilian</button>
        </p>
      </motion.div>
    </div>
  );
}