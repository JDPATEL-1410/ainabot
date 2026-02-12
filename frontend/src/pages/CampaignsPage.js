import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "../components/ui/alert-dialog";
import {
  Plus, Megaphone, Play, BarChart3, Send, CheckCircle, TrendingUp,
  Users, Target, ArrowRight, Plane, Cpu, FileJson, X, SendHorizontal
} from "lucide-react";
import { toast } from "sonner";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [campaignStep, setCampaignStep] = useState("select_type"); // select_type, form
  const [selectedType, setSelectedType] = useState(null);
  const [form, setForm] = useState({ name: "", template_id: "", segment_tags: "" });
  const [csvFile, setCsvFile] = useState(null);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(null);
  const [confirmSend, setConfirmSend] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, tRes] = await Promise.all([
        api.get("/campaigns"),
        api.get("/templates")
      ]);
      setCampaigns(cRes.data.campaigns);
      setTemplates(tRes.data.templates.filter(t => t.status === "approved" || t.status === "pending"));
    } catch {
      toast.error("Failed to load campaigns data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.template_id) {
      toast.error("Name and template are required");
      return;
    }
    try {
      const tags = form.segment_tags.split(",").map(t => t.trim()).filter(Boolean);
      await api.post("/campaigns", {
        name: form.name,
        template_id: form.template_id,
        segment_tags: tags,
        type: selectedType
      });
      toast.success("Marketing campaign created successfully");
      setShowCreate(false);
      setCampaignStep("select_type");
      setForm({ name: "", template_id: "", segment_tags: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create campaign");
    }
  };

  const handleSend = async (id) => {
    try {
      await api.post(`/campaigns/${id}/send`);
      toast.success("Campaign broadcasting started!");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to trigger broadcast");
    } finally {
      setConfirmSend(null);
    }
  };

  const handleSelectType = (type) => {
    setSelectedType(type);
    setCampaignStep("form");
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      toast.success(`File "${file.name}" selected`);
    } else {
      toast.error("Please select a valid CSV file");
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="campaigns-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-bold tracking-tight text-foreground">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Broadcasting message templates to customer segments</p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setCampaignStep("select_type");
            setSelectedType(null);
            setCsvFile(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" data-testid="create-campaign-btn">
              <Plus className="w-4 h-4 mr-1.5" />New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className={`max-w-[900px] bg-[#f8f9fa] dark:bg-[#121215] border-border p-0 gap-0 overflow-hidden shadow-2xl transition-all duration-300 ${campaignStep === 'select_type' ? 'max-w-[1000px]' : 'max-w-[500px]'}`} data-testid="campaign-dialog">

            {campaignStep === "select_type" ? (
              <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0c]">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Plane className="w-6 h-6 text-[#0b5c53] transform -rotate-45" />
                    <h2 className="text-lg font-bold text-muted-foreground/80">Select Campaign Type</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#f8f9fa] dark:bg-[#0d1117]">
                  {/* Broadcast Card */}
                  <Card className="bg-white dark:bg-[#121215] border-border hover:border-[#0b5c53]/50 transition-all p-6 shadow-sm group">
                    <h3 className="text-xl font-bold text-[#0b5c53] mb-3">Broadcast</h3>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed mb-8">
                      Select your audience & broadcast message. You can send upto 5MB of media files.
                    </p>
                    <div className="flex justify-end">
                      <Button onClick={() => handleSelectType('BROADCAST')} className="bg-[#0b5c53] hover:bg-[#084a43] text-white px-6 h-10 font-bold group">
                        Next <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </Card>

                  {/* API Campaign Card */}
                  <Card className="bg-white dark:bg-[#121215] border-border hover:border-[#0b5c53]/50 transition-all p-6 shadow-sm group">
                    <h3 className="text-xl font-bold text-[#0b5c53] mb-3">API Campaign</h3>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed mb-8">
                      Select a template and connect your exisiting systems with our API to automate messages.
                    </p>
                    <div className="flex justify-end">
                      <Button onClick={() => handleSelectType('API')} className="bg-[#0b5c53] hover:bg-[#084a43] text-white px-6 h-10 font-bold group">
                        Next <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </Card>

                  {/* CSV Broadcast Card */}
                  <Card className="bg-white dark:bg-[#121215] border-border hover:border-[#0b5c53]/50 transition-all p-6 shadow-sm group">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold text-[#0b5c53]">CSV Broadcast</h3>
                      <Badge className="bg-[#0b5c53] text-white text-[10px] uppercase font-black px-2 py-0.5">NEW</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed mb-8">
                      Upload your audience from CSV & Broadcast customized Template or Regular messages simultaneously.
                    </p>
                    <div className="flex justify-end">
                      <Button onClick={() => handleSelectType('CSV')} className="bg-[#0b5c53] hover:bg-[#084a43] text-white px-6 h-10 font-bold group">
                        Next <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-white dark:bg-[#121215]">
                <DialogHeader className="p-6 border-b border-border">
                  <DialogTitle className="font-outfit text-xl font-bold flex items-center justify-between">
                    <span>Launch {selectedType === 'CSV' ? 'CSV' : selectedType === 'API' ? 'API' : 'New'} Campaign</span>
                    <Button variant="ghost" size="icon" onClick={() => setCampaignStep('select_type')} className="h-8 w-8 rounded-full">
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </Button>
                  </DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Campaign Internal Name</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="E.g. Summer Sale 2024" className="bg-secondary/30 border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Message Template</Label>
                    <Select value={form.template_id} onValueChange={v => setForm(p => ({ ...p, template_id: v }))}>
                      <SelectTrigger className="bg-secondary/30 border-border">
                        <SelectValue placeholder="Choose an approved template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name} ({t.language})</SelectItem>
                        ))}
                        {templates.length === 0 && <SelectItem disabled value="none">No approved templates available</SelectItem>}
                      </SelectContent>
                    </Select>
                    {templates.length === 0 && <p className="text-[10px] text-amber-500">Wait for template approval before launching campaigns.</p>}
                  </div>
                  {selectedType !== 'CSV' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Target Segment Tags (Optional)</Label>
                      <Input value={form.segment_tags} onChange={e => setForm(p => ({ ...p, segment_tags: e.target.value }))} placeholder="E.g. lead, active_user (comma separated)" className="bg-secondary/30 border-border" />
                      <p className="text-[10px] text-muted-foreground">Leave empty to target all contacts in your workspace</p>
                    </div>
                  )}
                  {selectedType === 'CSV' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Upload CSV File</Label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                      />
                      <div
                        onClick={triggerFileSelect}
                        className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-colors"
                      >
                        <FileJson className={`w-8 h-8 mb-2 ${csvFile ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-xs text-muted-foreground">
                          {csvFile ? (
                            <span className="text-primary font-bold">{csvFile.name}</span>
                          ) : (
                            <>Drop CSV here or click to <span className="text-[#0b5c53] font-bold underline">browse</span></>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button onClick={handleCreate} className="w-full bg-[#0b5c53] hover:bg-[#084a43] text-white font-bold h-11">
                    Establish Campaign
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#121215]/40 border-border backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-secondary/10 border-b border-border py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Campaign Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent text-[11px] uppercase tracking-wider font-bold">
                  <TableHead className="pl-6">Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reach / Success</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground">Synchronizing campaigns...</span>
                    </div>
                  </TableCell></TableRow>
                ) : campaigns.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16">
                    <Megaphone className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-muted-foreground text-sm font-medium">No campaigns created yet</p>
                  </TableCell></TableRow>
                ) : campaigns.map(c => (
                  <TableRow key={c.id} className="border-border hover:bg-secondary/20 transition-colors group">
                    <TableCell className="pl-6 font-semibold py-4">
                      {c.name}
                      <p className="text-[10px] text-muted-foreground leading-none mt-1">Launched {new Date(c.created_at).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === "completed" ? "success" : c.status === "sending" ? "default" : "secondary"}
                        className={`text-[9px] font-bold px-2 h-5 border-0 rounded-full
                             ${c.status === "completed" ? "bg-green-500/10 text-green-500" :
                            c.status === "sending" ? "bg-primary/10 text-primary animate-pulse" :
                              "bg-secondary/80 text-muted-foreground"}`}>
                        {c.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 w-full max-w-[120px]">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>{c.stats?.delivered || 0}/{c.stats?.total || 0}</span>
                          <span>{Math.round(((c.stats?.delivered || 0) / (c.stats?.total || 1)) * 100)}%</span>
                        </div>
                        <Progress value={((c.stats?.delivered || 0) / (c.stats?.total || 1)) * 100} className="h-1.5 bg-secondary" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {c.status === "draft" ? (
                        <Button size="xs" className="bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border-primary/20 h-7 text-[10px]"
                          onClick={() => setConfirmSend(c)}>
                          <Play className="w-3 h-3 mr-1" /> Start Broad
                        </Button>
                      ) : (
                        <Button size="xs" variant="ghost" className="h-7 w-7" onClick={() => setShowStats(c)}>
                          <BarChart3 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info Column */}
        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 transform translate-x-1/2 -translate-y-1/2 opacity-10">
              <Target className="w-32 h-32 text-primary" />
            </div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                Launch Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 relative z-10">
              {[
                { label: "Approved Template", checked: true },
                { label: "Phone Connection", checked: true },
                { label: "Contact Segments", checked: true },
                { label: "Message Credits", checked: true }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <div className="w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  </div>
                  {item.label}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users className="w-3 h-3" /> Audience Segments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                You can target specific groups by using the tags you've assigned in your <strong>Contacts</strong> manager. Multiple tags can be combined using commas.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['vip', 'lead', 'july_outreach', 'new_user'].map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[9px] bg-secondary/50 border-0">#{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!confirmSend} onOpenChange={(v) => !v && setConfirmSend(null)}>
        <AlertDialogContent className="bg-[#121215] border-[#27272a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-outfit">Launch Broadcast Campaign?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You are about to send "{confirmSend?.name}" to {confirmSend?.stats?.total || 0} contacts. This action cannot be undone and will consume your messaging credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary/50 border-border">Discard</AlertDialogCancel>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleSend(confirmSend.id)}>
              <Send className="w-4 h-4 mr-2" /> Start Broadcasting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats Dialog */}
      <Dialog open={!!showStats} onOpenChange={(v) => !v && setShowStats(null)}>
        <DialogContent className="max-w-[400px] bg-[#121215] border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-outfit text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Campaign Performance
            </DialogTitle>
          </DialogHeader>
          {showStats && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/20 p-4 rounded-2xl border border-border/50">
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Delivered</p>
                  <p className="text-2xl font-bold text-green-500">{showStats.stats?.delivered || 0}</p>
                </div>
                <div className="bg-secondary/20 p-4 rounded-2xl border border-border/50">
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Sent</p>
                  <p className="text-2xl font-bold text-primary">{showStats.stats?.sent || 0}</p>
                </div>
                <div className="bg-secondary/20 p-4 rounded-2xl border border-border/50">
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Read Rate</p>
                  <p className="text-2xl font-bold text-amber-500">{Math.round(((showStats.stats?.read || 0) / (showStats.stats?.delivered || 1)) * 100)}%</p>
                </div>
                <div className="bg-secondary/20 p-4 rounded-2xl border border-border/50">
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Failures</p>
                  <p className="text-2xl font-bold text-destructive">{showStats.stats?.failed || 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>Overall Reach</span>
                  <span>{Math.round(((showStats.stats?.delivered || 0) / (showStats.stats?.total || 1)) * 100)}%</span>
                </div>
                <Progress value={((showStats.stats?.delivered || 0) / (showStats.stats?.total || 1)) * 100} className="h-2 bg-secondary" />
              </div>

              <div className="pt-4 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground font-bold tracking-tight">
                <span>ID: {showStats.id}</span>
                <Badge variant="outline" className="text-[9px] font-black">{showStats.status.toUpperCase()}</Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
