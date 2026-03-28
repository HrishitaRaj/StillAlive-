import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SessionContextType {
  username: string;
  roomId: string;
  isJoined: boolean;
  join: (username: string, roomId?: string) => void;
  leave: () => void;
}

const SessionContext = createContext<SessionContextType>({
  username: '',
  roomId: '',
  isJoined: false,
  join: () => {},
  leave: () => {},
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const join = (name: string, room?: string) => {
    setUsername(name);
    if (room) setRoomId(room);
    setIsJoined(true);
  };

  const leave = () => {
    setUsername('');
    setRoomId('');
    setIsJoined(false);
  };

  return (
    <SessionContext.Provider value={{ username, roomId, isJoined, join, leave }}>
      {children}
    </SessionContext.Provider>
  );
}
