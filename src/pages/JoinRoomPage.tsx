import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowLeft, Radio, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';

function generateCallsign() {
  const adjectives = ['Brave', 'Swift', 'Iron', 'Echo', 'Storm', 'Flare', 'Bolt', 'Apex', 'Nova', 'Ember'];
  const nouns = ['Fox', 'Wolf', 'Hawk', 'Bear', 'Lion', 'Lynx', 'Crow', 'Viper', 'Orca', 'Raven'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

function geoToRoomId(lat: number, lng: number): string {
  // ~1km grid cells — rounds to ~0.01 degree
  const gridLat = Math.round(lat * 100);
  const gridLng = Math.round(lng * 100);
  return `zone-${gridLat}-${gridLng}`;
}

type Phase = 'idle' | 'locating' | 'connecting' | 'error';

export default function JoinRoomPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { join } = useSession();

  const handleEnter = () => {
    setPhase('locating');
    setErrorMsg('');

    if (!navigator.geolocation) {
      // Fallback: use random room if geolocation unavailable
      // No geolocation — proceed and let socket server assign the zone using no coords
      try { sessionStorage.removeItem('stillalive_coords'); } catch {}
      connectWithRoom('');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Save coords for later socket join; let socket server assign authoritative room
        try { sessionStorage.setItem('stillalive_coords', JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })); } catch {}
        connectWithRoom('');
      },
      (err) => {
        console.warn('Geolocation error, using fallback room:', err.message);
        // Still connect, just without coords — server will assign a room
        try { sessionStorage.removeItem('stillalive_coords'); } catch {}
        connectWithRoom('');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const connectWithRoom = (roomId: string) => {
    setPhase('connecting');
    const callsign = generateCallsign();
    // Brief delay for UX feel
    setTimeout(() => {
      // Set username now; authoritative room will be assigned by the socket server.
      join(callsign);
      navigate('/dashboard');
    }, 800);
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

        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-sos flex items-center justify-center">
            <Zap className="w-4 h-4 text-sos-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">StillAlive</span>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">Enter Emergency Network</h1>
        <p className="text-muted-foreground mb-8">
          Tap below to instantly connect with nearby devices. Your location determines your network zone — no setup needed.
        </p>

        {phase === 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Button
              onClick={handleEnter}
              className="w-full bg-sos hover:bg-sos/90 text-sos-foreground py-6 text-lg font-bold glow-sos"
            >
              <Radio className="w-5 h-5 mr-2" />
              Enter Emergency Network
            </Button>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-card border border-border">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your location is used to assign you to a local network zone (~1km radius). A random callsign is generated automatically. No personal data is stored.
              </p>
            </div>
          </motion.div>
        )}

        {(phase === 'locating' || phase === 'connecting') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/20 animate-ping" />
            </div>
            <p className="text-foreground font-semibold">
              {phase === 'locating' ? 'Detecting your location...' : 'Connecting to nearby peers...'}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {phase === 'locating' ? 'Requesting GPS coordinates' : 'Establishing P2P connections'}
            </p>
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-2 p-4 rounded-lg bg-sos/10 border border-sos/30">
              <AlertCircle className="w-5 h-5 text-sos mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Connection failed</p>
                <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
              </div>
            </div>
            <Button onClick={handleEnter} className="w-full" variant="outline">
              Try Again
            </Button>
          </motion.div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6 font-mono">
          Connections are peer-to-peer • No data stored on servers
        </p>
      </motion.div>
    </div>
  );
}
