import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Plus, Zap, ArrowRight, Tag, MessageSquare, UserPlus, Webhook, Activity, Trash2, Power, LayoutPanelLeft, MousePointer2 } from "lucide-react";
import { toast } from "sonner";
import AutomationFlowBuilder from "../components/AutomationFlowBuilder";

const TRIGGER_OPTIONS = [
  { value: "keyword_match", label: "Message contains keyword", icon: MessageSquare, color: "text-blue-400" },
  { value: "new_contact", label: "New contact message", icon: UserPlus, color: "text-green-400" },
  { value: "tag_added", label: "Tag added to contact", icon: Tag, color: "text-amber-400" },
];

const ACTION_OPTIONS = [
  { value: "send_template", label: "Send template message" },
  { value: "assign_agent", label: "Assign to agent (round robin)" },
  { value: "add_tag", label: "Add tag to contact" },
  { value: "webhook", label: "Call external webhook" },
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [form, setForm] = useState({ name: "", trigger: "keyword_match", keyword: "", action_type: "send_template", action_value: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/automations");
      setAutomations(data.automations || []);
    } catch {
      toast.error("Failed to load automations workflow");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveFlow = async (flowData) => {
    try {
      if (editingAutomation) {
        await api.put(`/automations/${editingAutomation.id}`, flowData);
        toast.success("Workflow updated");
      } else {
        await api.post("/automations", flowData);
        toast.success("New flow established");
      }
      setIsBuilding(false);
      setEditingAutomation(null);
      load();
    } catch (err) {
      toast.error("Failed to save automation flow");
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      await api.put(`/automations/${id}`, { status: newStatus });
      toast.success(`Automation ${newStatus === "active" ? "Enabled" : "Disabled"}`);
      load();
    } catch {
      toast.error("Toggle failed");
    }
  };

  const deleteAutomation = async (id) => {
    try {
      await api.delete(`/automations/${id}`);
      toast.success("Workflow removed");
      load();
    } catch {
      toast.error("Cleanup failed");
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="automations-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-bold tracking-tight text-foreground">Automations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Streamline your workflows with event-based triggers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="bg-[#0b5c53] hover:bg-[#084a43] text-white font-black text-xs uppercase rounded-full shadow-lg shadow-primary/20"
            onClick={() => { setEditingAutomation(null); setIsBuilding(true); }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Open Flow Builder
          </Button>
        </div>
      </div>

      {isBuilding && (
        <AutomationFlowBuilder
          onSave={handleSaveFlow}
          onCancel={() => setIsBuilding(false)}
          initialData={editingAutomation?.flow_data ? {
            ...editingAutomation.flow_data,
            name: editingAutomation.name
          } : null}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-secondary/20 animate-pulse border border-border" />)
        ) : automations.length === 0 ? (
          <Card className="col-span-full bg-card/10 border-dashed border-border py-20 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-muted-foreground font-medium">No active workflows</p>
            <Button variant="link" onClick={() => { setEditingAutomation(null); setIsBuilding(true); }}>Create your first automation</Button>
          </Card>
        ) : automations.map(a => {
          const trigger = TRIGGER_OPTIONS.find(o => o.value === a.trigger) || TRIGGER_OPTIONS[0];
          const TriggerIcon = trigger.icon;
          return (
            <Card key={a.id} className={`bg-card/40 border-border hover:border-primary/50 transition-all group overflow-hidden ${a.status !== "active" && "opacity-60 grayscale-[0.5]"}`}>
              <CardHeader className="pb-3 border-b border-border/10 bg-secondary/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold truncate pr-10">{a.name}</CardTitle>
                  <Switch
                    checked={a.status === "active"}
                    onCheckedChange={() => toggleStatus(a.id, a.status)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-1.5 rounded-md bg-secondary ${trigger.color}`}>
                    <TriggerIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trigger</p>
                    <p className="text-xs text-foreground mt-0.5">{trigger.label} {a.conditions?.keyword && <Badge variant="secondary" className="px-1 text-[9px] h-4 bg-secondary font-mono">"{a.conditions.keyword}"</Badge>}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1.5 rounded-md bg-primary/10 text-primary">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Action</p>
                    <p className="text-xs text-foreground mt-0.5">
                      {ACTION_OPTIONS.find(o => o.value === a.actions[0]?.type)?.label}
                      {a.actions[0]?.value && <span className="text-muted-foreground ml-1">→ {a.actions[0].value}</span>}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border/10">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> {a.executions || 0} executions
                  </span>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() => { setEditingAutomation(a); setIsBuilding(true); }}
                    >
                      <MousePointer2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteAutomation(a.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div >
  );
}
