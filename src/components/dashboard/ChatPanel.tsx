import { useState, useRef, useEffect } from 'react';
import { Send, AlertTriangle, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { PeerMessage } from '@/hooks/usePeerNetwork';

interface ChatPanelProps {
  messages: PeerMessage[];
  onSend: (content: string) => void;
  username: string;
  onSendSOS?: () => void;
  onShareLocation?: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority || priority === 'LOW') return null;
  const cls = priority === 'HIGH' ? 'bg-sos/20 text-sos' : 'bg-warning/20 text-warning';
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${cls}`}>{priority}</span>;
}

export default function ChatPanel({ messages, onSend, username, onSendSOS, onShareLocation }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatMessages = messages.filter(m => m.type === 'chat' || m.type === 'sos' || m.type === 'system' || m.type === 'location');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation.
          </div>
        )}
        {chatMessages.map((msg) => {
  if (msg.type === 'system') {
    const isJoin = /joined/i.test(msg.content);
    const isLeave = /left/i.test(msg.content);

    return (
      <div key={msg.id} className="flex justify-center">
        <div className={`max-w-[80%] text-center text-sm italic ${
          isJoin ? 'text-safe' : 'text-muted-foreground'
        }`}>
          {msg.content}
        </div>
      </div>
    );
  }

  const isOwn = msg.sender === username;
  const isSOS = msg.type === 'sos';
  const isLocation = msg.type === 'location';

  return (
    <div
      key={msg.id}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
          isSOS
            ? 'bg-sos/15 border border-sos/30'
            : isLocation
            ? 'bg-secondary/10 border border-border'
            : isOwn
            ? 'bg-primary/15 border border-primary/20'
            : 'bg-secondary border border-border'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${isSOS ? 'text-sos' : 'text-primary'}`}>
            {msg.sender}
          </span>

          <PriorityBadge priority={msg.priority} />

          <span className="text-[10px] text-muted-foreground font-mono">
            {formatTime(msg.timestamp)}
          </span>

          {msg.via === 'peer' && (
            <span className="text-[10px] bg-yellow-600 text-yellow-50 px-1 rounded ml-2">
              P2P
            </span>
          )}

          {msg.via === 'server' && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1 rounded ml-2">
              Srv
            </span>
          )}
        </div>

        {isLocation ? (
          <p className="text-sm text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            {msg.location
              ? `${msg.location.lat.toFixed(4)}, ${msg.location.lng.toFixed(4)}`
              : 'Shared location'}
          </p>
        ) : (
          <p className={`text-sm ${isSOS ? 'text-sos font-semibold' : 'text-foreground'}`}>
            {msg.content}
          </p>
        )}
      </div>
    </div>
  );
})}
      </div>

      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2 mb-2">
          {onSendSOS && (
            <button
              onClick={onSendSOS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sos/15 border border-sos/30 text-sos text-xs font-semibold hover:bg-sos/25 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              SOS
            </button>
          )}
          {onShareLocation && (
            <button
              onClick={onShareLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Share Location
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Input
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Type a message..."
  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
/>
          <Button onClick={handleSend} size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
