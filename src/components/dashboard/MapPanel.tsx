import { useEffect, useRef } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PeerUser, PeerMessage } from '@/hooks/usePeerNetwork';
import type { useGeolocation } from '@/hooks/useGeolocation';

// Lazy-load leaflet CSS
import 'leaflet/dist/leaflet.css';

interface MapPanelProps {
  users: Map<string, PeerUser>;
  geo: ReturnType<typeof useGeolocation>;
  onShareLocation: () => void;
  messages: PeerMessage[];
  roomId?: string;
}

export default function MapPanel({ users, geo, onShareLocation, messages, roomId }: MapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const sosMessages = messages.filter(m => m.type === 'sos' && m.location);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = await import('leaflet');

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const lat = geo.latitude || 0;
      const lng = geo.longitude || 0;

      const map = L.map(mapRef.current).setView([lat, lng], lat === 0 ? 2 : 14);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      // Own location
      if (geo.latitude && geo.longitude) {
        const myIcon = L.divIcon({
          html: '<div style="width:16px;height:16px;background:#2b9a3e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px #2b9a3e"></div>',
          iconSize: [16, 16],
          className: '',
        });
        L.marker([geo.latitude, geo.longitude], { icon: myIcon })
          .addTo(map)
          .bindPopup('You are here');
      }

      // Other users
      users.forEach(user => {
        if (user.location) {
          const userIcon = L.divIcon({
            html: `<div style="width:12px;height:12px;background:#1a8cff;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px #1a8cff"></div>`,
            iconSize: [12, 12],
            className: '',
          });
          L.marker([user.location.lat, user.location.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup(`${user.username} (${user.status})`);
        }
      });

      // SOS markers
      sosMessages.forEach(msg => {
        if (msg.location) {
          const sosIcon = L.divIcon({
            html: '<div style="width:20px;height:20px;background:#e63946;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #e63946;animation:pulse 1.5s infinite"></div>',
            iconSize: [20, 20],
            className: '',
          });
          L.marker([msg.location.lat, msg.location.lng], { icon: sosIcon })
            .addTo(map)
            .bindPopup(`🚨 SOS: ${msg.sender}`);
        }
      });

      // Zone boundary rectangle
      if (geo.latitude && geo.longitude && roomId) {
        const match = roomId.match(/^zone-(-?\d+)-(-?\d+)$/);
        if (match) {
          const gridLat = parseInt(match[1]) / 100;
          const gridLng = parseInt(match[2]) / 100;
          const bounds: L.LatLngBoundsExpression = [
            [gridLat - 0.005, gridLng - 0.005],
            [gridLat + 0.005, gridLng + 0.005],
          ];
          L.rectangle(bounds, {
            color: '#1a8cff',
            weight: 2,
            opacity: 0.6,
            fillColor: '#1a8cff',
            fillOpacity: 0.08,
            dashArray: '8 4',
          }).addTo(map).bindPopup('Your network zone (~1km)');
        }
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [geo.latitude, geo.longitude, users, sosMessages]);

  return (
    <div className="flex flex-col h-full">
      <div ref={mapRef} className="flex-1 bg-secondary" />
      <div className="p-4 border-t border-border bg-card flex items-center gap-3">
        <Button onClick={onShareLocation} className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1">
          <Navigation className="w-4 h-4 mr-2" />
          Share My Location
        </Button>
        {geo.latitude && (
          <span className="text-[10px] text-muted-foreground font-mono">
            <MapPin className="w-3 h-3 inline mr-1" />
            {geo.latitude.toFixed(4)}, {geo.longitude?.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
