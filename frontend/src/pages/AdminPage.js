import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Shield, Users, MessageSquare, Building2, TrendingUp, CreditCard,
  Search, Edit, Trash2, CheckCircle, XCircle, DollarSign, Activity,
  Globe, Briefcase, UserPlus, Filter, Plus
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "../components/ui/scroll-area";

const PLAN_COLORS = {
  starter: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  pro: "bg-primary/10 text-primary border-primary/20",
  enterprise: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  trial: "bg-amber-400/10 text-amber-400 border-amber-400/20",
};

export default function AdminPage() {
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [billing, setBilling] = useState({ transactions: [], mrr: 0, total_revenue: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [plans, setPlans] = useState({});
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ id: "", name: "", price: 0, agents: 3, numbers: 1, messages: 5000 });

  // Edit & Create State
  const [editingUser, setEditingUser] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({ name: "", email: "", password: "", is_super_admin: false, workspace_id: "" });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, sRes, uRes, bRes, pRes] = await Promise.all([
        api.get("/admin/tenants"),
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/billing"),
        api.get("/admin/plans")
      ]);
      setTenants(tRes.data?.tenants || []);
      setStats(sRes.data);
      setUsers(uRes.data?.users || []);
      setBilling(bRes.data || { transactions: [], mrr: 0, total_revenue: 0 });
      setPlans(pRes.data?.plans || {});
    } catch (err) {
      console.error("Admin load error:", err);
      toast.error(err.response?.data?.detail || "Super Admin access required");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSavePlans = async (updatedPlans = plans) => {
    try {
      await api.post("/admin/plans", updatedPlans);
      toast.success("Plan configurations updated globally");
      loadAll();
    } catch {
      toast.error("Failed to update global plan settings");
    }
  };

  const handleAddPlan = () => {
    if (!newPlan.id || !newPlan.name) return toast.error("ID and Name are required");
    const updated = { ...plans, [newPlan.id.toLowerCase()]: { ...newPlan } };
    handleSavePlans(updated);
    setIsAddingPlan(false);
    setNewPlan({ id: "", name: "", price: 0, agents: 3, numbers: 1, messages: 5000 });
  };

  const deletePlan = (id) => {
    if (!window.confirm(`Remove ${id} plan?`)) return;
    const { [id]: removed, ...remaining } = plans;
    handleSavePlans(remaining);
  };

  const handleResetPlans = async () => {
    if (!window.confirm("Restore default platform plans? This will overwrite your current settings.")) return;
    try {
      const defaults = {
        starter: { name: "Starter", price: 2499, agents: 3, numbers: 1, messages: 5000 },
        pro: { name: "Pro", price: 5999, agents: 10, numbers: 3, messages: 50000 },
        enterprise: { name: "Enterprise", price: 14999, agents: -1, numbers: -1, messages: -1 }
      };
      await handleSavePlans(defaults);
    } catch {
      toast.error("Reset failed");
    }
  };

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleUpdateUser = async () => {
    try {
      await api.patch(`/admin/users/${editingUser.id}`, {
        name: editingUser.name,
        email: editingUser.email
      });
      toast.success("User updated successfully");
      setEditingUser(null);
      loadAll();
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleUpdateTenant = async () => {
    try {
      await api.patch(`/admin/tenants/${editingTenant.id}`, {
        name: editingTenant.name,
        plan: editingTenant.plan
      });
      toast.success("Workspace updated");
      setEditingTenant(null);
      loadAll();
    } catch {
      toast.error("Failed to update workspace");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("User removed from platform");
      loadAll();
    } catch {
      toast.error("Cleanup failed");
    }
  };

  const handleCreateUser = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      return toast.error("Name, Email and Password are required");
    }
    try {
      await api.post("/admin/users", newUserData);
      toast.success("User created successfully");
      setIsAddingUser(false);
      setNewUserData({ name: "", email: "", password: "", is_super_admin: false, workspace_id: "" });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create user");
    }
  };

  const statCards = stats ? [
    { label: "Total Users", value: stats.total_users, icon: Users, color: "text-blue-400" },
    { label: "Active Workspaces", value: stats.total_workspaces, icon: Building2, color: "text-primary" },
    { label: `MRR (${stats.currency || 'INR'})`, value: `₹${(stats.mrr || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: "text-green-400" },
    { label: "Total Messages", value: stats.total_messages, icon: MessageSquare, color: "text-amber-400" },
  ] : [];

  return (
    <div className="p-6 space-y-6" data-testid="admin-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-bold tracking-tight text-foreground">Super Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Global platform management and analytics</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadAll()} className="border-border">
          <Activity className="w-4 h-4 mr-2" /> Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-secondary/20 rounded-xl animate-pulse" />)
        ) : statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="bg-[#121215]/40 border-border backdrop-blur-sm">
              <CardContent className="pt-5 pb-4">
                <Icon className={`w-5 h-5 ${s.color} mb-2`} />
                <p className="font-outfit text-2xl font-bold tracking-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="bg-secondary/20 border-border p-1 mb-6">
          <TabsTrigger value="tenants" className="data-[state=active]:bg-background">Workspaces</TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-background">User Management</TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-background">Revenue & Billing</TabsTrigger>
          <TabsTrigger value="manage-plans" className="data-[state=active]:bg-background">Manage Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <Card className="bg-[#121215]/40 border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-4 bg-secondary/10 border-b border-border">
              <div>
                <CardTitle className="text-sm font-bold">Workspace Directory</CardTitle>
                <CardDescription className="text-xs">Manage tenants and their service levels</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Filter workspaces..." className="pl-9 h-8 text-xs bg-background/50 border-border" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/5 border-border hover:bg-transparent text-[11px] uppercase tracking-wider">
                    <TableHead className="pl-6">Workspace Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right pr-6">Management</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.filter(t => (t.name || "").toLowerCase().includes(search.toLowerCase())).map(t => (
                    <TableRow key={t.id} className="border-border group transition-colors hover:bg-secondary/10">
                      <TableCell className="pl-6 font-bold text-sm">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0 ${PLAN_COLORS[t.plan] || PLAN_COLORS.trial}`}>
                          {t.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex gap-4">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.member_count}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.message_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingTenant(t)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="bg-[#121215]/40 border-border overflow-hidden">
            <CardHeader className="py-4 bg-secondary/10 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Platform Users</CardTitle>
                <CardDescription className="text-xs">Individual account management across all tenants</CardDescription>
              </div>
              <Button onClick={() => setIsAddingUser(true)} size="sm" className="h-8 bg-[#0b5c53] hover:bg-[#084a43] text-white">
                <UserPlus className="w-4 h-4 mr-2" /> Add Platform User
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/5 border-border text-[11px] uppercase tracking-wider">
                    <TableHead className="pl-6">User Identity</TableHead>
                    <TableHead>Primary Workspace</TableHead>
                    <TableHead>Account Level</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right pr-6">Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className="border-border group hover:bg-secondary/5">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
                            {(u.name?.[0] || "U").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{u.name || "Unnamed User"}</p>
                            <p className="text-[10px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono">{u.workspace_id || "UNASSIGNED"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-tighter bg-secondary/50">{u.is_super_admin ? "SUPER ADMIN" : "TENANT USER"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell className="text-right pr-6 space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingUser(u)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteUser(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-primary/5 border-primary/20 relative overflow-hidden group">
              <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={80} /></div>
              <CardContent className="pt-6 relative">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Monthly Recurring Income</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-primary">₹{(billing?.mrr || 0).toLocaleString('en-IN')}</p>
                  <Badge className="bg-green-500/10 text-green-500 border-0 text-[10px]">+12.5%</Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20 relative overflow-hidden group">
              <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform"><Briefcase size={80} /></div>
              <CardContent className="pt-6 relative">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Lifetime Revenue</p>
                <p className="text-3xl font-black text-green-500">₹{(billing?.total_revenue || 0).toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20 relative overflow-hidden group">
              <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform"><CreditCard size={80} /></div>
              <CardContent className="pt-6 relative">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Paid Licenses</p>
                <p className="text-3xl font-black text-amber-500">{(billing?.transactions?.length || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#121215]/40 border-border overflow-hidden">
            <CardHeader className="py-4 bg-secondary/10 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Global Billing Ledger</CardTitle>
                <CardDescription className="text-xs">Real-time settlement record across all tenants</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs"><Filter className="w-3 h-3 mr-2" /> Export CSV</Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/5 border-border text-[11px] uppercase tracking-wider">
                      <TableHead className="pl-6">Transaction Date</TableHead>
                      <TableHead>Tenant ID</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(billing?.transactions?.length || 0) === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground text-xs font-mono">NO_RECORDS_FOUND</TableCell></TableRow>
                    ) : billing.transactions.map(tx => (
                      <TableRow key={tx.id} className="border-border hover:bg-white/5 transition-colors">
                        <TableCell className="pl-6 text-[11px] text-muted-foreground">{tx.created_at ? new Date(tx.created_at).toLocaleString() : "Unknown Date"}</TableCell>
                        <TableCell className="text-[11px] font-mono">{tx.workspace_id}</TableCell>
                        <TableCell className="text-[10px] font-bold uppercase">{tx.plan_id}</TableCell>
                        <TableCell className="text-sm font-mono font-bold text-green-400">₹{(tx.amount || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[9px] font-black h-5">SETTLED</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-plans" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-bold">Global Plan Configurations</h3>
              <p className="text-xs text-muted-foreground">Adjust pricing and limits for all service levels</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAddingPlan(true)} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4 mr-2" /> Add New Plan
              </Button>
              <Button onClick={handleResetPlans} variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Globe className="w-4 h-4 mr-2" /> Restore Defaults
              </Button>
              <Button onClick={() => handleSavePlans()} className="bg-[#0b5c53] hover:bg-[#084a43] text-white">Save All Changes</Button>
            </div>
          </div>

          {Object.keys(plans).length === 0 ? (
            <Card className="bg-secondary/5 border-dashed border-border py-20 text-center">
              <CardContent>
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No custom plans configured. Click 'Add New Plan' to start.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(plans).map(([key, p]) => (
                <Card key={key} className="bg-[#121215]/40 border-border overflow-hidden">
                  <CardHeader className={`bg-secondary/10 border-b border-border py-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">{p.name}</CardTitle>
                        <Badge variant="outline" className="text-[9px] font-black opacity-50">{key.toUpperCase()}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deletePlan(key)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold opacity-50">Price Per Month (INR)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          value={p.price}
                          onChange={(e) => setPlans({ ...plans, [key]: { ...p, price: parseFloat(e.target.value) } })}
                          className="pl-8 bg-background/50 border-border font-mono font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold opacity-50">Agent Limit</Label>
                        <Input
                          type="number"
                          value={p.agents}
                          onChange={(e) => setPlans({ ...plans, [key]: { ...p, agents: parseInt(e.target.value) } })}
                          className="bg-background/50 border-border font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold opacity-50">Numbers</Label>
                        <Input
                          type="number"
                          value={p.numbers}
                          onChange={(e) => setPlans({ ...plans, [key]: { ...p, numbers: parseInt(e.target.value) } })}
                          className="bg-background/50 border-border font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold opacity-50">Monthly Messages</Label>
                      <Input
                        type="number"
                        value={p.messages}
                        onChange={(e) => setPlans({ ...plans, [key]: { ...p, messages: parseInt(e.target.value) } })}
                        className="bg-background/50 border-border font-mono"
                      />
                      <p className="text-[9px] text-muted-foreground">Use -1 for unlimited capacity</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="bg-[#121215] border-[#27272a] shadow-2xl">
          <DialogHeader><DialogTitle className="font-outfit text-xl font-bold">Edit Platform User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editingUser?.name || ""} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="bg-secondary/30 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input value={editingUser?.email || ""} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="bg-secondary/30 border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleUpdateUser} className="bg-primary hover:bg-primary/90">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={!!editingTenant} onOpenChange={() => setEditingTenant(null)}>
        <DialogContent className="bg-[#121215] border-[#27272a] shadow-2xl">
          <DialogHeader><DialogTitle className="font-outfit text-xl font-bold">Workspace Configuration</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Workspace Name</Label>
              <Input value={editingTenant?.name || ""} onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })} className="bg-secondary/30 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Service Plan</Label>
              <Select value={editingTenant?.plan} onValueChange={v => setEditingTenant({ ...editingTenant, plan: v })}>
                <SelectTrigger className="bg-secondary/30 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(plans).map(([k, p]) => (
                    <SelectItem key={k} value={k}>{p.name} (₹{p.price}/mo)</SelectItem>
                  ))}
                  <SelectItem value="trial">Free Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTenant(null)}>Cancel</Button>
            <Button onClick={handleUpdateTenant} className="bg-primary hover:bg-primary/90">Apply Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Plan Dialog */}
      <Dialog open={isAddingPlan} onOpenChange={setIsAddingPlan}>
        <DialogContent className="bg-[#121215] border-[#27272a] shadow-2xl">
          <DialogHeader><DialogTitle className="font-outfit text-xl font-bold">Create New Service Plan</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>System ID (slug)</Label>
                <Input placeholder="starter, pro, gold..." value={newPlan.id} onChange={e => setNewPlan({ ...newPlan, id: e.target.value })} className="bg-secondary/30 border-border" />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input placeholder="Starter Plan" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} className="bg-secondary/30 border-border" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly Price (INR)</Label>
              <Input type="number" value={newPlan.price} onChange={e => setNewPlan({ ...newPlan, price: parseFloat(e.target.value) })} className="bg-secondary/30 border-border" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Agents</Label>
                <Input type="number" value={newPlan.agents} onChange={e => setNewPlan({ ...newPlan, agents: parseInt(e.target.value) })} className="bg-secondary/30 border-border" />
              </div>
              <div className="space-y-2">
                <Label>Numbers</Label>
                <Input type="number" value={newPlan.numbers} onChange={e => setNewPlan({ ...newPlan, numbers: parseInt(e.target.value) })} className="bg-secondary/30 border-border" />
              </div>
              <div className="space-y-2">
                <Label>Messages</Label>
                <Input type="number" value={newPlan.messages} onChange={e => setNewPlan({ ...newPlan, messages: parseInt(e.target.value) })} className="bg-secondary/30 border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingPlan(false)}>Cancel</Button>
            <Button onClick={handleAddPlan} className="bg-primary hover:bg-primary/90 text-white">Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add User Dialog */}
      <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
        <DialogContent className="bg-[#121215] border-[#27272a] shadow-2xl">
          <DialogHeader><DialogTitle className="font-outfit text-xl font-bold">Create Platform User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="John Doe" value={newUserData.name} onChange={e => setNewUserData({ ...newUserData, name: e.target.value })} className="bg-secondary/30 border-border" />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="john@example.com" value={newUserData.email} onChange={e => setNewUserData({ ...newUserData, email: e.target.value })} className="bg-secondary/30 border-border" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secure Password</Label>
              <Input type="password" value={newUserData.password} onChange={e => setNewUserData({ ...newUserData, password: e.target.value })} className="bg-secondary/30 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Primary Workspace ID (Optional)</Label>
              <Input placeholder="ws_xxxx" value={newUserData.workspace_id} onChange={e => setNewUserData({ ...newUserData, workspace_id: e.target.value })} className="bg-secondary/30 border-border" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
              <input
                type="checkbox"
                id="is_super_admin"
                checked={newUserData.is_super_admin}
                onChange={e => setNewUserData({ ...newUserData, is_super_admin: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary bg-background"
              />
              <Label htmlFor="is_super_admin" className="cursor-pointer">
                <span className="font-bold text-sm block">Grant Super Admin Privileges</span>
                <span className="text-[10px] text-muted-foreground block">This user will have full platform control</span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingUser(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} className="bg-primary hover:bg-primary/90 text-white">Create Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
