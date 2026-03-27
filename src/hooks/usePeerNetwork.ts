import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PeerMessage {
  id: string;
  type: 'chat' | 'sos' | 'location' | 'status' | 'join' | 'leave';
  sender: string;
  content: string;
  timestamp: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  location?: { lat: number; lng: number };
  status?: 'safe' | 'need-help' | 'critical';
}

export interface PeerUser {
  peerId: string;
  username: string;
  status: 'safe' | 'need-help' | 'critical';
  location?: { lat: number; lng: number };
  lastSeen: number;
}

interface UsePeerNetworkOptions {
  roomId: string;
  username: string;
}

const STORAGE_KEY = 'stillalive_messages';

function loadCachedMessages(): PeerMessage[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function cacheMessages(messages: PeerMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch {}
}

function detectPriority(content: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const high = /\b(sos|help|emergency|trapped|injured|dying|critical|rescue|fire|flood|earthquake)\b/i;
  const medium = /\b(need|urgent|hurry|danger|warning|careful|evacuate|shelter)\b/i;
  if (high.test(content)) return 'HIGH';
  if (medium.test(content)) return 'MEDIUM';
  return 'LOW';
}

export function usePeerNetwork({ roomId, username }: UsePeerNetworkOptions) {
  const [messages, setMessages] = useState<PeerMessage[]>(loadCachedMessages);
  const [users, setUsers] = useState<Map<string, PeerUser>>(new Map());
  const [connected, setConnected] = useState(false);
  const [myPeerId, setMyPeerId] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const addMessage = useCallback((msg: PeerMessage) => {
    if (seenIdsRef.current.has(msg.id)) return;
    seenIdsRef.current.add(msg.id);
    setMessages(prev => {
      const next = [...prev, msg];
      cacheMessages(next);
      return next;
    });
  }, []);

  const handleIncoming = useCallback((payload: { payload: PeerMessage }) => {
    const msg = payload.payload;
    if (msg.sender === username) return; // ignore own broadcasts

    if (msg.type === 'join') {
      setUsers(prev => {
        const next = new Map(prev);
        next.set(msg.sender, {
          peerId: msg.id,
          username: msg.sender,
          status: msg.status || 'safe',
          location: msg.location,
          lastSeen: Date.now(),
        });
        return next;
      });
    } else if (msg.type === 'location') {
      setUsers(prev => {
        const next = new Map(prev);
        const existing = next.get(msg.sender);
        if (existing) {
          next.set(msg.sender, { ...existing, location: msg.location, lastSeen: Date.now() });
        }
        return next;
      });
    } else if (msg.type === 'status') {
      setUsers(prev => {
        const next = new Map(prev);
        const existing = next.get(msg.sender);
        if (existing) {
          next.set(msg.sender, { ...existing, status: msg.status || 'safe', lastSeen: Date.now() });
        }
        return next;
      });
    } else if (msg.type === 'leave') {
      setUsers(prev => {
        const next = new Map(prev);
        next.delete(msg.sender);
        return next;
      });
    }

    if (msg.type === 'chat' || msg.type === 'sos') {
      addMessage(msg);
    }
  }, [addMessage, username]);

  useEffect(() => {
    const peerId = `sa-${roomId}-${username}-${Math.random().toString(36).slice(2, 6)}`;
    setMyPeerId(peerId);

    const channelName = `zone:${roomId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'message' }, (payload: any) => {
        handleIncoming(payload);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newUsers = new Map<string, PeerUser>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.username !== username) {
              newUsers.set(p.username, {
                peerId: p.peerId || '',
                username: p.username,
                status: p.status || 'safe',
                location: p.location,
                lastSeen: Date.now(),
              });
            }
          });
        });
        setUsers(newUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          await channel.track({
            username,
            peerId,
            status: 'safe',
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          id: crypto.randomUUID(),
          type: 'leave',
          sender: username,
          content: '',
          timestamp: Date.now(),
        },
      });
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [roomId, username, handleIncoming]);

  const broadcast = useCallback((msg: PeerMessage) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'message',
      payload: msg,
    });
  }, []);

  const sendMessage = useCallback((content: string) => {
    const msg: PeerMessage = {
      id: crypto.randomUUID(),
      type: 'chat',
      sender: username,
      content,
      timestamp: Date.now(),
      priority: detectPriority(content),
    };
    addMessage(msg);
    broadcast(msg);
  }, [username, addMessage, broadcast]);

  const sendSOS = useCallback((location?: { lat: number; lng: number }) => {
    const msg: PeerMessage = {
      id: crypto.randomUUID(),
      type: 'sos',
      sender: username,
      content: `🚨 SOS ALERT from ${username}! Immediate assistance needed!`,
      timestamp: Date.now(),
      priority: 'HIGH',
      location,
    };
    addMessage(msg);
    broadcast(msg);
  }, [username, addMessage, broadcast]);

  const shareLocation = useCallback((location: { lat: number; lng: number }) => {
    const msg: PeerMessage = {
      id: crypto.randomUUID(),
      type: 'location',
      sender: username,
      content: '',
      timestamp: Date.now(),
      location,
    };
    broadcast(msg);
    // Update presence with location
    channelRef.current?.track({
      username,
      peerId: myPeerId,
      status: 'safe',
      location,
      online_at: new Date().toISOString(),
    });
  }, [username, myPeerId, broadcast]);

  const updateStatus = useCallback((status: 'safe' | 'need-help' | 'critical') => {
    const msg: PeerMessage = {
      id: crypto.randomUUID(),
      type: 'status',
      sender: username,
      content: '',
      timestamp: Date.now(),
      status,
    };
    broadcast(msg);
    channelRef.current?.track({
      username,
      peerId: myPeerId,
      status,
      online_at: new Date().toISOString(),
    });
  }, [username, myPeerId, broadcast]);

  return {
    messages,
    users,
    connected,
    myPeerId,
    sendMessage,
    sendSOS,
    shareLocation,
    updateStatus,
  };
}
