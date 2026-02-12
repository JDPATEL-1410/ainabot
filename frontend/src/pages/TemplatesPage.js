import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  Plus, FileText, Send, CheckCircle, Clock, XCircle, AlertCircle, Trash2, Layout,
  ChevronLeft, Image, Video, File, Copy, Phone, Globe, MousePointer2,
  X
} from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP = {
  approved: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  pending: { icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  draft: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-secondary/50 border-border" },
};

const LANGUAGES = [
  { code: "en_US", name: "English (US)" },
  { code: "en_GB", name: "English (UK)" },
  { code: "es", name: "Spanish" },
  { code: "pt_BR", name: "Portuguese (BR)" },
  { code: "hi", name: "Hindi" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  // Advanced Form State
  const [form, setForm] = useState({
    name: "",
    language: "en_US",
    category: "MARKETING",
    headerType: "NONE", // NONE, TEXT, IMAGE, VIDEO, DOCUMENT
    headerText: "",
    body: "",
    footer: "",
    actionType: "NONE", // NONE, CALL_TO_ACTIONS, QUICK_REPLIES, ALL
    buttons: []
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/templates");
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      if (!form.name || !form.body) {
        toast.error("Name and Body are required");
        return;
      }

      const components = [
        { type: "BODY", text: form.body }
      ];

      if (form.headerType === "TEXT" && form.headerText) {
        components.push({ type: "HEADER", format: "TEXT", text: form.headerText });
      } else if (form.headerType !== "NONE") {
        components.push({ type: "HEADER", format: form.headerType });
      }

      if (form.footer) {
        components.push({ type: "FOOTER", text: form.footer });
      }

      if (form.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: form.buttons.map(b => ({
            type: b.type,
            text: b.text,
            url: b.type === "URL" ? b.value : undefined,
            phone_number: b.type === "PHONE_NUMBER" ? b.value : undefined,
            example: b.type === "COPY_CODE" ? [b.value] : undefined
          }))
        });
      }

      await api.post("/templates", {
        name: form.name.toLowerCase().replace(/\s+/g, "_"),
        language: form.language,
        category: form.category,
        components
      });

      toast.success("Template created and synced");
      setShowCreate(false);
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create template");
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      language: "en_US",
      category: "MARKETING",
      headerType: "NONE",
      headerText: "",
      body: "",
      footer: "",
      actionType: "NONE",
      buttons: []
    });
  };

  const addButton = (type) => {
    const counts = {
      QUICK_REPLY: form.buttons.filter(b => b.type === "QUICK_REPLY").length,
      URL: form.buttons.filter(b => b.type === "URL").length,
      PHONE_NUMBER: form.buttons.filter(b => b.type === "PHONE_NUMBER").length,
      COPY_CODE: form.buttons.filter(b => b.type === "COPY_CODE").length,
    };

    if (type === "QUICK_REPLY" && counts.QUICK_REPLY >= 10) return;
    if (type === "URL" && counts.URL >= 2) return;
    if (type === "PHONE_NUMBER" && counts.PHONE_NUMBER >= 1) return;
    if (type === "COPY_CODE" && counts.COPY_CODE >= 1) return;
    if (form.buttons.length >= 10) return;

    const newBtn = { type, text: "", value: "" };
    if (type === "QUICK_REPLY") newBtn.text = `Reply ${counts.QUICK_REPLY + 1}`;
    if (type === "URL") { newBtn.text = "Visit Website"; newBtn.value = "https://"; }
    if (type === "PHONE_NUMBER") { newBtn.text = "Call Us"; newBtn.value = "+1"; }
    if (type === "COPY_CODE") { newBtn.text = "Copy Code"; newBtn.value = "CODE10"; }

    setForm(p => ({ ...p, buttons: [...p.buttons, newBtn] }));
  };

  const updateButton = (index, field, value) => {
    const list = [...form.buttons];
    list[index][field] = value;
    setForm(p => ({ ...p, buttons: list }));
  };

  const removeButton = (index) => {
    setForm(p => ({ ...p, buttons: p.buttons.filter((_, i) => i !== index) }));
  };

  const handleSubmitStatus = async (id) => {
    try {
      const { data } = await api.post(`/templates/${id}/submit`);
      toast.success(`Submission status: ${data.status}`);
      load();
    } catch {
      toast.error("Submission failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.delete(`/templates/${id}`);
      toast.success("Template deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen" data-testid="templates-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-outfit text-2xl font-black tracking-tight text-foreground uppercase">WhatsApp Templates</h1>
          <p className="text-xs text-muted-foreground font-bold opacity-60 tracking-widest mt-0.5">MANAGE META APPROVED ASSETS</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[11px] uppercase tracking-wider h-10 px-6 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />New Template Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-y-auto bg-[#0a0a0c] border-border p-0 gap-0 shadow-2xl" data-testid="template-dialog">
            <div className="flex flex-col h-full">
              {/* Fake Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/10">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowCreate(false)}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <h2 className="text-sm font-black uppercase tracking-tight">New Template Message</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground mr-4">WCC Credits: ₹ 500.00</span>
                  <Button variant="ghost" className="h-8 text-[11px] font-bold" onClick={resetForm}>Clear Form</Button>
                  <Button className="h-9 bg-[#0b5c53] hover:bg-[#084a43] font-black text-[11px] uppercase px-8" onClick={handleCreate}>Submit Approval</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1">
                {/* Form Section */}
                <div className="lg:col-span-8 p-8 space-y-8 overflow-y-auto max-h-[calc(90vh-70px)] scrollbar-thin">

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Template Category</Label>
                      <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-secondary/20 border-border h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="MARKETING">MARKETING</SelectItem>
                          <SelectItem value="UTILITY">UTILITY</SelectItem>
                          <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground italic">Your template should fall under one of these categories.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Template Language</Label>
                      <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v }))}>
                        <SelectTrigger className="bg-secondary/20 border-border h-11"><SelectValue placeholder="Select message language" /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {LANGUAGES.map(l => (
                            <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground italic">You will need to specify the language in which message template is submitted.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Template Name</Label>
                    <Input
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                      placeholder="Enter name"
                      className="bg-secondary/20 border-border h-11 font-mono uppercase text-xs tracking-tighter"
                    />
                    <p className="text-[10px] text-muted-foreground italic">Name can only be in lowercase alphanumeric characters and underscores. Special characters and white-space are not allowed.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Template Type</Label>
                    <Select value={form.headerType} onValueChange={v => setForm(p => ({ ...p, headerType: v }))}>
                      <SelectTrigger className="bg-secondary/20 border-border h-11"><SelectValue placeholder="Select message type" /></SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="NONE">Text Only (Standard)</SelectItem>
                        <SelectItem value="IMAGE">Image Media</SelectItem>
                        <SelectItem value="VIDEO">Video Media</SelectItem>
                        <SelectItem value="DOCUMENT">Document Media</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground italic">Your template type should fall under one of these categories.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Template Format</Label>
                      <span className="text-[10px] font-mono opacity-40">{form.body.length} / 1024</span>
                    </div>
                    <Textarea
                      value={form.body}
                      onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                      placeholder="Enter your message in here..."
                      className="bg-secondary/20 border-border min-h-[140px] text-sm leading-relaxed"
                      maxLength={1024}
                    />
                    <p className="text-[10px] text-muted-foreground italic">Use text formatting - *bold*, _italic_, & ~strikethrough~. Max 1024 characters. e.g. - Hello {"{{1}}"}, your code will expire in {"{{2}}"} mins.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Template Footer (Optional)</Label>
                      <span className="text-[10px] font-mono opacity-40">{form.footer.length} / 60</span>
                    </div>
                    <Input
                      value={form.footer}
                      onChange={e => setForm(p => ({ ...p, footer: e.target.value }))}
                      placeholder="Enter footer text here"
                      className="bg-secondary/20 border-border h-11 text-xs"
                      maxLength={60}
                    />
                    <p className="text-[10px] text-muted-foreground italic">Your message content. Upto 60 characters are allowed.</p>
                  </div>

                  {/* Interactive Actions Section */}
                  <div className="space-y-6 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Interactive Actions</Label>
                      <p className="text-[10px] text-muted-foreground italic mb-4">In addition to your message, you can send actions with your message. Maximum 25 characters are allowed in CTA button title & Quick Replies.</p>
                      <RadioGroup
                        value={form.actionType || "NONE"}
                        onValueChange={(v) => {
                          setForm(p => ({ ...p, actionType: v, buttons: v === 'NONE' ? [] : p.buttons }));
                        }}
                        className="flex items-center gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="NONE" id="r-none" />
                          <Label htmlFor="r-none" className="text-xs font-bold cursor-pointer">None</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="CALL_TO_ACTIONS" id="r-cta" />
                          <Label htmlFor="r-cta" className="text-xs font-bold cursor-pointer">Call to Actions</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="QUICK_REPLIES" id="r-qr" />
                          <Label htmlFor="r-qr" className="text-xs font-bold cursor-pointer">Quick Replies</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ALL" id="r-all" />
                          <Label htmlFor="r-all" className="text-xs font-bold cursor-pointer">All</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Button variant="outline" size="sm" className="bg-secondary/10 border-border text-[10px] font-bold h-9 flex items-center justify-between px-3" onClick={() => addButton("QUICK_REPLY")}>
                        <div className="flex items-center"><Plus className="w-3 h-3 mr-1" /> Quick Replies</div>
                        <span className="text-[8px] bg-secondary/30 px-1.5 py-0.5 rounded ml-2">10</span>
                      </Button>
                      <Button variant="outline" size="sm" className="bg-secondary/10 border-border text-[10px] font-bold h-9 flex items-center justify-between px-3" onClick={() => addButton("URL")}>
                        <div className="flex items-center"><Plus className="w-3 h-3 mr-1" /> URL</div>
                        <span className="text-[8px] bg-secondary/30 px-1.5 py-0.5 rounded ml-2">2</span>
                      </Button>
                      <Button variant="outline" size="sm" className="bg-secondary/10 border-border text-[10px] font-bold h-9 flex items-center justify-between px-3" onClick={() => addButton("PHONE_NUMBER")}>
                        <div className="flex items-center"><Plus className="w-3 h-3 mr-1" /> Phone Number</div>
                        <span className="text-[8px] bg-secondary/30 px-1.5 py-0.5 rounded ml-2">1</span>
                      </Button>
                      <Button variant="outline" size="sm" className="bg-secondary/10 border-border text-[10px] font-bold h-9 flex items-center justify-between px-3" onClick={() => addButton("COPY_CODE")}>
                        <div className="flex items-center"><Plus className="w-3 h-3 mr-1" /> Copy Code</div>
                        <span className="text-[8px] bg-secondary/30 px-1.5 py-0.5 rounded ml-2">1</span>
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {form.buttons.map((btn, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-secondary/10 border border-border rounded-xl animate-in fade-in slide-in-from-left-2 duration-300">
                          <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/20 shrink-0">
                            {btn.type.replace('_', ' ')}
                          </Badge>
                          <Input
                            value={btn.text}
                            onChange={e => updateButton(idx, 'text', e.target.value)}
                            placeholder="Button Label"
                            className="bg-background border-border h-8 text-xs font-bold"
                          />
                          <Input
                            value={btn.value}
                            onChange={e => updateButton(idx, 'value', e.target.value)}
                            placeholder={btn.type === 'URL' ? 'https://...' : (btn.type === 'PHONE_NUMBER' ? '+1...' : 'Value')}
                            className="bg-background border-border h-8 text-xs flex-1"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeButton(idx)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-[#0d1117] p-8 border-l border-border flex flex-col items-center sticky top-0 h-[calc(90vh)]">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-8 self-start">Template Preview</h3>
                  <p className="text-[9px] text-muted-foreground/40 mb-8 self-start">Your template message preview. It will update as you fill in the values in the form.</p>

                  {/* WhatsApp Device Mockup */}
                  <div className="w-[300px] bg-[#0b141a] rounded-[32px] overflow-hidden border-[6px] border-[#222c32] shadow-[0_0_60px_rgba(0,0,0,0.5)]">
                    <div className="p-4 space-y-4">
                      <div className="bg-[#202c33] rounded-[18px] rounded-tl-none p-3 shadow-lg relative max-w-[95%] border-t border-r border-[#ffffff0a]">

                        {/* Media Header Preview */}
                        {form.headerType !== "NONE" && (
                          <div className="mb-2 rounded-lg bg-[#2a3942] min-h-[140px] flex flex-col items-center justify-center border border-[#ffffff0a] overflow-hidden">
                            <div className="flex flex-col items-center gap-3">
                              <div className="flex gap-4 opacity-50">
                                <Image size={32} className={form.headerType === 'IMAGE' ? 'text-amber-400' : 'text-white/20'} />
                                <Video size={32} className={form.headerType === 'VIDEO' ? 'text-blue-400' : 'text-white/20'} />
                                <File size={32} className={form.headerType === 'DOCUMENT' ? 'text-red-400' : 'text-white/20'} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Body Text Preview */}
                        <p className="text-[11px] text-[#e9edef] whitespace-pre-wrap leading-relaxed">
                          {form.body || "Your message body content will appear here..."}
                        </p>

                        {/* Footer Preview */}
                        {form.footer && (
                          <p className="text-[10px] text-[#8696a0] mt-2 italic">{form.footer}</p>
                        )}

                        <div className="absolute bottom-1 right-2 flex items-center gap-1 opacity-50">
                          <span className="text-[8px] text-[#8696a0]">10:14 AM</span>
                        </div>
                      </div>

                      {/* Buttons Preview */}
                      <div className="space-y-1.5 px-2">
                        {form.buttons.map((btn, idx) => (
                          <div key={idx} className="bg-[#202c33] hover:bg-[#2a3942] transition-colors rounded-xl p-2.5 flex items-center justify-center gap-2 border-t border-[#ffffff05] cursor-default group shadow-sm">
                            {btn.type === 'URL' && <Globe size={12} className="text-[#00a884]" />}
                            {btn.type === 'PHONE_NUMBER' && <Phone size={12} className="text-[#00a884]" />}
                            {btn.type === 'COPY_CODE' && <Copy size={12} className="text-[#00a884]" />}
                            {btn.type === 'QUICK_REPLY' && <MousePointer2 size={12} className="text-[#00a884]" />}
                            <span className="text-[11px] font-bold text-[#00a884]">{btn.text || "Button Label"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[9px] text-muted-foreground/40 mt-8 text-center max-w-[240px] leading-relaxed">
                    Disclaimer: This is just a graphical representation of the message that will be delivered. Actual message will consist of media selected and may appear different.
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-secondary/10 rounded-3xl animate-pulse border border-border" />)}
          </div>
        ) : templates.length === 0 ? (
          <Card className="bg-card/20 border-dashed border-border py-32 text-center rounded-[40px]">
            <FileText className="w-16 h-16 mx-auto mb-6 text-muted-foreground/20" />
            <p className="text-muted-foreground font-black uppercase tracking-widest text-[11px]">Identity Vault Empty</p>
            <Button variant="link" className="text-primary font-bold mt-2" onClick={() => setShowCreate(true)}>Register Your First Template</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(t => {
              if (!t) return null;
              const status = STATUS_MAP[t.status] || STATUS_MAP.draft;
              const Icon = status.icon;
              const comps = Array.isArray(t.components) ? t.components : [];
              const bodyComp = comps.find(c => c.type === "BODY") || {};
              const headerComp = comps.find(c => c.type === "HEADER");
              const footerComp = comps.find(c => c.type === "FOOTER");
              const buttonComp = comps.find(c => c.type === "BUTTONS");

              return (
                <Card key={t.id} className="bg-card/40 border-border hover:border-primary/50 transition-all group overflow-hidden flex flex-col rounded-3xl shadow-xl">
                  <div className="p-6 flex flex-col gap-4 flex-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[9px] font-black tracking-widest bg-secondary/80 border-0 uppercase">{t.category}</Badge>
                      <Badge className={`text-[10px] font-bold flex items-center gap-1.5 border-0 px-3 py-1 rounded-full ${status.bg} ${status.color}`}>
                        <Icon className="w-3 h-3" /> {(t.status || 'draft').toUpperCase()}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-black text-sm truncate uppercase tracking-tight">{t.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-bold font-mono opacity-60">LANG: {t.language}</p>
                    </div>

                    <div className="bg-[#0b141a] rounded-2xl p-4 opacity-90 group-hover:opacity-100 transition-opacity border border-white/[0.03] shadow-inner">
                      {headerComp && headerComp.format === "TEXT" && <p className="text-[10px] font-black text-white mb-1.5 border-b border-white/5 pb-1">{headerComp.text}</p>}
                      <p className="text-[11px] text-[#e9edef] line-clamp-4 leading-relaxed font-medium">{bodyComp.text || "No body content"}</p>
                      {footerComp && <p className="text-[9px] text-[#8696a0] mt-2 italic font-medium opacity-60">{footerComp.text}</p>}

                      {buttonComp && buttonComp.buttons && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 overflow-x-auto scrollbar-none">
                          {buttonComp.buttons.map((b, i) => (
                            <Badge key={i} variant="outline" className="text-[8px] font-black h-5 whitespace-nowrap bg-white/[0.02] border-white/10 text-[#00a884] uppercase">
                              {b.type === 'URL' && <Globe className="w-2.5 h-2.5 mr-1" />}
                              {b.text}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-secondary/10 border-t border-border flex items-center justify-between">
                    <div className="flex gap-2">
                      {t.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase tracking-widest border-border bg-background hover:bg-primary/5 hover:text-primary transition-all px-4" onClick={() => handleSubmitStatus(t.id)}>
                          <Send className="w-3.5 h-3.5 mr-1.5" /> Launch
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground/30">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
