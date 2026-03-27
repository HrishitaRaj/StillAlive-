import { useState } from 'react';
import { MessageSquare, AlertTriangle, Map, Users, LogOut, Zap, Radio, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatPanel from './ChatPanel';
import SOSPanel from './SOSPanel';
import MapPanel from './MapPanel';
import UsersPanel from './UsersPanel';
import type { usePeerNetwork } from '@/hooks/usePeerNetwork';
import type { useGeolocation } from '@/hooks/useGeolocation';

type Tab = 'chat' | 'sos' | 'map' | 'users';

interface DashboardLayoutProps {
  network: ReturnType<typeof usePeerNetwork>;
  geo: ReturnType<typeof useGeolocation>;
  username: string;
  roomId: string;
  onLeave: () => void;
}

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'sos', label: 'SOS', icon: AlertTriangle },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'users', label: 'Users', icon: Users },
];

export default function DashboardLayout({ network, geo, username, roomId, onLeave }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const sosCount = network.messages.filter(m => m.type === 'sos').length;

  // Format zone name for display
  const formatZone = (id: string) => {
    if (id.startsWith('zone-fallback')) return 'Global Zone';
    const match = id.match(/^zone-(-?\d+)-(-?\d+)$/);
    if (match) return `Zone ${match[1]}.${match[2]}`;
    return id;
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-sos flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-sos-foreground" />
          </div>
          <div>
            <span className="font-bold text-sm text-foreground">StillAlive</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 text-primary" />
              <span className="font-mono text-primary font-semibold">{formatZone(roomId)}</span>
              <span>•</span>
              <span>{username}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${network.connected ? 'bg-safe' : 'bg-warning animate-pulse'}`} />
          <span className="text-xs text-muted-foreground">{network.connected ? 'Online' : 'Searching...'}</span>
          <Button variant="ghost" size="sm" onClick={onLeave} className="text-muted-foreground hover:text-foreground ml-2">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatPanel
          messages={network.messages}
          onSend={network.sendMessage}
          username={username}
          onSendSOS={() => {
            const loc = geo.latitude && geo.longitude ? { lat: geo.latitude, lng: geo.longitude } : undefined;
            network.sendSOS(loc);
          }}
          onShareLocation={() => {
            if (geo.latitude && geo.longitude) {
              network.shareLocation({ lat: geo.latitude, lng: geo.longitude });
            }
          }}
        />}
        {activeTab === 'sos' && <SOSPanel messages={network.messages} onSendSOS={() => {
          const loc = geo.latitude && geo.longitude ? { lat: geo.latitude, lng: geo.longitude } : undefined;
          network.sendSOS(loc);
        }} username={username} status="safe" onUpdateStatus={network.updateStatus} />}
        {activeTab === 'map' && <MapPanel users={network.users} geo={geo} roomId={roomId} onShareLocation={() => {
          if (geo.latitude && geo.longitude) {
            network.shareLocation({ lat: geo.latitude, lng: geo.longitude });
          }
        }} messages={network.messages} />}
        {activeTab === 'users' && <UsersPanel users={network.users} username={username} connected={network.connected} />}
      </main>

      {/* Bottom tabs */}
      <nav className="flex border-t border-border bg-card shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors relative ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="font-medium">{tab.label}</span>
            {tab.id === 'sos' && sosCount > 0 && (
              <span className="absolute top-2 right-1/2 translate-x-4 w-4 h-4 rounded-full bg-sos text-sos-foreground text-[10px] flex items-center justify-center font-bold">
                {sosCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
