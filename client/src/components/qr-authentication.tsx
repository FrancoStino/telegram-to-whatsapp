import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import QRCode from "react-qr-code";

export default function QRAuthentication() {
  const { toast } = useToast();

  const { data: qrData, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/qr"],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const refreshQRMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/bridge/restart"),
    onSuccess: () => {
      toast({ title: "QR code refreshed" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/qr"] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to refresh QR code", 
        description: (error as Error).message,
        variant: "destructive"
      });
    },
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">WhatsApp Authentication</h3>
      
      <div className="text-center">
        <div className="w-48 h-48 mx-auto bg-slate-100 rounded-lg flex items-center justify-center mb-4">
          {isLoading ? (
            <Skeleton className="w-40 h-40" />
          ) : (qrData as any)?.qrCode ? (
            <div className="w-40 h-40 bg-white p-2 rounded">
              <QRCode
                size={144}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                value={(qrData as any).qrCode}
                viewBox="0 0 256 256"
              />
            </div>
          ) : (
            <div className="w-40 h-40 bg-white border-2 border-slate-300 rounded flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-qrcode text-slate-400 text-3xl mb-2"></i>
                <p className="text-xs text-slate-500">
                  {(qrData as any)?.qrCode === null ? "Already authenticated" : "QR code not available"}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          {(qrData as any)?.qrCode 
            ? "Open WhatsApp on your phone and scan this QR code to connect"
            : "WhatsApp connection status will update automatically"
          }
        </p>
        
        <button 
          data-testid="refresh-qr"
          onClick={() => refreshQRMutation.mutate()}
          disabled={refreshQRMutation.isPending}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <i className={`fas ${refreshQRMutation.isPending ? 'fa-spinner fa-spin' : 'fa-redo'} mr-2`}></i>
          {refreshQRMutation.isPending ? "Refreshing..." : "Refresh QR Code"}
        </button>
      </div>
    </div>
  );
}
