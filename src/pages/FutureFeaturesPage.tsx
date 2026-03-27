import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Brain, Image, Network, Satellite, Plane } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Brain,
    title: 'AI Disaster Detection',
    desc: 'Machine learning models analyze sensor data, social feeds, and environmental patterns to detect and predict disaster events in real-time.',
    mockContent: ['Seismic pattern analysis', 'Weather anomaly detection', 'Social media signal processing'],
  },
  {
    icon: Image,
    title: 'Image Upload & Damage Analysis',
    desc: 'Upload photos of affected areas. AI classifies damage severity and generates reports for response teams.',
    mockContent: ['Structural damage classification', 'Road blockage detection', 'Automated severity scoring'],
  },
  {
    icon: Network,
    title: 'Multi-hop Mesh Networking',
    desc: 'Messages relay through multiple devices to reach destinations beyond direct range. True mesh networking for extended coverage.',
    mockContent: ['Automatic route discovery', 'Multi-hop relay', 'Self-healing network topology'],
  },
  {
    icon: Satellite,
    title: 'Satellite Backup Integration',
    desc: 'When all local networks fail, fall back to satellite communication for critical SOS messages and location data.',
    mockContent: ['Iridium/Starlink integration', 'Low-bandwidth message queuing', 'Priority-based satellite access'],
  },
  {
    icon: Plane,
    title: 'Drone Rescue Coordination',
    desc: 'Coordinate autonomous rescue drones that can deliver supplies, map disaster zones, and locate survivors.',
    mockContent: ['Autonomous flight paths', 'Supply drop coordination', 'Thermal survivor detection'],
  },
];

export default function FutureFeaturesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background bg-grid-pattern p-4">
      <div className="container max-w-4xl mx-auto">
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

        <h1 className="text-3xl font-bold text-foreground mb-2">Future Features</h1>
        <p className="text-muted-foreground mb-10">What's coming next on the StillAlive roadmap.</p>

        <div className="space-y-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-xl bg-card border border-border"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <f.icon className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                </div>
                <Badge variant="outline" className="border-warning text-warning text-xs">Coming Soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{f.desc}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {f.mockContent.map(item => (
                  <div key={item} className="p-3 rounded-lg bg-secondary text-xs text-secondary-foreground font-mono">
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
