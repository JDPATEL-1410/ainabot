import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Search, Send, Paperclip, User, Phone, Mail, Tag, X, Check, CheckCheck,
  Clock, MoreVertical, MessageSquare, StickyNote, Zap, ChevronDown,
  FileIcon, ImageIcon, VideoIcon, FileText, Bold, Italic, Strikethrough,
  Smile, BookMarked, Maximize2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "../components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger
} from "../components/ui/popover";
import { toast } from "sonner";

export default function InboxPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contact, setContact] = useState(null);
  const [notes, setNotes] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [newNote, setNewNote] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [infoTab, setInfoTab] = useState("details");
  const msgEndRef = useRef(null);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const params = {};
      if (filter === "mine") params.assigned = "me";
      if (filter === "unassigned") params.assigned = "unassigned";
      if (filter === "open") params.status = "open";
      if (filter === "closed") params.status = "closed";
      if (search) params.search = search;
      const { data } = await api.get("/conversations", { params });
      setConversations(data.conversations || []);
    } catch {
      // silent on poll
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    loadConversations();
    // Load tools
    api.get("/quick-replies").then(r => setQuickReplies(r.data.quick_replies || [])).catch(() => { });
    api.get("/templates?status=approved").then(r => setTemplates(r.data.templates || [])).catch(() => { });
  }, [loadConversations]);

  // Auto-refresh polling every 5s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadConversations();
      if (selectedConv) {
        api.get(`/conversations/${selectedConv.id}/messages`).then(r => {
          setMessages(r.data.messages || []);
        }).catch(() => { });
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadConversations, selectedConv]);

  // Auto-select conversation from URL
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && conversations.length > 0 && (!selectedConv || selectedConv.id !== id)) {
      const conv = conversations.find(c => c.id === id);
      if (conv) selectConversation(conv);
    }
  }, [searchParams, conversations]); // eslint-disable-line

  const selectConversation = async (conv) => {
    setSelectedConv(conv);
    setSearchParams({ id: conv.id });
    try {
      const [msgRes, convRes, notesRes] = await Promise.all([
        api.get(`/conversations/${conv.id}/messages`),
        api.get(`/conversations/${conv.id}`),
        api.get(`/conversations/${conv.id}/notes`)
      ]);
      setMessages(msgRes.data.messages || []);
      setContact(convRes.data.contact);
      setNotes(notesRes.data.notes || []);
    } catch {
      toast.error("Failed to load messages");
    }
  };

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMsg.trim() || !selectedConv) return;
    setSending(true);
    try {
      const { data } = await api.post(`/conversations/${selectedConv.id}/messages`, {
        body: newMsg.trim(), type: "text"
      });
      setMessages(prev => [...prev, data.message]);
      setNewMsg("");
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const getTemplateBody = (template) => {
    if (!template || !template.components) return "Template content";
    if (Array.isArray(template.components)) {
      return template.components.find(c => c.type === "BODY")?.text || "";
    }
    return template.components.body?.text || "";
  };

  const sendTemplate = async (template) => {
    if (!selectedConv) return;
    setSending(true);
    try {
      const body = getTemplateBody(template);
      const { data } = await api.post(`/conversations/${selectedConv.id}/messages`, {
        body,
        type: "template",
        template_id: template.id
      });
      setMessages(prev => [...prev, data.message]);
      setShowTemplates(false);
      loadConversations();
      toast.success("Template sent");
    } catch (err) {
      toast.error("Failed to send template");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedConv) return;

    const formData = new FormData();
    formData.append("file", file);

    const loadingToast = toast.loading("Uploading media...");
    try {
      const { data } = await api.post(`/conversations/${selectedConv.id}/media`, formData);
      const msgRes = await api.post(`/conversations/${selectedConv.id}/messages`, {
        body: `Sent a ${data.type}`,
        type: data.type === "image" ? "image" : (data.type === "video" ? "video" : "document"),
        media_url: data.url
      });
      setMessages(prev => [...prev, msgRes.data.message]);
      toast.dismiss(loadingToast);
      toast.success("Media sent");
      loadConversations();
    } catch {
      toast.dismiss(loadingToast);
      toast.error("Failed to upload media");
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMsg(val);
    if (val.endsWith("/")) {
      setShowQuickReplies(true);
      setShowTemplates(false);
    } else if (showQuickReplies && !val.includes("/")) {
      setShowQuickReplies(false);
    }
  };

  const insertText = (before, after = "") => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const result = text.substring(0, start) + before + selectedText + after + text.substring(end);
    setNewMsg(result);
    // Refocus and set cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const addEmoji = (emoji) => {
    insertText(emoji);
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedConv) return;
    try {
      const { data } = await api.post(`/conversations/${selectedConv.id}/notes`, { text: newNote.trim() });
      setNotes(prev => [data.note, ...prev]);
      setNewNote("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  };

  const applyQuickReply = (reply) => {
    // If it was triggered by /, remove the /
    if (newMsg.endsWith("/")) {
      setNewMsg(reply.message);
    } else {
      setNewMsg(reply.message);
    }
    setShowQuickReplies(false);
  };

  const closeConv = async () => {
    if (!selectedConv) return;
    try {
      await api.post(`/conversations/${selectedConv.id}/close`);
      toast.success("Conversation closed");
      loadConversations();
      setSelectedConv(prev => ({ ...prev, status: "closed" }));
    } catch {
      toast.error("Failed to close");
    }
  };

  const openConv = async () => {
    if (!selectedConv) return;
    try {
      await api.post(`/conversations/${selectedConv.id}/open`);
      toast.success("Conversation opened");
      loadConversations();
      setSelectedConv(prev => ({ ...prev, status: "open" }));
    } catch {
      toast.error("Failed to open");
    }
  };

  const filters = [
    { key: "all", label: "All" },
    { key: "mine", label: "My Chats" },
    { key: "unassigned", label: "Unassigned" },
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case "sent": return <Check className="w-3 h-3 text-muted-foreground" />;
      case "delivered": return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      case "read": return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case "failed": return <X className="w-3 h-3 text-destructive" />;
      default: return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      if (isNaN(d.getTime())) return "";
      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch { return ""; }
  };

  const commonEmojis = ["😊", "👍", "👋", "❤️", "😂", "✅", "🔥", "🙏", "🚀", "✨"];

  return (
    <div className="flex h-[calc(100vh)] overflow-hidden bg-background" data-testid="inbox-page">
      {/* Conversation List */}
      <div className="w-80 border-r border-border flex flex-col bg-[#0a0a0c]" data-testid="conversation-list-panel">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 bg-secondary/30 border-border text-sm"
              data-testid="inbox-search-input"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {filters.map(f => (
              <Button
                key={f.key}
                variant={filter === f.key ? "default" : "ghost"}
                size="sm"
                className={`text-xs shrink-0 h-7 rounded-full px-4 ${filter === f.key ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground"}`}
                onClick={() => setFilter(f.key)}
                data-testid={`filter-${f.key}`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary/20 rounded animate-pulse" />)}
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No conversations
            </div>
          ) : (
            conversations.map(c => (
              <div
                key={c.id}
                onClick={() => selectConversation(c)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-border/50 transition-colors
                  ${selectedConv?.id === c.id ? "bg-secondary/50" : "hover:bg-secondary/20"}`}
                data-testid={`conv-item-${c.id}`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold shrink-0">
                    {c.contact_name?.charAt(0) || "?"}
                  </div>
                  {c.status === "open" && c.unread_count > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-[#0a0a0c]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${c.unread_count > 0 ? "font-semibold" : "font-medium"}`}>{c.contact_name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate ${c.unread_count > 0 ? "text-foreground" : "text-muted-foreground"}`}>{c.last_message}</p>
                    {c.unread_count > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full ml-2 shrink-0">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background" data-testid="chat-area">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm font-medium">Select a conversation to start messaging</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Messages sync in real-time</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                  {selectedConv.contact_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight" data-testid="chat-contact-name">{selectedConv.contact_name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{selectedConv.contact_phone} • <span className="text-green-500">online</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedConv.status === "open" ? "default" : "secondary"}
                  className={`text-[10px] h-5 uppercase font-bold tracking-tighter ${selectedConv.status === "open" ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}`}>
                  {selectedConv.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-secondary/80" data-testid="chat-actions-btn">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border min-w-[160px]">
                    {selectedConv.status === "open" ? (
                      <DropdownMenuItem onClick={closeConv} className="text-xs" data-testid="close-conv-btn">Close conversation</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={openConv} className="text-xs" data-testid="open-conv-btn">Reopen conversation</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setInfoTab("notes")} className="text-xs" data-testid="view-notes-btn">
                      <StickyNote className="w-3.5 h-3.5 mr-2" />View Notes
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6 max-w-4xl mx-auto">
                <div className="flex justify-center mb-4">
                  <Badge variant="outline" className="text-[9px] bg-secondary/10 border-border text-muted-foreground py-0.5 px-3 rounded-full font-bold">TODAY</Badge>
                </div>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    data-testid={`msg-${msg.id}`}
                  >
                    <div className={`max-w-[80%] flex flex-col ${msg.direction === "out" ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm relative group
                          ${msg.direction === "out"
                          ? "bg-[#075e54] text-white rounded-[20px] rounded-tr-none"
                          : "bg-[#202c33] text-[#e9edef] rounded-[20px] rounded-tl-none"
                        }`}>
                        {msg.media_url && (
                          <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-xl bg-black/5">
                            {msg.type === "image" ? (
                              <img src={msg.media_url} alt="Media" className="max-w-full h-auto cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => window.open(msg.media_url, '_blank')} />
                            ) : msg.type === "video" ? (
                              <video src={msg.media_url} controls className="max-w-full h-auto" />
                            ) : (
                              <div className="p-4 bg-black/20 flex items-center justify-between gap-3 min-w-[200px]">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold truncate max-w-[120px]">Document</p>
                                    <p className="text-[9px] opacity-60 uppercase font-bold tracking-widest">PDF - 2.4 MB</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => window.open(msg.media_url, '_blank')}>
                                  <Send className="w-4 h-4 rotate-90" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {msg.type === "template" && (
                          <div className="mb-2 p-2 bg-black/10 rounded-lg border-l-2 border-primary">
                            <p className="text-[10px] uppercase font-black tracking-widest text-primary/80 mb-1">Approved Template</p>
                            <p className="text-[11px] leading-relaxed opacity-90">{msg.body}</p>
                          </div>
                        )}
                        {msg.type !== "template" && <p className="whitespace-pre-wrap">{msg.body}</p>}
                        <div className={`flex items-center gap-1.5 mt-1 opacity-60 text-[9px] font-black tracking-tighter ${msg.direction === "out" ? "justify-end" : ""}`}>
                          {formatTime(msg.created_at)}
                          {msg.direction === "out" && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={msgEndRef} />
              </div>
            </ScrollArea>

            {/* Controls / Input Area */}
            <div className="p-4 border-t border-border bg-background" data-testid="message-input-area">
              <div className="max-w-4xl mx-auto bg-card rounded-[24px] border border-border shadow-2xl overflow-hidden">
                {/* Popups inside same container */}
                {showQuickReplies && (
                  <div className="border-b border-border p-3 bg-secondary/10 slide-in-from-bottom duration-200" data-testid="quick-replies-panel">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Canned Replies</p>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/5" onClick={() => setShowQuickReplies(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                      {quickReplies.map(qr => (
                        <button key={qr.id} onClick={() => applyQuickReply(qr)} className="text-left px-3 py-1.5 rounded-full border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-[11px] font-bold">
                          /{qr.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showTemplates && (
                  <div className="border-b border-border p-3 bg-secondary/10 slide-in-from-bottom duration-200" data-testid="templates-panel">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Business Templates</p>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/5" onClick={() => setShowTemplates(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {templates.map(t => (
                        <button key={t.id} onClick={() => sendTemplate(t)} className="text-left p-3 rounded-xl border border-border bg-background hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[8px] h-4 border-amber-500/20 text-amber-500 font-black">{t.category}</Badge>
                            <Send className="w-3 h-3 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="font-bold text-xs truncate">{t.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Input area */}
                <div className="p-2 space-y-2">
                  <div className="flex items-start gap-2 relative">
                    <Textarea
                      ref={inputRef}
                      placeholder='Type "/" for canned messages'
                      value={newMsg}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm min-h-[50px] max-h-[150px] resize-none py-2 px-3 placeholder:text-muted-foreground/50"
                      data-testid="message-input"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/30 absolute top-1 right-1 hover:text-foreground">
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between px-2 pb-1">
                    <div className="flex items-center gap-1">
                      {/* Formatting */}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground" onClick={() => insertText("*", "*")}>
                        <Bold className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground" onClick={() => insertText("_", "_")}>
                        <Italic className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground" onClick={() => insertText("~", "~")}>
                        <Strikethrough className="w-4 h-4" />
                      </Button>

                      <div className="w-[1px] h-4 bg-border mx-1" />

                      {/* Emoji Popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground">
                            <Smile className="w-5 h-5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 bg-[#121215] border-border shadow-2xl rounded-2xl" side="top">
                          <div className="grid grid-cols-5 gap-1">
                            {commonEmojis.map(e => (
                              <button key={e} onClick={() => addEmoji(e)} className="w-8 h-8 text-lg hover:bg-white/10 rounded-lg transition-colors">{e}</button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Attachments */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground">
                            <Paperclip className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-[#121215] border-border p-1">
                          <DropdownMenuItem className="text-xs font-bold gap-3 py-2 cursor-pointer" onClick={() => fileInputRef.current.click()}>
                            <ImageIcon className="w-4 h-4 text-blue-400" /> Image
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs font-bold gap-3 py-2 cursor-pointer" onClick={() => fileInputRef.current.click()}>
                            <VideoIcon className="w-4 h-4 text-primary" /> Video
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs font-bold gap-3 py-2 cursor-pointer" onClick={() => fileInputRef.current.click()}>
                            <FileText className="w-4 h-4 text-amber-500" /> Document
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="w-[1px] h-4 bg-border mx-1" />

                      {/* Tools */}
                      <Button variant="ghost" size="icon"
                        className={`h-8 w-8 transition-colors ${showTemplates ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground/60 hover:text-amber-500 hover:bg-amber-500/10"}`}
                        onClick={() => { setShowTemplates(!showTemplates); setShowQuickReplies(false); }}>
                        <BookMarked className="w-5 h-5" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        className={`h-8 w-8 transition-colors ${showQuickReplies ? "text-primary bg-primary/10" : "text-muted-foreground/60 hover:text-primary hover:bg-primary/10"}`}
                        onClick={() => { setShowQuickReplies(!showQuickReplies); setShowTemplates(false); }}>
                        <Zap className="w-5 h-5" />
                      </Button>
                    </div>

                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

                    <Button
                      onClick={sendMessage}
                      disabled={sending || !newMsg.trim()}
                      className="bg-[#0b5c53] hover:bg-[#084a43] text-white rounded-xl px-5 py-2 font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg h-9">
                      Send <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact Info Panel */}
      {selectedConv && contact && (
        <div className="w-72 border-l border-border bg-[#0a0a0c] hidden xl:flex flex-col" data-testid="contact-info-panel">
          <ScrollArea className="flex-1">
            <div className="p-6 text-center border-b border-border/50">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-3xl font-black mx-auto mb-4 relative overflow-hidden group">
                {contact.name?.charAt(0)}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <User size={30} />
                </div>
              </div>
              <p className="font-black text-base tracking-tight">{contact.name}</p>
              <p className="text-[11px] text-muted-foreground font-bold font-mono mt-1 opacity-60 uppercase">{contact.phone}</p>
            </div>

            <Tabs value={infoTab} onValueChange={setInfoTab} className="flex-1 flex flex-col">
              <TabsList className="bg-secondary/10 border-b border-border/50 rounded-none h-11 px-2 gap-4">
                <TabsTrigger value="details" className="text-[10px] uppercase tracking-widest h-8 px-4 font-black data-[state=active]:bg-background">Details</TabsTrigger>
                <TabsTrigger value="notes" className="text-[10px] uppercase tracking-widest h-8 px-4 font-black data-[state=active]:bg-background">
                  Notes {notes.length > 0 && <Badge className="ml-1.5 h-4 min-w-4 text-[9px] bg-primary text-primary-foreground border-0 px-1 font-black">{notes.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="p-4 space-y-6 mt-0">
                <div className="space-y-4">
                  {contact.email && (
                    <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Email Address</p>
                      <p className="text-xs font-bold truncate">{contact.email}</p>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Phone Reference</p>
                    <p className="text-xs font-bold font-mono">{contact.phone}</p>
                  </div>
                  {contact.tags?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Segments</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map(t => (
                          <Badge key={t} variant="outline" className="text-[9px] font-black border-primary/20 bg-primary/5 text-primary rounded-md uppercase px-2 py-0.5">#{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border/50 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-3 h-3" /> Last Interaction</span>
                    <span className="text-foreground">{formatTime(contact.last_seen || contact.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-muted-foreground flex items-center gap-2"><Tag className="w-3 h-3" /> Acquisition</span>
                    <Badge variant="secondary" className="text-[8px] h-4 bg-background border border-border text-muted-foreground font-black px-1.5">{contact.source?.toUpperCase() || "DIRECT"}</Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="flex-1 flex flex-col mt-0">
                <div className="p-4 space-y-3 bg-secondary/10">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Log internal conversation context..."
                    className="bg-background border-border text-xs min-h-[90px] rounded-xl focus:border-primary/50 text-[11px]"
                  />
                  <Button size="sm" className="w-full h-8 text-[11px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90" onClick={addNote} disabled={!newNote.trim()}>
                    Save Log
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  {(!notes || notes.length === 0) ? (
                    <div className="text-center py-12 opacity-20">
                      <StickyNote className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-[9px] uppercase font-black tracking-widest">No Log Entries</p>
                    </div>
                  ) : notes.map(n => (
                    <div key={n.id} className="bg-secondary/10 p-3 rounded-2xl border border-border group relative">
                      <p className="text-xs leading-relaxed text-foreground/90 font-medium">{n.text}</p>
                      <div className="flex items-center justify-between mt-3 opacity-60">
                        <span className="text-[9px] font-black uppercase text-primary">{n.user_name}</span>
                        <span className="text-[9px] font-mono">{formatTime(n.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
