import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from './useSession';
import peerService from '@/services/peerService';

export default function useRoomServer() {
  const { isJoined, username, roomId, join } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const pendingPeersRef = useRef<string[]>([]);
  const peerOnDataOffRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isJoined) return;
    const server = import.meta.env.VITE_ROOM_SERVER || 'http://localhost:3001';

    // Avoid reconnecting if already connected
    if (socketRef.current) return;

    const socket = io(server, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    const coordsRaw = sessionStorage.getItem('stillalive_coords');
    const coords = coordsRaw ? JSON.parse(coordsRaw) : null;

    socket.on('connect', () => {
      // If we already have a target roomId (e.g., rescuer joining a specific zone), request that room explicitly
      try {
        if (roomId) {
          socket.emit('join-zone', { roomId, username });
        } else {
          // Emit join-network with last known coords and username
          socket.emit('join-network', { lat: coords?.lat, lng: coords?.lng, username });
        }
      } catch (e) { socket.emit('join-network', { lat: coords?.lat, lng: coords?.lng, username }); }
      // initialize PeerJS and share peer id with server for discovery
      try {
        const peer = peerService.init();
        const pid = (peer as any).id;
        // share id when ready
        if (pid) socket.emit('share-peer-id', pid);
        // when peer opens later, share id as well
        (peer as any).on('open', (id: string) => {
          socket.emit('share-peer-id', id);
          // flush any pending peer connect attempts we received before our peer id was known
          try {
            const myId = peerService.getId();
            pendingPeersRef.current.forEach((remoteId) => {
              if (!myId || !remoteId || myId === remoteId) return;
              // only the peer with smaller id should initiate connect to avoid double connections
              if (myId < remoteId) {
                try { peerService.connectTo(remoteId); } catch (e) { console.warn('connectTo failed', e); }
              }
            });
          } catch (e) { console.warn('flush pending peers failed', e); }
          pendingPeersRef.current = [];
        });
        // when data arrives from peers, dispatch a custom event for the app
        try {
          // unsubscribe previous if any (defensive)
          peerOnDataOffRef.current && peerOnDataOffRef.current();
        } catch {}
        peerOnDataOffRef.current = peerService.onData((data: any, from?: string) => {
          try { window.dispatchEvent(new CustomEvent('stillalive:peer-message', { detail: { data, from } })); } catch {}
        });
      } catch (e) { console.warn('peer init failed', e); }
      // expose socket to window for other modules
      try { (window as any).stillaliveSocket = socket; } catch {}
      // ensure we disconnect socket on page unload to avoid reconnect storms
      try {
        const onUnload = () => { try { socket.disconnect(); } catch {} };
        window.addEventListener('beforeunload', onUnload);
        // remove on cleanup
        (socket as any)._onUnload = onUnload;
      } catch {}
    });

    socket.on('room-assigned', (rId: string) => {
      // Update client session to the authoritative room assigned by server
      try {
        if (username && typeof join === 'function') {
          join(username, rId);
        }
        window.dispatchEvent(new CustomEvent('stillalive:room-assigned', { detail: { roomId: rId } }));
      } catch {}
    });

    socket.on('user-joined', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:user-joined', { detail: data })); } catch {}
    });

    socket.on('user-left', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:user-left', { detail: data })); } catch {}
    });

    socket.on('system-message', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:system-message', { detail: data })); } catch {}
    });

    socket.on('sos-update', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:sos-update', { detail: data })); } catch {}
    });

    socket.on('sos-assigned', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:sos-assigned', { detail: data })); } catch {}
    });

    socket.on('sos-resolved', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:sos-resolved', { detail: data })); } catch {}
    });

    socket.on('sos-cleared', (data: any) => {
      try { window.dispatchEvent(new CustomEvent('stillalive:sos-cleared', { detail: data })); } catch {}
    });

    // peer discovery from other clients in room
    socket.on('peer-available', (data: any) => {
      try {
        const pid = data.peerId;
        if (pid) {
          const myId = peerService.getId();
          // if we don't yet have our peer id, queue it for later
          if (!myId) {
            pendingPeersRef.current.push(pid);
            return;
          }
          // avoid connecting to self
          if (myId === pid) return;
          // deterministic rule: only the peer with smaller id initiates the connection
          if (myId < pid) {
            try { peerService.connectTo(pid); } catch (e) { console.warn('connectTo failed', e); }
          }
        }
      } catch {}
    });

    return () => {
      try { peerOnDataOffRef.current && peerOnDataOffRef.current(); } catch {}
      try { if ((socket as any)._onUnload) window.removeEventListener('beforeunload', (socket as any)._onUnload); } catch {}
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isJoined, username]);

  // If roomId changes while socket is connected, request explicit join to that zone
  useEffect(() => {
    try {
      const sock = socketRef.current;
      if (sock && roomId) {
        try { sock.emit('join-zone', { roomId, username }); } catch (e) { console.warn('emit join-zone failed', e); }
      }
    } catch (e) { /* ignore */ }
  }, [roomId, username]);
}
