import { Peer } from 'peerjs';

type DataHandler = (data: any, peerId?: string) => void;

class PeerService {
  peer: Peer | null = null;
  // connections: peerId -> { conn, ready, queue }
  connections: Record<string, { conn: any; ready: boolean; queue: any[] }> = {};
  // global queue for sends when there are no connections at all
  pendingGlobalQueue: any[] = [];
  PERSIST_KEY = 'stillalive_peer_pending';
  handlers: DataHandler[] = [];

  init(opts?: { key?: string } ) {
    if (this.peer) return this.peer;
    this.peer = new Peer();

    // load persisted global queue from localStorage
    try {
      const raw = localStorage.getItem(this.PERSIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.pendingGlobalQueue = parsed;
      }
    } catch (e) { console.warn('[peer] failed to load persisted queue', e); }

        this.peer.on('open', (id: string) => {
          console.log('[peer] open', id);
        });

    this.peer.on('connection', (conn: any) => {
      console.debug('[peer] incoming connection', conn.peer);
      this._registerConn(conn);
    });

    this.peer.on('error', (err: any) => console.warn('[peer] error', err));

    return this.peer;
  }

  _registerConn(conn: any) {
    const peerId = conn.peer;
    this.connections[peerId] = { conn, ready: false, queue: [] };
        conn.on('open', () => {
          console.log('[peer] connection open', peerId);
      const entry = this.connections[peerId];
      if (entry) {
        entry.ready = true;
        // flush queue
            // flush queue
            while (entry.queue.length) {
              const data = entry.queue.shift();
              try { entry.conn.send(data); console.log('[peer] flushed queued to', peerId, data && data.type ? data.type : typeof data); } catch (e) { console.warn('[peer] send queued failed', e); }
        }
            // flush any global pending messages now that at least one connection is ready
            try { this._flushGlobalQueue(); } catch (e) { console.warn('[peer] flushGlobalQueue failed', e); }
      }
    });
    conn.on('data', (data: any) => {
      this.handlers.forEach(h => h(data, peerId));
    });
    conn.on('close', () => { delete this.connections[peerId]; console.debug('[peer] connection closed', peerId); });
    conn.on('error', (e: any) => console.warn('[peer] conn error', peerId, e));
  }

  connectTo(peerId: string) {
    if (!this.peer) this.init();
    if (this.connections[peerId]) return this.connections[peerId].conn;
    try {
      const conn = (this.peer as any).connect(peerId);
      // create placeholder entry so sendToAll can queue
      this.connections[peerId] = { conn, ready: false, queue: [] };
      conn.on('open', () => {
          console.log('[peer] outbound connection open', peerId);
        const entry = this.connections[peerId];
        if (entry) {
          entry.ready = true;
          // flush any queued messages
            // flush any queued messages
            while (entry.queue.length) {
              const data = entry.queue.shift();
              try { entry.conn.send(data); console.log('[peer] flushed queued outbound to', peerId, data && data.type ? data.type : typeof data); } catch (e) { console.warn('[peer] send queued failed', e); }
          }
          // flush global pending queue as well
          try { this._flushGlobalQueue(); } catch (e) { console.warn('[peer] flushGlobalQueue failed', e); }
        }
      });
      conn.on('data', (data: any) => this.handlers.forEach(h => h(data, peerId)));
      conn.on('error', (e: any) => console.warn('[peer] connectTo error', peerId, e));
      conn.on('close', () => { delete this.connections[peerId]; console.debug('[peer] outbound closed', peerId); });
      return conn;
    } catch (err) {
      console.warn('[peer] connect failed', err);
      return null;
    }
  }

  sendToAll(data: any) {
    const entries = Object.entries(this.connections);
    if (entries.length === 0) {
      // no connections at all - store globally until someone connects
      this.pendingGlobalQueue.push(data);
      try { localStorage.setItem(this.PERSIST_KEY, JSON.stringify(this.pendingGlobalQueue)); } catch (e) { console.warn('[peer] persist queue failed', e); }
      console.log('[peer] no connections - queued globally', data && data.id ? data.id : 'n/a');
      return;
    }

    entries.forEach(([peerId, entry]) => {
      try {
        if (entry && entry.conn) {
          if (entry.ready) {
            try { entry.conn.send(data); console.log('[peer] sent to', peerId, data && data.type ? data.type : typeof data, 'id=', data && data.id ? data.id : 'n/a'); } catch(e) { console.warn('[peer] send failed', peerId, e); }
          } else {
            // queue until open
            entry.queue.push(data);
            console.log('[peer] queued for', peerId, data && data.type ? data.type : typeof data, 'id=', data && data.id ? data.id : 'n/a');
          }
        } else {
          console.log('[peer] no connection entry for', peerId, 'dropping/ignoring send');
        }
      } catch (e) { console.warn('[peer] send failed to', peerId, e); }
    });
  }

  _flushGlobalQueue() {
    if (!this.pendingGlobalQueue.length) return;
    console.log('[peer] flushing global queue, count=', this.pendingGlobalQueue.length);
    const toFlush = this.pendingGlobalQueue.splice(0, this.pendingGlobalQueue.length);
    // persist clear first to avoid re-flush on crash
    try { localStorage.removeItem(this.PERSIST_KEY); } catch (e) { console.warn('[peer] clear persist failed', e); }
    toFlush.forEach((msg) => {
      try { this.sendToAll(msg); } catch (e) { console.warn('[peer] flush global send failed', e); }
    });
  }

  onData(fn: DataHandler) {
    this.handlers.push(fn);
    return () => { this.handlers = this.handlers.filter(h => h !== fn); };
  }

  getId() { return this.peer ? (this.peer as any).id : null; }

  getConnectionCount() { return Object.keys(this.connections).length; }
}

const peerService = new PeerService();
export default peerService;
