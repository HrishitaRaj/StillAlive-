import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { usePeerNetwork } from '@/hooks/usePeerNetwork';
import { useGeolocation } from '@/hooks/useGeolocation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function DashboardPage() {
  const { username, roomId, isJoined, leave } = useSession();
  const navigate = useNavigate();
  const geo = useGeolocation();

  useEffect(() => {
    if (!isJoined) {
      navigate('/join');
    }
  }, [isJoined, navigate]);

  const network = usePeerNetwork({ roomId, username });

  if (!isJoined) return null;

  return (
    <DashboardLayout
      network={network}
      geo={geo}
      username={username}
      roomId={roomId}
      onLeave={() => { leave(); navigate('/'); }}
    />
  );
}
