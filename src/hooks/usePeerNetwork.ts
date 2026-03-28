import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import peerService from '@/services/peerService';

export interface PeerMessage {
  id: string;
  type: 'chat' | 'sos' | 'location' | 'status' | 'join' | 'leave' | 'system' | 'ack';
  sender: string;
  userId?: string;
  content: string;
  timestamp: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'low' | 'medium' | 'high';
  location?: { lat: number; lng: number };
  status?: 'safe' | 'need-help' | 'critical';
  active?: boolean; // for sos entries
  via?: 'server' | 'peer'; // delivery source for debugging/UI
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

function getStorageKey(roomId: string) {
  return `stillalive_messages:${roomId}`;
}

function loadCachedMessagesFor(roomId: string): PeerMessage[] {
  try {
    if (!roomId) return [];
    const data = localStorage.getItem(getStorageKey(roomId));
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function cacheMessagesFor(roomId: string, messages: PeerMessage[]) {
  try {
    if (!roomId) return;
    localStorage.setItem(getStorageKey(roomId), JSON.stringify(messages.slice(-100)));
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
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const [users, setUsers] = useState<Map<string, PeerUser>>(new Map());
  const [connected, setConnected] = useState(false);
  const [myPeerId, setMyPeerId] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pendingAcksRef = useRef<Map<string, { attempts: number; timeout?: any }>>(new Map());
  // track recently-removed users (from socket events) to prefer socket state over lagging presence
  const removedUsersRef = useRef<Map<string, number>>(new Map());

  const addMessage = useCallback((msg: PeerMessage) => {
    if (seenIdsRef.current.has(msg.id)) return;

    // Deduplicate SOS messages by user (userId or sender) and merge updates
    setMessages(prev => {
      if (msg.type === 'sos') {
        const keyId = msg.userId || '';
        const keyName = (msg.sender || '').toString();
        // find existing by matching any of these combinations:
        const exists = prev.find(m => {
          if (m.type !== 'sos') return false;
          const mid = m.userId || '';
          const mname = (m.sender || '').toString();
          return (
            (keyId && mid && keyId === mid) ||
            (keyName && mname && keyName === mname) ||
            (keyId && mname && keyId === mname) ||
            (keyName && mid && keyName === mid)
          );
        });
        if (exists) {
          const next = prev.map(m => {
            if (m.type !== 'sos') return m;
            const mid = m.userId || '';
            const mname = (m.sender || '').toString();
            const match = (
              (keyId && mid && keyId === mid) ||
              (keyName && mname && keyName === mname) ||
              (keyId && mname && keyId === mname) ||
              (keyName && mid && keyName === mid)
            );
            if (match) {
              return { ...m, ...msg, timestamp: Date.now(), active: msg.active !== undefined ? msg.active : true };
            }
            return m;
          });
          cacheMessagesFor(roomId, next);
          seenIdsRef.current.add(msg.id);
          return next;
        }
      }

      seenIdsRef.current.add(msg.id);
      const next = [...prev, msg];
      cacheMessagesFor(roomId, next);
      return next;
    });
  }, []);

  // send a message over PeerJS and wait for an ACK; retry a few times if no ack
  const sendPeerWithRetry = useCallback((msg: PeerMessage) => {
    try {
      const MAX_ATTEMPTS = 3;
      const RETRY_MS = 2000;
      // initial send
      peerService.sendToAll(msg);
      const entry = { attempts: 1 as number, timeout: undefined as any };
      const schedule = () => {
        entry.timeout = setTimeout(() => {
          const existing = pendingAcksRef.current.get(msg.id);
          if (!existing) return; // ack already received
          if (existing.attempts >= MAX_ATTEMPTS) {
            console.warn('[usePeerNetwork] no ack after attempts for', msg.id);
            pendingAcksRef.current.delete(msg.id);
            return;
          }
          existing.attempts += 1;
          pendingAcksRef.current.set(msg.id, existing);
          try { peerService.sendToAll(msg); console.log('[usePeerNetwork] retry peer send', msg.id, 'attempt', existing.attempts); } catch (e) { console.warn('peer retry send failed', e); }
          schedule();
        }, RETRY_MS);
      };
      pendingAcksRef.current.set(msg.id, entry);
      schedule();
    } catch (e) { console.warn('[usePeerNetwork] sendPeerWithRetry failed', e); }
  }, []);

  const handleIncoming = useCallback((payload: { payload: PeerMessage }) => {
    const msg = payload.payload;
    console.debug('usePeerNetwork incoming broadcast', msg);
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

    // Add chat, sos and location messages to local history so UI can render them
    if (msg.type === 'chat' || msg.type === 'sos' || msg.type === 'location') {
      // tag messages coming from server
      const tagged = { ...msg, via: 'server' as const };
      addMessage(tagged);
      // For location messages, also update users map so markers and lists show coords
      if (msg.type === 'location') {
        setUsers(prev => {
          const next = new Map(prev);
          const existing = next.get(msg.sender);
          if (existing) {
            next.set(msg.sender, { ...existing, location: msg.location, lastSeen: Date.now() });
          }
          return next;
        });
      }
    }
  }, [addMessage, username]);

  // Listen for peer-to-peer messages from PeerJS fallback
  useEffect(() => {
    const onPeer = (ev: any) => {
      const d = ev.detail || {};
      const data = d.data || d;
      console.debug('usePeerNetwork incoming peer', data, 'from', d.from);
      // If the peer message is already a PeerMessage, ingest it; otherwise wrap
      const base: PeerMessage = data && data.type ? data : {
        id: crypto.randomUUID(),
        type: data.type || 'chat',
        sender: data.sender || 'peer',
        content: data.content || JSON.stringify(data),
        timestamp: Date.now(),
      };
      const msg: PeerMessage = { ...base, via: 'peer' };

      // Handle ACKs specially: if this is an ack for a message we sent, clear its retry
      if (msg.type === 'ack') {
        try {
          const entry = pendingAcksRef.current.get(msg.id);
          if (entry) {
            if (entry.timeout) clearTimeout(entry.timeout);
            pendingAcksRef.current.delete(msg.id);
            console.log('[usePeerNetwork] received ack for', msg.id);
          }
        } catch (e) { console.warn('ack handle failed', e); }
        return; // don't add ack to messages
      }

      // For normal messages, add to history then send an ACK back to the sender
      addMessage(msg);
      try {
        const ack = { id: msg.id, type: 'ack', sender: username, content: '', timestamp: Date.now() } as PeerMessage;
        peerService.sendToAll(ack);
        console.log('[usePeerNetwork] sent ack for', msg.id);
      } catch (e) { console.warn('[usePeerNetwork] failed to send ack', e); }
    };
    window.addEventListener('stillalive:peer-message', onPeer as any);
    return () => window.removeEventListener('stillalive:peer-message', onPeer as any);
  }, [addMessage]);

  useEffect(() => {
    if (!roomId) {
      // not assigned yet by server — don't subscribe to presence/channel
      setConnected(false);
      return;
    }
    const peerId = `sa-${roomId}-${username}-${Math.random().toString(36).slice(2, 6)}`;
    setMyPeerId(peerId);
    // load cached messages for this room once assigned
    try { setMessages(loadCachedMessagesFor(roomId)); } catch {}

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
        const now = Date.now();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.username !== username) {
              // if this user was recently removed by socket event, skip them for a short window
              const removedAt = removedUsersRef.current.get(p.username);
              if (removedAt && (now - removedAt) < 30_000) return;
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

    // create a BroadcastChannel for same-origin tabs so offline messages still flow
    try {
      if ('BroadcastChannel' in window) {
        try {
          bcRef.current = new BroadcastChannel(`stillalive_room_${roomId}`);
          bcRef.current.onmessage = (ev: MessageEvent) => {
            try {
              const data = ev.data as PeerMessage;
              // tag as local-broadcast
              addMessage({ ...data, via: 'peer' });
            } catch (e) { console.warn('bc onmessage failed', e); }
          };
        } catch (e) { console.warn('failed to create BroadcastChannel', e); }
      }
    } catch (e) { /* ignore */ }

    // Listen for server-sent events from socket layer via window CustomEvents
    const onUserLeft = (ev: any) => {
      const data = ev.detail || {};
      const name = data.username || data.username;
      if (!name) return;

      // remember removal so presence sync doesn't immediately bring them back
      try { removedUsersRef.current.set(name, Date.now()); } catch {}

      // remove from users map
      setUsers(prev => {
        const next = new Map(prev);
        next.forEach((v, k) => {
          if (v.username === name) next.delete(k);
        });
        return next;
      });

      // add system message
      const sys: PeerMessage = {
        id: crypto.randomUUID(),
        type: 'system',
        sender: name,
        content: `⚪ ${name} left the network`,
        timestamp: Date.now(),
        active: false,
      };
      addMessage(sys);
    };

    const onSystemMessage = (ev: any) => {
      const data = ev.detail || {};
      const text = data.text || '';
      const name = data.username || 'system';
      const sys: PeerMessage = {
        id: crypto.randomUUID(),
        type: 'system',
        sender: name,
        content: text,
        timestamp: Date.now(),
      };
      addMessage(sys);
    };

    const onSosUpdate = (ev: any) => {
      const d = ev.detail || {};
      const uname = d.username || d.sender || 'unknown';
      const userId = d.userId || d.id || '';
      const priority = (d.priority || 'low').toString();

      // Mark the user as critical in the users map when SOS is active
      if (d.active) {
        setUsers(prev => {
          const next = new Map(prev);
          for (const [k, v] of next.entries()) {
            if (v.username === uname) {
              next.set(k, { ...v, status: 'critical', lastSeen: Date.now() });
              break;
            }
          }
          return next;
        });
      }

      // Build a normalized sos message and add/merge via addMessage
      const sosMsg: PeerMessage = {
        id: crypto.randomUUID(),
        type: 'sos',
        sender: uname,
        userId,
        content: `🚨 SOS from ${uname}`,
        timestamp: Date.now(),
        priority: (priority as any),
        location: d.lat && d.lng ? { lat: d.lat, lng: d.lng } : undefined,
        active: d.active !== undefined ? d.active : true,
      };
      addMessage(sosMsg);
    };

    const onSosCleared = (ev: any) => {
      const d = ev.detail || {};
      const userId = d.userId;
      const uname = d.username;
      setMessages(prev => {
        const next = prev.map(m => {
          if (m.type !== 'sos') return m;
          const mid = m.userId || '';
          const mname = (m.sender || '').toString();
          const match = (
            (userId && mid && userId === mid) ||
            (uname && mname && uname === mname) ||
            (userId && mname && userId === mname) ||
            (uname && mid && uname === mid)
          );
          if (match) return { ...m, active: false };
          return m;
        });
        cacheMessagesFor(roomId, next);
        return next;
      });

      // mark user safe in users map if present
      if (uname) {
        setUsers(prev => {
          const next = new Map(prev);
          next.forEach((v, k) => {
            if (v.username === uname) next.set(k, { ...v, status: 'safe', lastSeen: Date.now() });
          });
          return next;
        });
      }
    };

    const onUserJoined = (ev: any) => {
      const d = ev.detail || {};
      const name = d.username;
      if (!name) return;
      // clear any recent-removed marker if someone rejoins
      try { removedUsersRef.current.delete(name); } catch {}
      setUsers(prev => {
        const next = new Map(prev);
        next.set(name, { peerId: d.id || name, username: name, status: 'safe', location: undefined, lastSeen: Date.now() });
        return next;
      });
      const sys: PeerMessage = {
        id: crypto.randomUUID(),
        type: 'system',
        sender: name,
        content: `🟢 ${name} joined the network`,
        timestamp: Date.now(),
      };
      addMessage(sys);
    };

    window.addEventListener('stillalive:user-left', onUserLeft as any);
    window.addEventListener('stillalive:user-joined', onUserJoined as any);
    window.addEventListener('stillalive:system-message', onSystemMessage as any);
    window.addEventListener('stillalive:sos-update', onSosUpdate as any);
    window.addEventListener('stillalive:sos-cleared', onSosCleared as any);

    const onRoomAssigned = (ev: any) => {
      const d = ev.detail || {};
      // Clear local state when server assigns a (new) room so we don't inherit stale data
      setMessages([]);
      setUsers(new Map());
    };
    window.addEventListener('stillalive:room-assigned', onRoomAssigned as any);

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
      // remove listeners
      try {
        window.removeEventListener('stillalive:user-left', onUserLeft as any);
        window.removeEventListener('stillalive:user-joined', onUserJoined as any);
        window.removeEventListener('stillalive:system-message', onSystemMessage as any);
        window.removeEventListener('stillalive:sos-update', onSosUpdate as any);
        window.removeEventListener('stillalive:sos-cleared', onSosCleared as any);
        window.removeEventListener('stillalive:room-assigned', onRoomAssigned as any);
      } catch {}

      // clear any pending ack timers
      try {
        pendingAcksRef.current.forEach(v => { if (v.timeout) clearTimeout(v.timeout); });
        pendingAcksRef.current.clear();
      } catch {}

      try { if (bcRef.current) { try { bcRef.current.close(); } catch {} bcRef.current = null; } } catch {}

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
    // If we have active peer connections, prefer PeerJS so offline mode works
    const usePeer = peerService.getConnectionCount() > 0;
    addMessage({ ...msg, via: usePeer ? 'peer' : (navigator.onLine ? 'server' : 'peer') });
    if (usePeer) {
      try { console.log('[usePeerNetwork] peer sendMessage sendToAll', msg.id, msg.type); sendPeerWithRetry(msg); } catch (e) { console.warn('[usePeerNetwork] peer send failed', e); }
    } else if (navigator.onLine) {
      broadcast(msg);
    } else {
      // no peer connections and offline -> queue for peers when available and also post to same-origin tabs
      try { console.log('[usePeerNetwork] offline queued sendMessage', msg.id); peerService.sendToAll(msg); } catch (e) { console.warn('[usePeerNetwork] offline queue failed', e); }
      try { if (bcRef.current) bcRef.current.postMessage(msg); } catch (e) { /* ignore */ }
    }
  }, [username, addMessage, broadcast, sendPeerWithRetry]);

  const sendSOS = useCallback((location?: { lat: number; lng: number }) => {
    const msg: PeerMessage = {
      id: crypto.randomUUID(),
      type: 'sos',
      sender: username,
      userId: myPeerId,
      content: `🚨 SOS ALERT from ${username}! Immediate assistance needed!`,
      timestamp: Date.now(),
      priority: 'HIGH',
      location,
      active: true,
    };
    const usePeer = peerService.getConnectionCount() > 0;
    addMessage({ ...msg, via: usePeer ? 'peer' : (navigator.onLine ? 'server' : 'peer') });
    if (usePeer) {
      try { console.log('[usePeerNetwork] peer sendSOS sendToAll', msg.id, msg.type); sendPeerWithRetry(msg); } catch (e) { console.warn('[usePeerNetwork] peer sendSOS failed', e); }
    } else if (navigator.onLine) {
      broadcast(msg);
    } else {
      try { console.log('[usePeerNetwork] offline queued sendSOS', msg.id); peerService.sendToAll(msg); } catch (e) { console.warn('[usePeerNetwork] peer sendSOS queue failed', e); }
      try { if (bcRef.current) bcRef.current.postMessage(msg); } catch (e) { /* ignore */ }
    }
    // also notify room server via socket for real-time presence (best-effort)
    try {
      (window as any).stillaliveSocket?.emit('sos-update', { userId: myPeerId, username, lat: location?.lat, lng: location?.lng, priority: 'high', active: true });
    } catch (err) { console.error('sos-update socket emit failed', err); }

    // update presence status to critical so presence lists reflect SOS
    try {
      channelRef.current?.track({ username, peerId: myPeerId, status: 'critical', location: location || undefined, online_at: new Date().toISOString() });
    } catch {}
  }, [username, addMessage, broadcast, sendPeerWithRetry]);

  const shareLocation = useCallback((location: { lat: number; lng: number }) => {
    const msg: PeerMessage = {
      id: crypto.randomUUID(),
      type: 'location',
      sender: username,
      content: '',
      timestamp: Date.now(),
      location,
    };
    // add a visible location message locally and broadcast
    const usePeer = peerService.getConnectionCount() > 0;
    addMessage({ ...msg, via: usePeer ? 'peer' : (navigator.onLine ? 'server' : 'peer') });
    if (usePeer) {
      try { console.log('[usePeerNetwork] peer shareLocation sendToAll', msg.id, msg.type); sendPeerWithRetry(msg); } catch (e) { console.warn('[usePeerNetwork] peer shareLocation failed', e); }
    } else if (navigator.onLine) {
      broadcast(msg);
    } else {
      try { console.log('[usePeerNetwork] offline queued shareLocation', msg.id); peerService.sendToAll(msg); } catch (e) { console.warn('[usePeerNetwork] peer shareLocation queue failed', e); }
      try { if (bcRef.current) bcRef.current.postMessage(msg); } catch (e) { /* ignore */ }
    }
    // Update presence with location
    channelRef.current?.track({
      username,
      peerId: myPeerId,
      status: 'safe',
      location,
      online_at: new Date().toISOString(),
    });
  }, [username, myPeerId, broadcast, sendPeerWithRetry]);

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
    // also propagate status over peers when available so offline clients learn about status
    try {
      if (peerService.getConnectionCount() > 0) {
        try { sendPeerWithRetry(msg); } catch (e) { console.warn('peer status send failed', e); }
      }
    } catch (e) { /* ignore */ }
    // If user is SAFE, clear their SOSes
    if (status === 'safe') {
      try {
        (window as any).stillaliveSocket?.emit('sos-cleared', { userId: myPeerId, username });
      } catch (err) {
        // Log emit failures for diagnosis
        // eslint-disable-next-line no-console
        console.error('sos-cleared emit failed', err);
      }
      // Also mark locally (match by userId or sender to clear duplicates)
      setMessages(prev => {
        try {
          const next = prev.map(m => {
            if (m.type !== 'sos') return m;
            const mid = m.userId || '';
            const mname = (m.sender || '').toString();
            const match = (
              (myPeerId && mid && myPeerId === mid) ||
              (username && mname && username === mname) ||
              (myPeerId && mname && myPeerId === mname) ||
              (username && mid && username === mid)
            );
            if (match) return { ...m, active: false };
            return m;
          });
          cacheMessagesFor(roomId, next);
          return next;
        } catch (err) {
          // If marking messages fails, keep previous state and log error
          // eslint-disable-next-line no-console
          console.error('marking messages safe failed', err);
          return prev;
        }
      });
    } else if (status === 'need-help') {
      try {
        (window as any).stillaliveSocket?.emit('sos-update', { userId: myPeerId, username, priority: 'medium', active: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('sos-update emit (need-help) failed', err);
      }
    } else if (status === 'critical') {
      try {
        (window as any).stillaliveSocket?.emit('sos-update', { userId: myPeerId, username, priority: 'high', active: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('sos-update emit (critical) failed', err);
      }
    }
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
