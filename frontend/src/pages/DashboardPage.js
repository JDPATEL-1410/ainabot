import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  MessageSquare, Users, FileText, Megaphone, Zap, ArrowUpRight,
  Send, Radio, TrendingUp, BarChart3, Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#121215] border border-[#27272a] rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [waStatus, setWaStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [dashRes, waRes, analyticsRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/whatsapp/status"),
        api.get("/dashboard/analytics")
      ]);
      setStats(dashRes.data.stats);
      setRecent(dashRes.data.recent_conversations || []);
      setWaStatus(waRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connectWhatsApp = () => {
    const FB = window.FB;
    if (!FB) {
      toast.error("Meta SDK not loaded. Check your internet connection or ad blocker.");
      return;
    }

    FB.login((response) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        toast.promise(
          api.post("/whatsapp/onboard", { code }).then(async () => {
            const waRes = await api.get("/whatsapp/status");
            setWaStatus(waRes.data);
            await refreshWorkspace();
          }),
          {
            loading: "Connecting your account...",
            success: "WhatsApp connected successfully!",
            error: (err) => err.response?.data?.detail || "Connection failed"
          }
        );
      } else {
        toast.error("Onboarding cancelled or failed");
      }
    }, {
      config_id: '1403545044471651',
      response_type: "code",
      override_default_response_type: true,
      extras: {
        feature: "whatsapp_embedded_signup",
        setup: {}
      }
    });
  };

  const statCards = stats ? [
    { label: "Total Contacts", value: stats.total_contacts, icon: Users, color: "text-blue-400" },
    { label: "Open Conversations", value: stats.open_conversations, sub: `${stats.total_conversations} total`, icon: MessageSquare, color: "text-primary" },
    { label: "Messages Sent", value: stats.outbound_messages, sub: `${stats.inbound_messages} received`, icon: Send, color: "text-amber-400" },
    { label: "Delivery Rate", value: `${stats.delivery_rate}%`, icon: Zap, color: "text-green-400" },
  ] : [];

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-secondary/50 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-secondary/30 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-secondary/20 rounded-xl" />
          <div className="h-80 bg-secondary/20 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {workspace?.name}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-400" />
            Your WhatsApp Business Platform is operational
          </p>
        </div>

        {!waStatus?.connected ? (
          <Button
            onClick={connectWhatsApp}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 animate-in fade-in slide-in-from-right-4 duration-500"
            data-testid="connect-whatsapp-btn"
          >
            <Zap className="w-4 h-4 mr-2 fill-current" />
            Connect WhatsApp Account
          </Button>
        ) : (
          <div className="flex items-center gap-3 bg-secondary/50 px-4 py-2 rounded-full border border-border shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium">{waStatus.connection.display_phone}</span>
            <Badge variant="outline" className="text-[10px] bg-green-400/10 text-green-400 border-green-400/20">
              Connected
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card/50 border-border hover:border-primary/50 transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-4 h-4 text-green-400 opacity-50" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold font-outfit">{stat.value}</h3>
                  {stat.sub && <span className="text-xs text-muted-foreground">{stat.sub}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/40 border-border backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-outfit text-lg font-bold">Message Activity</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Traffic across last 7 days</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Sent</Badge>
              <Badge variant="outline" className="bg-blue-400/5 text-blue-400 border-blue-400/20">Received</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.daily_messages || []}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                  />
                  <RTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorSent)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="received"
                    name="Received"
                    stroke="#60a5fa"
                    fillOpacity={1}
                    fill="url(#colorRec)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-outfit text-lg font-bold">Plan Usage</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Monthly quota tracking</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Send className="w-3 h-3" /> Messages
                </span>
                <span className="font-medium">
                  {analytics?.usage?.messages_sent?.toLocaleString()} / {analytics?.usage?.message_limit === -1 ? "∞" : analytics?.usage?.message_limit?.toLocaleString()}
                </span>
              </div>
              <Progress
                value={analytics?.usage?.message_limit === -1 ? 0 : Math.min(100, (analytics?.usage?.messages_sent / Math.max(1, analytics?.usage?.message_limit)) * 100)}
                className="h-2 bg-secondary"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold mb-3">Recent Active Chats</h4>
              <div className="space-y-3">
                {recent.slice(0, 5).map(conv => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between group cursor-pointer"
                    onClick={() => navigate(`/inbox?id=${conv.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        {conv.contact_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{conv.contact_name}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{conv.last_message}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full text-xs font-medium h-9 border-border hover:bg-secondary"
              onClick={() => navigate('/billing')}
            >
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
