import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityFeedProps {
  logs: any[];
  isLoading: boolean;
}

export default function ActivityFeed({ logs, isLoading }: ActivityFeedProps) {
  const { toast } = useToast();

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/logs"),
    onSuccess: () => {
      toast({ title: "Activity logs cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to clear logs", 
        description: (error as Error).message,
        variant: "destructive"
      });
    },
  });

  const getLogIcon = (type: string) => {
    switch (type) {
      case "message_forwarded":
        return { icon: "fas fa-arrow-right", color: "text-green-600", bg: "bg-green-100" };
      case "connection_established":
        return { icon: "fas fa-info", color: "text-blue-600", bg: "bg-blue-100" };
      case "warning":
        return { icon: "fas fa-exclamation-triangle", color: "text-amber-600", bg: "bg-amber-100" };
      case "error":
        return { icon: "fas fa-times", color: "text-red-600", bg: "bg-red-100" };
      case "info":
      default:
        return { icon: "fas fa-play", color: "text-green-600", bg: "bg-green-100" };
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Unknown time";
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="p-4">
              <div className="flex items-start space-x-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-64 mb-1" />
                  <Skeleton className="h-3 w-80" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
          <button 
            data-testid="clear-logs"
            onClick={() => clearLogsMutation.mutate()}
            disabled={clearLogsMutation.isPending}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <i className="fas fa-trash-can mr-1"></i>
            {clearLogsMutation.isPending ? "Clearing..." : "Clear"}
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {!logs || logs.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fas fa-inbox text-slate-300 text-4xl mb-3"></i>
            <p className="text-slate-500">No activity logs available</p>
            <p className="text-sm text-slate-400 mt-1">Activity will appear here when the bridge is active</p>
          </div>
        ) : (
          logs.map((log) => {
            const logStyle = getLogIcon(log.type);
            return (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className={`w-8 h-8 ${logStyle.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <i className={`${logStyle.icon} ${logStyle.color} text-xs`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-900">{log.title}</p>
                      <span className="text-xs text-slate-500">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    {log.description && (
                      <p className="text-sm text-slate-600">{log.description}</p>
                    )}
                    {log.content && (
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        Content: "{log.content}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
