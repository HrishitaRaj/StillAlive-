import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/hooks/useSession";
import RoomServerManager from '@/components/RoomServerManager';
import LandingPage from "./pages/LandingPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import DashboardPage from "./pages/DashboardPage";
import FutureFeaturesPage from "./pages/FutureFeaturesPage";
import RescuerAuthPage from "./pages/RescuerAuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SessionProvider>
        <RoomServerManager />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/join" element={<JoinRoomPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/future" element={<FutureFeaturesPage />} />
            <Route path="/rescuer" element={<RescuerAuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
