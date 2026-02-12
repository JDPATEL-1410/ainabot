import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import {
  Search, Plus, Upload, Tag, Trash2, Edit, Users, Download, Filter,
  ChevronDown, X, CheckCircle2, UserPlus, SlidersHorizontal
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tags: "" });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Available filter options (could be fetched from API in real app)
  const [availableTags, setAvailableTags] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (tagFilter !== "all") params.tag = tagFilter;
      if (sourceFilter !== "all") params.source = sourceFilter;

      const { data } = await api.get("/contacts", { params });
      setContacts(data.contacts);
      setTotal(data.total || 0);

      // Collect unique tags and sources for filters
      const tags = new Set();
      const sources = new Set();
      data.contacts.forEach(c => {
        if (c.tags) c.tags.forEach(t => tags.add(t));
        if (c.source) sources.add(c.source);
      });
      if (availableTags.length === 0) setAvailableTags(Array.from(tags));
      if (availableSources.length === 0) setAvailableSources(Array.from(sources));
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [search, tagFilter, sourceFilter]); // eslint-disable-line

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      if (editId) {
        await api.patch(`/contacts/${editId}`, { name: form.name, email: form.email, tags });
        toast.success("Contact updated");
      } else {
        await api.post("/contacts", { name: form.name, phone: form.phone, email: form.email, tags });
        toast.success("Contact created");
      }
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", tags: "" });
      setEditId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/contacts/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} contacts?`)) return;
    try {
      await api.post("/contacts/bulk-delete", { ids: selectedIds });
      toast.success(`${selectedIds.length} contacts deleted`);
      setSelectedIds([]);
      load();
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  const handleBulkTag = async (tagName) => {
    try {
      await api.post("/contacts/bulk-tag", { ids: selectedIds, tags: [tagName], action: "add" });
      toast.success(`Tag "${tagName}" added to ${selectedIds.length} contacts`);
      setSelectedIds([]);
      load();
    } catch {
      toast.error("Bulk tag failed");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email || "", tags: (c.tags || []).join(", ") });
    setShowAdd(true);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/contacts/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`Imported ${data.imported}, skipped ${data.skipped}`);
      load();
    } catch {
      toast.error("Import failed");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get("/contacts/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "contacts_export.csv";
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Contacts exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="contacts-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-outfit text-2xl font-black tracking-tight text-foreground">Contacts</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5 uppercase tracking-widest">{total} Identities Registered</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border bg-secondary/20 hover:bg-secondary text-[11px] font-bold h-9" onClick={handleExport} disabled={exporting} data-testid="export-contacts-btn">
            <Download className="w-3.5 h-3.5 mr-2" />{exporting ? "Wait..." : "Export"}
          </Button>
          <label>
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} data-testid="import-csv-input" />
            <Button variant="outline" size="sm" className="border-border bg-secondary/20 hover:bg-secondary text-[11px] font-bold h-9 cursor-pointer">
              <Upload className="w-3.5 h-3.5 mr-2" />Import
            </Button>
          </label>
          <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) { setEditId(null); setForm({ name: "", phone: "", email: "", tags: "" }); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[11px] uppercase tracking-wider h-9 shadow-lg shadow-primary/20" data-testid="add-contact-btn">
                <Plus className="w-4 h-4 mr-1.5" />Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#121215] border-[#27272a] shadow-2xl" data-testid="contact-dialog">
              <DialogHeader>
                <DialogTitle className="font-outfit text-xl font-black uppercase tracking-tight">
                  {editId ? "Update Identity" : "New Contact"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Full Name</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" data-testid="contact-name-input" className="bg-secondary/30 border-border h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Phone Identity</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1..." disabled={!!editId} data-testid="contact-phone-input" className="bg-secondary/30 border-border h-11 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Email Address (Optional)</Label>
                  <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="name@domain.com" data-testid="contact-email-input" className="bg-secondary/30 border-border h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Segment Tags</Label>
                  <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="comma, separated" data-testid="contact-tags-input" className="bg-secondary/30 border-border h-11" />
                </div>
                <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 uppercase tracking-widest" data-testid="save-contact-btn">
                  {editId ? "Update Records" : "Commit Record"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Bulk Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/40 p-3 rounded-2xl border border-border">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative group w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Filter by name, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background border-border h-10 rounded-xl focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`h-10 rounded-xl border-border ${tagFilter !== "all" ? "bg-primary/10 text-primary border-primary/20" : "bg-background"}`}>
                <Filter className="w-3.5 h-3.5 mr-2" />
                {tagFilter === "all" ? "All Tags" : tagFilter}
                <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-popover border-border">
              <DropdownMenuItem onClick={() => setTagFilter("all")} className="font-bold text-xs">All Segments</DropdownMenuItem>
              <DropdownMenuSeparator />
              {availableTags.map(t => (
                <DropdownMenuItem key={t} onClick={() => setTagFilter(t)} className="text-xs">{t}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`h-10 rounded-xl border-border ${sourceFilter !== "all" ? "bg-primary/10 text-primary border-primary/20" : "bg-background"}`}>
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2" />
                {sourceFilter === "all" ? "All Sources" : sourceFilter}
                <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-popover border-border">
              <DropdownMenuItem onClick={() => setSourceFilter("all")} className="font-bold text-xs">Every Acquisition</DropdownMenuItem>
              <DropdownMenuSeparator />
              {availableSources.map(s => (
                <DropdownMenuItem key={s} onClick={() => setSourceFilter(s)} className="text-xs uppercase">{s}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {(tagFilter !== "all" || sourceFilter !== "all" || search) && (
            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => { setSearch(""); setTagFilter("all"); setSourceFilter("all"); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Bulk Actions (Conditional) */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in slide-in-from-right duration-300">
            <Badge variant="secondary" className="px-3 py-1 h-8 rounded-full bg-primary/20 text-primary border-0 font-black text-[10px]">
              {selectedIds.length} Selected
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9 rounded-xl border-border bg-background text-[11px] font-bold">
                  <Tag className="w-3.5 h-3.5 mr-2" /> Bulk Tag
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border w-40">
                <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest opacity-50">Quick Segment</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleBulkTag("lead")} className="text-xs">Mark as Lead</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkTag("customer")} className="text-xs">Mark as Customer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkTag("vip")} className="text-xs">Mark as VIP</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="destructive" className="h-9 rounded-xl text-[11px] font-bold px-4" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </Button>

            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setSelectedIds([])}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Table Section */}
      <Card className="bg-[#121215]/40 border-border backdrop-blur-sm overflow-hidden rounded-3xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-secondary/10 h-14">
                <TableHead className="w-12 pl-6">
                  <Checkbox
                    checked={selectedIds.length === contacts.length && contacts.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-50">Contact Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-50">Identity (Phone)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-50">Email Record</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-50">Segment Tags</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-50">Acquisition</TableHead>
                <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest opacity-50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">Syncing records...</span>
                  </div>
                </TableCell></TableRow>
              ) : contacts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-24">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/10" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-[11px]">No Identities Found</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1 max-w-[200px] mx-auto leading-relaxed">Expand your filter parameters or register a new contact to see them here.</p>
                </TableCell></TableRow>
              ) : contacts.map(c => (
                <TableRow key={c.id} className={`border-border transition-colors group h-16 ${selectedIds.includes(c.id) ? "bg-primary/5" : "hover:bg-secondary/20"}`} data-testid={`contact-row-${c.id}`}>
                  <TableCell className="pl-6">
                    <Checkbox
                      checked={selectedIds.includes(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                      className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Member since {new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] font-bold text-primary/70">{c.phone}</TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {(c.tags || []).map(t => (
                        <Badge key={t} variant="outline" className="text-[9px] font-black py-0.5 px-2 bg-primary/5 text-primary border-primary/20 rounded-md">#{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[9px] uppercase tracking-[0.1em] font-black h-5 bg-background border border-border text-muted-foreground px-2">{c.source}</Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => startEdit(c)} data-testid={`edit-contact-${c.id}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(c.id)} data-testid={`delete-contact-${c.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selection Stats Footer */}
      {contacts.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
            Displaying {contacts.length} of {total} total records
          </p>
        </div>
      )}
    </div>
  );
}
