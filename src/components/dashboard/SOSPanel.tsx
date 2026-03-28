import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, HelpCircle, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PeerMessage } from '@/hooks/usePeerNetwork';

interface SOSPanelProps {
  messages: PeerMessage[];
  onSendSOS: () => void;
  username: string;
  status: string;
  onUpdateStatus: (status: 'safe' | 'need-help' | 'critical') => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const statuses = [
  { id: 'safe' as const, label: 'Safe', icon: Shield, color: 'bg-safe text-safe-foreground' },
  { id: 'need-help' as const, label: 'Need Help', icon: HelpCircle, color: 'bg-warning text-warning-foreground' },
  { id: 'critical' as const, label: 'Critical', icon: AlertOctagon, color: 'bg-sos text-sos-foreground' },
];

export default function SOSPanel({ messages, onSendSOS, onUpdateStatus }: SOSPanelProps) {
  const [currentStatus, setCurrentStatus] = useState<'safe' | 'need-help' | 'critical'>('safe');
  const [sosSent, setSosSent] = useState(false);
  const sosMessages = messages.filter(m => m.type === 'sos')
    .slice()
    .sort((a, b) => {
      // active first, then priority high -> low, then recent
      const aActive = a.active === false ? 0 : 1;
      const bActive = b.active === false ? 0 : 1;
      if (aActive !== bActive) return bActive - aActive;
      const prio = (p: any) => (p === 'high' || p === 'HIGH' ? 3 : (p === 'medium' || p === 'MEDIUM' ? 2 : 1));
      const pa = prio(a.priority);
      const pb = prio(b.priority);
      if (pa !== pb) return pb - pa;
      return b.timestamp - a.timestamp;
    });

  const handleSOS = () => {
    onSendSOS();
    setSosSent(true);
    setTimeout(() => setSosSent(false), 3000);
  };

  const handleStatusChange = (status: 'safe' | 'need-help' | 'critical') => {
    setCurrentStatus(status);
    onUpdateStatus(status);
  };

  const activeCount = messages.filter(m => m.type === 'sos' && (m.active === undefined || m.active === true)).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      {/* SOS Button */}
      <div className="flex flex-col items-center py-8">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSOS}
          className={`w-40 h-40 rounded-full bg-sos flex flex-col items-center justify-center gap-2 ${
            sosSent ? 'glow-sos' : 'animate-pulse-sos'
          }`}
        >
          <AlertTriangle className="w-12 h-12 text-sos-foreground" />
          <span className="text-sos-foreground font-bold text-lg">SEND SOS</span>
        </motion.button>
        {sosSent && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sos text-sm font-semibold mt-4"
          >
            🚨 SOS Broadcast Sent!
          </motion.p>
        )}
      </div>

      {/* Status Toggle */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Your Status</h3>
        <div className="grid grid-cols-3 gap-2">
          {statuses.map(s => (
            <Button
              key={s.id}
              variant="outline"
              onClick={() => handleStatusChange(s.id)}
              className={`flex flex-col gap-1 h-auto py-3 ${
                currentStatus === s.id ? s.color : 'border-border text-muted-foreground'
              }`}
            >
              <s.icon className="w-4 h-4" />
              <span className="text-xs">{s.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* SOS Messages */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">SOS Alerts ({activeCount})</h3>
        {sosMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SOS alerts.</p>
        ) : (
          <div className="space-y-2">
            {sosMessages.map(msg => (
              <div key={msg.id} className={`p-3 rounded-lg ${msg.active === false ? 'bg-secondary/60 border border-border text-muted-foreground opacity-60' : 'bg-sos/10 border border-sos/20'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${msg.active === false ? 'text-muted-foreground' : 'text-sos'}`}>{msg.sender}</span>
                    {msg.via === 'peer' && <span className="text-[10px] bg-yellow-600 text-yellow-50 px-1 rounded">P2P</span>}
                    {msg.via === 'server' && <span className="text-[10px] bg-slate-800 text-slate-300 px-1 rounded">Srv</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {msg.priority && (msg.priority === 'high' || msg.priority === 'HIGH') && <span className="text-[10px] bg-sos text-sos-foreground px-2 py-0.5 rounded font-bold">HIGH PRIORITY</span>}
                    <span className="text-[10px] text-muted-foreground font-mono">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
                <p className={`text-sm ${msg.active === false ? 'text-muted-foreground' : 'text-sos'}`}>{msg.content}{msg.active === false && <span className="ml-2 text-[11px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">User offline</span>}</p>
                {msg.location && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    📍 {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
