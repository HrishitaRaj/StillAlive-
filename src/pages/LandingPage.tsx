import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Radio, Shield, MapPin, Users, Zap, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Radio, title: 'P2P Messaging', desc: 'Direct device-to-device communication via WebRTC' },
  { icon: Shield, title: 'SOS Broadcast', desc: 'One-tap emergency alerts to all nearby devices' },
  { icon: MapPin, title: 'Live Location', desc: 'Share and track positions on real-time maps' },
  { icon: Users, title: 'Auto Networks', desc: 'Location-based zones connect you to nearby devices instantly' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background bg-grid-pattern relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-sos/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 container max-w-5xl mx-auto px-4 py-8">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-20"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sos flex items-center justify-center">
              <Zap className="w-4 h-4 text-sos-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">StillAlive</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/future')}
            className="text-muted-foreground border-border hover:text-foreground"
          >
            Roadmap
          </Button>
        </motion.nav>

        {/* Hero */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-secondary mb-6"
          >
            <Wifi className="w-3.5 h-3.5 text-safe" />
            <span className="text-xs font-mono text-muted-foreground tracking-wider uppercase">No Internet Required</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-black mb-6 leading-tight"
          >
            <span className="text-foreground">Still</span>
            <span className="text-gradient-hero">Alive</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto"
          >
            Communication that survives the disaster
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-muted-foreground mb-10 max-w-lg mx-auto"
          >
            When networks fail, StillAlive connects nearby devices peer-to-peer. Send messages, broadcast SOS alerts, and coordinate rescue — all without internet.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => { sessionStorage.removeItem('stillalive_offline_mode'); navigate('/join'); }}
                className="bg-sos hover:bg-sos/90 text-sos-foreground px-8 py-6 text-lg font-bold glow-sos"
              >
                Enter Emergency Network
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { sessionStorage.setItem('stillalive_offline_mode', '1'); navigate('/join'); }}
                className="px-6 py-6 text-lg font-bold"
                title="Start in fully offline peer-to-peer mode"
              >
                Fully Offline Emergency
              </Button>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-muted-foreground mt-4"
          >
            Are you a rescuer?{' '}
            <button onClick={() => navigate('/rescuer')} className="text-primary font-semibold hover:underline">
              Login here
            </button>
          </motion.p>
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
            >
              <f.icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-bold text-foreground mb-8">How It Works</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4">
            {['Tap to enter the network', 'Auto-join your local zone', 'Communicate peer-to-peer'].map((step, i) => (
              <div key={step} className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">{i + 1}</span>
                  <span className="text-foreground text-sm">{step}</span>
                </div>
                {i < 2 && <span className="hidden md:block text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </motion.div>

        <footer className="text-center py-8 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">STILLALIVE v1.0 — EMERGENCY MESH NETWORK</p>
        </footer>
      </div>
    </div>
  );
}
