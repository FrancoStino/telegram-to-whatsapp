import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ServiceStatusCard from "@/components/service-status-card";
import ActivityFeed from "@/components/activity-feed";
import ConfigurationPanel from "@/components/configuration-panel";
import QRAuthentication from "@/components/qr-authentication";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/status"],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  const { data: config } = useQuery({
    queryKey: ["/api/config"],
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/logs"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: queueStats } = useQuery({
    queryKey: ["/api/queue"],
    refetchInterval: 3000,
  });

  const startBridgeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/bridge/start"),
    onSuccess: () => {
      toast({ title: "Bridge started successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to start bridge", 
        description: (error as Error).message,
        variant: "destructive"
      });
    },
  });

  const stopBridgeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/bridge/stop"),
    onSuccess: () => {
      toast({ title: "Bridge stopped successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to stop bridge", 
        description: (error as Error).message,
        variant: "destructive"
      });
    },
  });

  const restartBridgeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/bridge/restart"),
    onSuccess: () => {
      toast({ title: "Bridge restarted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to restart bridge", 
        description: (error as Error).message,
        variant: "destructive"
      });
    },
  });

  const handleToggleBridge = () => {
    if ((status as any)?.bridge?.isRunning) {
      stopBridgeMutation.mutate();
    } else {
      startBridgeMutation.mutate();
    }
  };

  const handleRestartBridge = () => {
    restartBridgeMutation.mutate();
  };

  const telegramStatus = (status as any)?.services?.find((s: any) => s.serviceName === "telegram");
  const whatsappStatus = (status as any)?.services?.find((s: any) => s.serviceName === "whatsapp");

  const bridgeActive = (status as any)?.bridge?.isRunning || false;

  return (
    <div className="bg-slate-50 font-inter antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <i className="fab fa-telegram text-telegram text-2xl"></i>
                <i className="fas fa-arrow-right text-slate-400 text-sm"></i>
                <i className="fab fa-whatsapp text-whatsapp text-2xl"></i>
              </div>
              <h1 className="text-xl font-semibold text-slate-900">Message Bridge</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-slate-700">Bridge Status:</span>
                <span 
                  data-testid="bridge-status"
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    bridgeActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  <i className={`fas fa-circle text-xs mr-1.5 ${
                    bridgeActive ? "text-green-400" : "text-red-400"
                  }`}></i>
                  {bridgeActive ? "Connected" : "Disconnected"}
                </span>
              </div>
              
              <button 
                data-testid="toggle-bridge"
                onClick={handleToggleBridge}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  bridgeActive ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  bridgeActive ? "translate-x-5" : "translate-x-0"
                }`}></span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Service Status and Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ServiceStatusCard
                serviceName="Telegram Bot"
                serviceHandle="@YourBridgeBot"
                icon="fab fa-telegram"
                iconColor="text-telegram"
                iconBg="bg-telegram/10"
                status={telegramStatus}
                isLoading={statusLoading}
              />
              
              <ServiceStatusCard
                serviceName="WhatsApp Web"
                serviceHandle="+1 234 567 8900"
                icon="fab fa-whatsapp"
                iconColor="text-whatsapp"
                iconBg="bg-whatsapp/10"
                status={whatsappStatus}
                isLoading={statusLoading}
              />
            </div>

            {/* Activity Feed */}
            <ActivityFeed logs={logs as any[]} isLoading={logsLoading} />
          </div>

          {/* Configuration Panel */}
          <div className="space-y-6">
            <QRAuthentication />
            <ConfigurationPanel 
              config={config}
              onRestart={handleRestartBridge}
              isRestarting={restartBridgeMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Floating Status Indicator */}
      <div className="fixed bottom-6 right-6">
        <div className="bg-white rounded-full shadow-lg border border-slate-200 p-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              bridgeActive ? "bg-green-400 animate-pulse" : "bg-red-400"
            }`}></div>
            <span className="text-sm font-medium text-slate-700">
              {bridgeActive ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
