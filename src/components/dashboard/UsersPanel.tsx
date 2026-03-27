import { User, Shield, HelpCircle, AlertOctagon, Radio } from 'lucide-react';
import type { PeerUser } from '@/hooks/usePeerNetwork';

interface UsersPanelProps {
  users: Map<string, PeerUser>;
  username: string;
  connected: boolean;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'safe': return <Shield className="w-3.5 h-3.5 text-safe" />;
    case 'need-help': return <HelpCircle className="w-3.5 h-3.5 text-warning" />;
    case 'critical': return <AlertOctagon className="w-3.5 h-3.5 text-sos" />;
    default: return <Shield className="w-3.5 h-3.5 text-safe" />;
  }
}

export default function UsersPanel({ users, username, connected }: UsersPanelProps) {
  const userList = Array.from(users.values());

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      {/* Network status */}
      <div className="mb-6 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Network Status</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-safe' : 'bg-warning animate-pulse'}`} />
          <span className="text-sm text-foreground font-medium">{connected ? 'Connected — scanning for nearby users' : 'Connecting to network...'}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Users in your zone are discovered and connected automatically.</p>
      </div>

      {/* User list */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Nearby Users ({userList.length + 1})
        </h3>
        <div className="space-y-2">
          {/* Self */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{username} <span className="text-xs text-muted-foreground">(you)</span></p>
            </div>
            <div className="w-2 h-2 rounded-full bg-safe" />
          </div>

          {userList.map(user => (
            <div key={user.peerId} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{user.username}</p>
                <div className="flex items-center gap-1">
                  <StatusIcon status={user.status} />
                  <span className="text-[10px] text-muted-foreground capitalize">{user.status}</span>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-safe" />
            </div>
          ))}

          {userList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No other users in your zone yet. They'll appear automatically when nearby.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
