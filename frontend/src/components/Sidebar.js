import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import {
  LayoutDashboard, MessageSquare, Users, FileText, Megaphone,
  Zap, Settings, CreditCard, UserCog, Shield, ChevronLeft, ChevronRight, LogOut, Radio
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../components/ui/tooltip";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/inbox", label: "Inbox", icon: MessageSquare, badgeKey: "inbox" },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/templates", label: "Templates", icon: FileText },
  { path: "/campaigns", label: "Campaigns", icon: Megaphone },
  { path: "/automations", label: "Automations", icon: Zap },
  { path: "/team", label: "Team", icon: UserCog },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/billing", label: "Billing", icon: CreditCard },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { user, workspace, logout } = useAuth();

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/inbox/unread-count");
      setUnreadCount(data.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-testid="main-sidebar"
        className={`${collapsed ? "w-16" : "w-60"} h-screen flex flex-col border-r border-border bg-[#0a0a0c] transition-all duration-200 ease-out`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-border">
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Radio className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-outfit font-bold text-base tracking-tight text-foreground">YourApp</span>
            </Link>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center mx-auto">
              <Radio className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
            data-testid="sidebar-toggle-btn"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Workspace Name */}
        {!collapsed && workspace && (
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs text-muted-foreground truncate">Workspace</p>
            <p className="text-sm font-medium truncate" data-testid="workspace-name">{workspace.name}</p>
            <Badge variant="outline" className="mt-1 text-[10px] border-primary/30 text-primary">
              {workspace.plan?.toUpperCase() || "TRIAL"}
            </Badge>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            const btn = (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150
                  ${isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
                  } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badgeKey === "inbox" && unreadCount > 0 && (
                  <Badge className="ml-auto bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            );
            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
          {user?.is_super_admin && (
            <Link
              to="/admin"
              data-testid="nav-admin"
              className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all
                ${location.pathname.startsWith("/admin")
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
                } ${collapsed ? "justify-center" : ""}`}
            >
              <Shield className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
        </nav>

        {/* User Section */}
        <div className="border-t border-border px-2 py-2">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2 px-1"}`}>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={logout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
