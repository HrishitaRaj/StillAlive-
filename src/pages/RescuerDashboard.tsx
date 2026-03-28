import { useEffect, useMemo, useRef, useState } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = (import.meta.env.VITE_ROOM_SERVER || 'http://localhost:3001') + '/zones';
        const qs = (geo.latitude && geo.longitude) ? `?lat=${geo.latitude}&lng=${geo.longitude}&radius=20` : '';
        const res = await fetch(base + qs);
        const data = await res.json();
        if (!cancelled) setZones(data || []);
      } catch (e) { console.warn('failed to load zones', e); }
    }
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
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
            <MapRenderer zones={zones} focusGeo={geo} firstLoad={firstLoad} onFirstLoad={() => setFirstLoad(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MapRenderer({ zones, focusGeo, firstLoad, onFirstLoad }: { zones: Zone[], focusGeo?: ReturnType<typeof useGeolocation>, firstLoad?: boolean, onFirstLoad?: () => void }) {
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any | null>(null);

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

  return null;
}
