import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Key, Copy, Trash2, Plus, Radio, CheckCircle, Lock,
  FileText, Clock, Settings, Globe, ShieldCheck, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo",
  "Asia/Shanghai", "Australia/Sydney", "Pacific/Auckland"
];

export default function SettingsPage() {
  const { workspace, refreshWorkspace, user } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [waStatus, setWaStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [wsName, setWsName] = useState("");
  const [wsTimezone, setWsTimezone] = useState("UTC");
  const [newKeyName, setNewKeyName] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      const [kRes, waRes] = await Promise.all([
        api.get("/settings/api-keys").catch(() => ({ data: { api_keys: [] } })),
        api.get("/whatsapp/status").catch(() => ({ data: { connected: false } }))
      ]);
      setApiKeys(kRes.data.api_keys || []);
      setWaStatus(waRes.data || { connected: false });
      if (workspace) {
        setWsName(workspace.name || "");
        setWsTimezone(workspace.timezone || "UTC");
      }
    } catch (err) {
      console.error(err);
      toast.error("Partial failure loading settings");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/settings/audit-logs");
      setAuditLogs(data.logs || []);
    } catch {
      // toast.error("Failed to load audit trail");
    }
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  const handleUpdateWs = async () => {
    try {
      await api.patch("/settings/workspace", { name: wsName, timezone: wsTimezone });
      toast.success("Workspace settings updated");
      refreshWorkspace();
    } catch {
      toast.error("Update failed");
    }
  };

  const createApiKey = async () => {
    if (!newKeyName) return;
    try {
      await api.post("/settings/api-keys", { name: newKeyName });
      toast.success("API Key generated");
      setNewKeyName("");
      loadBase();
    } catch {
      toast.error("Failed to generate key");
    }
  };

  const deleteApiKey = async (id) => {
    try {
      await api.delete(`/settings/api-keys/${id}`);
      toast.success("Key revoked");
      loadBase();
    } catch {
      toast.error("Revocation failed");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    try {
      await api.post("/auth/change-password", { current_password: currentPw, new_password: newPw });
      toast.success("Password changed successfully");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Password change failed");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading && !workspace) {
    return <div className="p-6 flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-outfit text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your workspace and security preferences</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-secondary/20 border-border p-1 mb-8">
          <TabsTrigger value="general" className="data-[state=active]:bg-background">General</TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-background">Security</TabsTrigger>
          <TabsTrigger value="developers" className="data-[state=active]:bg-background">Developers</TabsTrigger>
          <TabsTrigger value="audit" onClick={loadAuditLogs} className="data-[state=active]:bg-background">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card/40 border-border shadow-sm">
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-primary" />Workspace Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input value={wsName} onChange={e => setWsName(e.target.value)} className="bg-secondary/30 border-border focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label>Business Timezone</Label>
                  <Select value={wsTimezone} onValueChange={setWsTimezone}>
                    <SelectTrigger className="bg-secondary/30 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleUpdateWs} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">Save Changes</Button>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border shadow-sm">
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Radio className="w-4 h-4 text-primary" />WhatsApp Business API</CardTitle></CardHeader>
            <CardContent>
              {waStatus?.connected ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-500">Service Connected</p>
                      <p className="text-xs text-muted-foreground">{waStatus.connection?.display_phone || "Unknown Number"} • {waStatus.connection?.waba_id || "No ID"}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center bg-secondary/10 rounded-xl border border-dashed border-border group hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                    <Radio className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-bold">WhatsApp not connected</p>
                  <p className="text-xs text-muted-foreground mb-4">Connect your WABA to start sending messages</p>
                  <Button variant="outline" size="sm" className="border-border">Go to Dashboard</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="bg-card/40 border-border max-w-2xl shadow-sm">
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />Change Password</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="bg-secondary/30 border-border" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="bg-secondary/30 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="bg-secondary/30 border-border" />
                  </div>
                </div>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">Update Password</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developers" className="space-y-6">
          <Card className="bg-card/40 border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><Key className="w-4 h-4 text-primary" />API Management</CardTitle>
                <div className="flex items-center gap-2">
                  <Input placeholder="Key Name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="w-40 h-8 text-xs bg-secondary/30 border-border" />
                  <Button size="sm" className="h-8 text-[11px] font-bold" onClick={createApiKey}><Plus className="w-3 h-3 mr-1" /> Create Key</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/5 border-border">
                    <TableHead className="pl-6 text-[11px] uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Key Fragment</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Created</TableHead>
                    <TableHead className="text-right pr-6 text-[11px] uppercase tracking-wider">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-xs italic">No keys found</TableCell></TableRow>
                  ) : apiKeys.map(k => (
                    <TableRow key={k.id} className="border-border group hover:bg-secondary/5 transition-colors">
                      <TableCell className="pl-6 font-bold text-sm tracking-tight">{k.name}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {k.key?.substring(0, 10)}••••••••••••••••
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 hover:text-primary" onClick={() => copyToClipboard(k.key)}><Copy className="w-3 h-3" /></Button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteApiKey(k.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-card/40 border-border shadow-sm">
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Security Audit Trail</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/5 border-border text-[11px] uppercase tracking-wider">
                      <TableHead className="pl-6">Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="pr-6">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-24 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <FileText className="w-12 h-12" />
                          <p className="text-xs font-mono tracking-widest uppercase">logs_not_found</p>
                        </div>
                      </TableCell></TableRow>
                    ) : auditLogs.map(log => (
                      <TableRow key={log.id} className="border-border text-[11px] hover:bg-secondary/5 transition-colors">
                        <TableCell className="pl-6 text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] uppercase font-black border-primary/20 bg-primary/5 text-primary tracking-tighter">{log.action?.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell className="font-bold text-foreground">{log.user_email || "System-Auto"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{log.details ? JSON.stringify(log.details) : "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
