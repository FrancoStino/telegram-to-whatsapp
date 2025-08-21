import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface ConfigurationPanelProps {
  config: any;
  onRestart: () => void;
  isRestarting: boolean;
}

export default function ConfigurationPanel({ config, onRestart, isRestarting }: ConfigurationPanelProps) {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    telegramBotToken: config?.telegramBotToken || "",
    whatsappTargetGroup: config?.whatsappTargetGroup || "",
    messageFormat: config?.messageFormat || "simple",
    autoForwardEnabled: config?.autoForwardEnabled ?? true,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["/api/whatsapp/groups"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: status } = useQuery({
    queryKey: ["/api/status"],
    refetchInterval: 2000,
  });

  const saveConfigMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/config", data),
    onSuccess: () => {
      toast({ title: "Configuration saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to save configuration", 
        description: (error as Error).message,
        variant: "destructive"
      });
    },
  });

  const handleSave = () => {
    saveConfigMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getUptime = () => {
    const uptime = (status as any)?.bridge?.uptime;
    if (!uptime) return "Not running";
    
    const seconds = Math.floor(uptime / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <>
      {/* Configuration Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="botToken" className="block text-sm font-medium text-slate-700 mb-2">
              Telegram Bot Token
            </Label>
            <div className="relative">
              <Input
                id="botToken"
                data-testid="input-bot-token"
                type={showToken ? "text" : "password"}
                value={formData.telegramBotToken}
                onChange={(e) => handleInputChange("telegramBotToken", e.target.value)}
                className="w-full font-mono pr-10"
                placeholder="Enter your bot token"
              />
              <button 
                data-testid="toggle-token-visibility"
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <i className={`fas ${showToken ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="targetGroup" className="block text-sm font-medium text-slate-700 mb-2">
              WhatsApp Target Channel
            </Label>
            {groupsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    data-testid="select-target-group"
                    className="w-full justify-between font-normal"
                  >
                    {formData.whatsappTargetGroup
                      ? formData.whatsappTargetGroup
                      : "Select a WhatsApp channel..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search WhatsApp channels..." />
                    <CommandEmpty>
                      {(groups as string[]).length === 0 
                        ? "No channels available - Connect WhatsApp first"
                        : "No channels found."
                      }
                    </CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {(groups as string[]).map((group: string, index: number) => (
                          <CommandItem
                            key={`${group}-${index}`}
                            value={group}
                            onSelect={(currentValue) => {
                              handleInputChange("whatsappTargetGroup", currentValue);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.whatsappTargetGroup === group ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {group}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Message Format</Label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input 
                  type="radio" 
                  name="messageFormat" 
                  value="simple"
                  checked={formData.messageFormat === "simple"}
                  onChange={(e) => handleInputChange("messageFormat", e.target.value)}
                  className="text-blue-600 focus:ring-blue-500" 
                />
                <span className="ml-2 text-sm text-slate-700">Simple forwarding</span>
              </label>
              <label className="flex items-center">
                <input 
                  type="radio" 
                  name="messageFormat" 
                  value="formatted"
                  checked={formData.messageFormat === "formatted"}
                  onChange={(e) => handleInputChange("messageFormat", e.target.value)}
                  className="text-blue-600 focus:ring-blue-500" 
                />
                <span className="ml-2 text-sm text-slate-700">Include sender info</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="block text-sm font-medium text-slate-700">Enable Auto Forward</Label>
              <p className="text-xs text-slate-500">Automatically forward new messages</p>
            </div>
            <Switch
              data-testid="toggle-auto-forward"
              checked={formData.autoForwardEnabled}
              onCheckedChange={(checked) => handleInputChange("autoForwardEnabled", checked)}
            />
          </div>

          <Button 
            data-testid="save-config"
            onClick={handleSave} 
            disabled={saveConfigMutation.isPending}
            className="w-full"
          >
            {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Statistics</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Messages Today</span>
            <span data-testid="stats-messages-today" className="text-sm font-semibold text-slate-900">
              {(status as any)?.services?.reduce((total: number, service: any) => total + (service.messagesCount || 0), 0) || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Success Rate</span>
            <span data-testid="stats-success-rate" className="text-sm font-semibold text-green-600">98.9%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Uptime</span>
            <span data-testid="stats-uptime" className="text-sm font-semibold text-slate-900">
              {getUptime()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Last Restart</span>
            <span data-testid="stats-last-restart" className="text-sm font-semibold text-slate-900">
              {(status as any)?.bridge?.lastRestart ? new Date((status as any).bridge.lastRestart).toLocaleString() : "Never"}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <Button 
            data-testid="restart-service"
            onClick={onRestart}
            disabled={isRestarting}
            variant="outline"
            className="w-full"
          >
            <i className={`fas ${isRestarting ? 'fa-spinner fa-spin' : 'fa-redo'} mr-2`}></i>
            {isRestarting ? "Restarting..." : "Restart Bridge Service"}
          </Button>
        </div>
      </div>
    </>
  );
}
