import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, UserCog, Shield, Mail, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

const ROLE_COLORS = {
  owner: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  admin: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  agent: "bg-green-400/10 text-green-400 border-green-400/20",
  viewer: "bg-secondary text-muted-foreground",
};

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/workspace/members");
      setMembers(data.members);
    } catch {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Email required"); return; }
    try {
      await api.post("/workspace/invite", { email: inviteEmail, role: inviteRole });
      toast.success("Invitation sent to " + inviteEmail);
      setShowInvite(false);
      setInviteEmail("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to invite member");
    }
  };

  const updateRole = async (memberId, role) => {
    try {
      await api.patch(`/workspace/members/${memberId}`, { role });
      toast.success("Role updated successfully");
      load();
    } catch {
      toast.error("Failed to update role");
    }
  };

  const removeMember = async (memberId) => {
    try {
      await api.delete(`/workspace/members/${memberId}`);
      toast.success("Member removed");
      load();
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const isOwnerOrAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";

  return (
    <div className="p-6 space-y-6" data-testid="team-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-bold tracking-tight text-foreground">Team Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Invite and manage your workspace collaborators</p>
          </div>
        </div>

        {isOwnerOrAdmin && (
          <Dialog open={showInvite} onOpenChange={setShowInvite}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" data-testid="invite-member-btn">
                <Plus className="w-4 h-4 mr-1.5" />Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#121215] border-[#27272a] shadow-2xl" data-testid="invite-dialog">
              <DialogHeader>
                <DialogTitle className="font-outfit text-xl font-bold">Invite to Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="bg-secondary/30 border-border h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Workspace Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-secondary/30 border-border h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (Full Control)</SelectItem>
                      <SelectItem value="agent">Agent (Manage Messages)</SelectItem>
                      <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleInvite} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11">
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="bg-[#121215]/40 border-border backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-secondary/10">
                <TableHead className="pl-6 py-4">Teammate</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined At</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground">Gathering team...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <Mail className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-muted-foreground text-sm font-medium">Only you are in this workspace</p>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id} className="border-border hover:bg-secondary/20 transition-colors group">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                          {(m.user_name || m.user_email || "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight">{m.user_name || "Unknown User"}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{m.user_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOwnerOrAdmin && m.role !== "owner" ? (
                        <Select value={m.role} onValueChange={(r) => updateRole(m.id, r)}>
                          <SelectTrigger className="w-24 h-7 text-[10px] bg-secondary/50 border-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0 h-5 border-0 ${ROLE_COLORS[m.role]}`}>
                          {m.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-secondary/50 text-[10px] border-0 h-5 uppercase tracking-widest">
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {isOwnerOrAdmin && m.role !== "owner" && m.user_id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                          onClick={() => removeMember(m.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {
        !isOwnerOrAdmin && (
          <p className="text-[10px] text-center text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" /> Note: Only workspace owners and admins can invite or manage team roles.
          </p>
        )
      }
    </div >
  );
}
