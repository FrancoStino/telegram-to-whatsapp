import { Skeleton } from "@/components/ui/skeleton";

interface ServiceStatusCardProps {
  serviceName: string;
  serviceHandle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  status: any;
  isLoading: boolean;
}

export default function ServiceStatusCard({
  serviceName,
  serviceHandle,
  icon,
  iconColor,
  iconBg,
  status,
  isLoading
}: ServiceStatusCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-100 text-green-800";
      case "authenticating":
        return "bg-amber-100 text-amber-800";
      case "disconnected":
      default:
        return "bg-red-100 text-red-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-400";
      case "authenticating":
        return "text-amber-400";
      case "disconnected":
      default:
        return "text-red-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "authenticating":
        return "Authenticating";
      case "disconnected":
      default:
        return "Disconnected";
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
            <i className={`${icon} ${iconColor} text-lg`}></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{serviceName}</h3>
            <p className="text-sm text-slate-500">{serviceHandle}</p>
          </div>
        </div>
        <span 
          data-testid={`status-${serviceName.toLowerCase().replace(' ', '-')}`}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(status?.status || "disconnected")}`}
        >
          <i className={`fas fa-circle text-xs mr-1.5 ${getStatusIcon(status?.status || "disconnected")}`}></i>
          {getStatusText(status?.status || "disconnected")}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">
            {serviceName.includes("Telegram") ? "Bot Token" : "Target Group"}
          </span>
          <span data-testid="service-token" className="font-mono text-slate-900">
            {serviceName.includes("Telegram") ? "****1234:ABCD****" : "Bridge Group"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Last Activity</span>
          <span data-testid="last-activity" className="text-slate-900">
            {formatTimestamp(status?.lastActivity)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">
            {serviceName.includes("Telegram") ? "Messages Today" : "Forwards Today"}
          </span>
          <span data-testid="message-count" className="text-slate-900">
            {status?.messagesCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
