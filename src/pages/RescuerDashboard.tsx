import { useEffect, useMemo, useRef, useState } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import peerService from '@/services/peerService';

type Zone = {
  roomId: string;
  lat: number;
  lng: number;
  userCount: number;
  lastActivity: number;
  sosCount: { critical: number; medium: number; low: number };
};

export default function RescuerDashboard() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [sortBy, setSortBy] = useState<'critical'|'users'|'recent'>('critical');
  const navigate = useNavigate();
  const { join } = useSession();
  const geo = useGeolocation();
  const [firstLoad, setFirstLoad] = useState(true);
  const [sosList, setSosList] = useState<any[]>([]);
  const [selectedSOS, setSelectedSOS] = useState<any | null>(null);
  const [meshStatus, setMeshStatus] = useState({ active: false, users: 0, critical: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = (import.meta.env.VITE_ROOM_SERVER || 'http://localhost:3001') + '/zones';
        const qs = (geo.latitude && geo.longitude) ? `?lat=${geo.latitude}&lng=${geo.longitude}&radius=20` : '';
        const res = await fetch(base + qs);
        const data = await res.json();
        if (!cancelled) setZones(data || []);
        // load SOS details for each zone and flatten
        try {
          const details = await Promise.all((data || []).map(async (z: any) => {
            try {
              const r = await fetch((import.meta.env.VITE_ROOM_SERVER || 'http://localhost:3001') + `/zone?roomId=${encodeURIComponent(z.roomId)}`);
              if (!r.ok) return { zone: z, sos: [] };
              const json = await r.json();
              return { zone: z, sos: json.sos || [] };
            } catch (e) { return { zone: z, sos: [] }; }
          }));
          const flat: any[] = [];
          details.forEach((d: any) => {
            (d.sos || []).forEach((s: any) => {
              if (!s) return;
              flat.push({ ...s, roomId: d.zone.roomId, lat: s.lat || d.zone.lat, lng: s.lng || d.zone.lng, zone: d.zone });
            });
          });
          if (!cancelled) setSosList(flat);
        } catch (e) { console.warn('failed to load zone details', e); }
      } catch (e) { console.warn('failed to load zones', e); }
    }
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // update mesh/network panel periodically
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const users = zones.reduce((acc, z) => acc + (z.userCount || 0), 0);
        const critical = zones.reduce((acc, z) => acc + ((z.sosCount && z.sosCount.critical) || 0), 0);
        setMeshStatus({ active: peerService.getConnectionCount() > 0, users, critical });
      } catch (e) { /* ignore */ }
    }, 2000);
    return () => clearInterval(id);
  }, [zones]);

  // listen for sos update / assignment events from socket layer
  useEffect(() => {
    const onSosUpdate = (ev: any) => {
      const d = ev.detail || {};
      setSosList(prev => {
        const existing = prev.find(p => p.userId === d.userId || p.username === d.username);
        if (existing) {
          return prev.map(p => (p.userId === d.userId || p.username === d.username) ? { ...p, ...d, active: d.active !== undefined ? d.active : true } : p);
        }
        return [...prev, { ...d, lat: d.lat, lng: d.lng }];
      });
    };
    const onAssigned = (ev: any) => {
      const d = ev.detail || {};
      setSosList(prev => prev.map(p => (p.userId === d.userId || p.username === d.userId) ? { ...p, assigned: d.responder, status: 'responding' } : p));
    };
    const onResolved = (ev: any) => {
      const d = ev.detail || {};
      setSosList(prev => prev.map(p => (p.userId === d.userId || p.username === d.userId) ? { ...p, active: false, resolvedBy: d.resolver } : p));
    };
    window.addEventListener('stillalive:sos-update', onSosUpdate as any);
    window.addEventListener('stillalive:sos-assigned', onAssigned as any);
    window.addEventListener('stillalive:sos-resolved', onResolved as any);
    return () => {
      window.removeEventListener('stillalive:sos-update', onSosUpdate as any);
      window.removeEventListener('stillalive:sos-assigned', onAssigned as any);
      window.removeEventListener('stillalive:sos-resolved', onResolved as any);
    };
  }, []);

  const sorted = useMemo(() => {
    const copy = [...zones];
    if (sortBy === 'critical') {
      copy.sort((a,b) => (b.sosCount.critical - a.sosCount.critical) || (b.userCount - a.userCount));
    } else if (sortBy === 'users') {
      copy.sort((a,b) => b.userCount - a.userCount);
    } else {
      copy.sort((a,b) => (b.lastActivity || 0) - (a.lastActivity || 0));
    }
    return copy;
  }, [zones, sortBy]);

  const onJoin = (z: Zone) => {
    // join as rescuer into that zone and navigate to main dashboard view
    try {
      join('Rescuer', z.roomId);
    } catch (e) {}
    navigate('/dashboard');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Rescuer — Zone Overview</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={sortBy==='critical' ? 'default' : 'outline'} onClick={() => setSortBy('critical')}>Highest Critical SOS</Button>
          <Button size="sm" variant={sortBy==='users' ? 'default' : 'outline'} onClick={() => setSortBy('users')}>Most Users</Button>
          <Button size="sm" variant={sortBy==='recent' ? 'default' : 'outline'} onClick={() => setSortBy('recent')}>Most Recent</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Network Awareness Panel */}
          <div className="p-4 rounded-lg bg-card border border-border mb-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Network Awareness</div>
              <div className="text-sm text-muted-foreground">Mesh: {meshStatus.active ? 'Active' : 'Offline'} · Users: {meshStatus.users} · Critical: {meshStatus.critical}</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Refreshes every 5s</div>
            </div>
          </div>

          {/* Rescue queue (SOS list) */}
          <div className="p-4 rounded-lg bg-card border border-border mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Priority Rescue Queue</div>
              <div className="text-sm text-muted-foreground">Sorted by: Priority → Distance → Recent</div>
            </div>
            <div className="space-y-3">
              {sosList && sosList.length ? (
                // compute sorted list
                (() => {
                  const list = [...sosList];
                  function priorityVal(s: any) {
                    const p = (s.priority || '').toString().toLowerCase();
                    if (p === 'high' || p === 'critical') return 3;
                    if (p === 'medium' || p === 'need-help' || p === 'med') return 2;
                    return 1;
                  }
                  function distance(s: any) {
                    if (!geo.latitude || !geo.longitude || !s.lat || !s.lng) return Number.POSITIVE_INFINITY;
                    const R = 6371;
                    const dLat = (s.lat - geo.latitude) * Math.PI/180;
                    const dLng = (s.lng - geo.longitude) * Math.PI/180;
                    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(geo.latitude * Math.PI/180) * Math.cos(s.lat * Math.PI/180) * Math.sin(dLng/2)*Math.sin(dLng/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return R * c;
                  }
                  list.sort((a,b) => {
                    const pa = priorityVal(a), pb = priorityVal(b);
                    if (pa !== pb) return pb - pa;
                    const da = distance(a), db = distance(b);
                    if (da !== db) return da - db;
                    return (b.timestamp || b.ts || 0) - (a.timestamp || a.ts || 0);
                  });
                  const getDistance = (s: any) => {
  if (!geo.latitude || !geo.longitude || !s.lat || !s.lng) return null;

  const R = 6371;
  const dLat = (s.lat - geo.latitude) * Math.PI / 180;
  const dLng = (s.lng - geo.longitude) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(geo.latitude * Math.PI / 180) *
    Math.cos(s.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};
                  return list.map(s => (
                    <div key={`${s.roomId}-${s.userId || s.username}`} className={`p-3 rounded bg-secondary border border-border flex items-center justify-between`}> 
                      <div>
                        <div className="font-semibold">{s.username || s.userId || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">Priority: {(s.priority||'low').toString()} · Zone: {s.roomId}</div>
                        <div className="text-xs text-muted-foreground">{s.lat && s.lng ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}` : ''} {(() => {
  const dist = getDistance(s);
  return dist !== null ? ` · ${dist} km` : '';
})()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedSOS(s); /* focus on map */ }}>
                          📍 Navigate
                        </Button>
                        <Button size="sm" onClick={() => { try { (window as any).stillaliveSocket?.emit('assign-responder', { roomId: s.roomId, userId: s.userId || s.username, responder: 'Rescuer' }); } catch {} }}>
                          ✅ I'm going
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { try { (window as any).stillaliveSocket?.emit('resolve-sos', { roomId: s.roomId, userId: s.userId || s.username, resolver: 'Rescuer' }); } catch {} }}>
                          🛑 Resolve
                        </Button>
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <div className="text-sm text-muted-foreground">No active SOS nearby</div>
              )}
            </div>
          </div>

          {/* Zones list below */}
          {sorted.map(z => (
            <div key={z.roomId} className="p-4 rounded-lg bg-card border border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${z.sosCount.critical>0 ? 'bg-red-600 shadow-md' : 'bg-primary/10'}`}>
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">{z.roomId}</div>
                    <div className="text-xs text-muted-foreground">{z.lat?.toFixed?.(4) || '0.0000'}, {z.lng?.toFixed?.(4) || '0.0000'}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground text-center">
                  <div className="font-bold">{z.userCount}</div>
                  <div>Users</div>
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  <div className="font-bold">{z.sosCount.critical}</div>
                  <div>Critical</div>
                </div>
                <div>
                  <Button size="sm" onClick={() => onJoin(z)}>Join Zone</Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="col-span-1">
          <div className="p-4 rounded-lg bg-card border border-border">
            <h3 className="font-semibold mb-2">Zones Map</h3>
            <div style={{ height: 420 }} id="rescuer-map" className="w-full" />
            {/* Render a simple leaflet map for visualization */}
            <MapRenderer zones={zones} focusGeo={geo} highlightedSOS={selectedSOS} firstLoad={firstLoad} onFirstLoad={() => setFirstLoad(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MapRenderer({ zones, focusGeo, firstLoad, onFirstLoad, highlightedSOS }: { zones: Zone[], focusGeo?: ReturnType<typeof useGeolocation>, firstLoad?: boolean, onFirstLoad?: () => void, highlightedSOS?: any }) {
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any | null>(null);
  const highlightLayerRef = useRef<any | null>(null);

  // initialize map once
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const L = await import('leaflet');
        const el = document.getElementById('rescuer-map');
        if (!el) return;
        if (mapRef.current) return;
        const center = zones.length ? [zones[0].lat || 0, zones[0].lng || 0] : [0,0];
        const map = L.map(el, { preferCanvas: true }).setView(center, zones.length ? 12 : 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
        mapRef.current = map;
        markersRef.current = L.layerGroup().addTo(map);
      } catch (e) { console.warn('init rescuer map failed', e); }
    }
    init();
    return () => { cancelled = true; try { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } } catch {} };
  }, []);

  // update markers without resetting map view
  useEffect(() => {
    (async () => {
      try {
        const L = await import('leaflet');
        if (!mapRef.current || !markersRef.current) return;
        // clear existing markers
        markersRef.current.clearLayers();
        zones.forEach(z => {
          if (typeof z.lat === 'number' && typeof z.lng === 'number') {
            const color = z.sosCount.critical > 0 ? '#e63946' : '#1a8cff';
            const circle = L.circle([z.lat, z.lng], {
              radius: Math.max(50, (z.userCount || 1) * 30),
              color,
              fillColor: color,
              fillOpacity: 0.18,
              weight: z.sosCount.critical > 0 ? 2 : 1,
            });
            circle.bindPopup(`${z.roomId}<br/>Users: ${z.userCount}<br/>Critical SOS: ${z.sosCount.critical}`);
            markersRef.current.addLayer(circle);
          }
        });
        // On first load, fit map to zones bounds or focusGeo if provided
        try {
          if (firstLoad && (zones.length > 0 || (focusGeo && focusGeo.latitude && focusGeo.longitude))) {
            const pts: any[] = [];
            zones.forEach(z => { if (typeof z.lat === 'number' && typeof z.lng === 'number') pts.push([z.lat, z.lng]); });
            if (pts.length) {
              const bounds = (L as any).latLngBounds(pts);
              mapRef.current.fitBounds(bounds.pad ? bounds.pad(0.25) : bounds);
            } else if (focusGeo && focusGeo.latitude && focusGeo.longitude) {
              mapRef.current.setView([focusGeo.latitude, focusGeo.longitude], 12);
            }
            onFirstLoad && onFirstLoad();
          }
        } catch (e) { /* ignore fit errors */ }
      } catch (e) { console.warn('update rescuer map failed', e); }
    })();
  }, [zones]);

  // handle highlighted SOS: draw marker + route line and zoom
  useEffect(() => {
    (async () => {
      try {
        const L = await import('leaflet');
        if (!mapRef.current) return;
        // clear previous highlight layer
        try { if (highlightLayerRef.current) { highlightLayerRef.current.remove(); highlightLayerRef.current = null; } } catch {}
        if (!highlightedSOS) return;
        const layer = L.layerGroup();
        const lat = highlightedSOS.lat; const lng = highlightedSOS.lng;
        const victimMarker = L.circleMarker([lat, lng], { radius: 8, color: '#e63946', fillColor: '#e63946', fillOpacity: 1 }).addTo(layer);
        victimMarker.bindPopup(`<b>${highlightedSOS.username || highlightedSOS.userId}</b><br/>Priority: ${highlightedSOS.priority || 'low'}`);
        // draw route line from rescuer (focusGeo) to victim if available
        if (focusGeo && focusGeo.latitude && focusGeo.longitude) {
          const poly = L.polyline([[focusGeo.latitude, focusGeo.longitude], [lat, lng]], { color: '#00b4d8', weight: 2, dashArray: '5,6' }).addTo(layer);
          // optional: show distance
          const dist = (function(){ const R=6371; const dLat=(lat-focusGeo.latitude)*Math.PI/180; const dLng=(lng-focusGeo.longitude)*Math.PI/180; const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(focusGeo.latitude*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2); const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return R*c; })();
          const mid = [(focusGeo.latitude+lat)/2, (focusGeo.longitude+lng)/2];
          L.marker(mid, { interactive: false, opacity: 0.9 }).bindTooltip(`${dist.toFixed(2)} km`).addTo(layer);
        }
        layer.addTo(mapRef.current);
        highlightLayerRef.current = layer;
        // center/zoom a bit to victim
        try { mapRef.current.setView([lat, lng], 14); } catch (e) {}
      } catch (e) { console.warn('highlight sos failed', e); }
    })();
  }, [highlightedSOS]);

  return null;
}
