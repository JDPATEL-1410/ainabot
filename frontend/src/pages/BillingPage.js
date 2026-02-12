import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import { CheckCircle, CreditCard, ArrowUpRight, FileText, Loader2, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";

const FALLBACK_PLANS = {
  starter: { name: "Starter", price: 2499, agents: 3, numbers: 1, messages: 5000 },
  pro: { name: "Pro", price: 5999, agents: 10, numbers: 3, messages: 50000 },
  enterprise: { name: "Enterprise", price: 14999, agents: -1, numbers: -1, messages: -1 },
};

export default function BillingPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const [subRes, analyticsRes, plansRes] = await Promise.all([
        api.get("/billing/subscription"),
        api.get("/dashboard/analytics"),
        api.get("/billing/plans")
      ]);
      setSubscription(subRes.data);
      setTransactions(subRes.data.transactions || []);
      setAnalytics(analyticsRes.data);
      if (plansRes.data.plans) setPlans(plansRes.data.plans);
    } catch {
      toast.error("Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll payment status on return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;
    let attempts = 0;
    const maxAttempts = 5;
    setChecking(true);
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setChecking(false);
        toast.error("Payment status check timed out. Check back shortly.");
        return;
      }
      try {
        const { data } = await api.get(`/billing/status/${sessionId}`);
        if (data.payment_status === "paid") {
          toast.success("Payment successful! Plan upgraded.");
          setChecking(false);
          refreshWorkspace();
          load();
          return;
        } else if (data.status === "expired") {
          toast.error("Payment session expired.");
          setChecking(false);
          return;
        }
      } catch {
        // ignore
      }
      attempts++;
      setTimeout(poll, 2000);
    };
    poll();
  }, [searchParams, load, refreshWorkspace]);

  const handleCheckout = async (planId) => {
    try {
      const originUrl = window.location.origin;
      const { data } = await api.post("/billing/checkout", { plan_id: planId, origin_url: originUrl });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Checkout failed");
    }
  };

  const currentPlan = workspace?.plan || "trial";
  const isTrial = currentPlan === "trial";

  if (loading) {
    return <div className="p-6"><div className="h-8 w-48 bg-secondary/50 rounded animate-pulse" /></div>;
  }

  return (
    <div className="p-6 space-y-6" data-testid="billing-page">
      <div>
        <h1 className="font-outfit text-2xl font-bold tracking-tight">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription and billing</p>
      </div>

      {checking && (
        <Card className="border-blue-400/20 bg-blue-400/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="text-sm font-medium">Verifying payment...</p>
          </CardContent>
        </Card>
      )}

      {/* Current Plan */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base">Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Badge className={isTrial ? "bg-amber-400/10 text-amber-400 border-amber-400/20 text-sm px-3 py-1" : "bg-primary/10 text-primary border-0 text-sm px-3 py-1"}>
                {currentPlan.toUpperCase()}
              </Badge>
            </div>
            {isTrial && workspace?.trial_end && (
              <p className="text-sm text-muted-foreground">
                Trial ends {new Date(workspace.trial_end).toLocaleDateString()} ({Math.max(0, Math.ceil((new Date(workspace.trial_end) - new Date()) / 86400000))} days left)
              </p>
            )}
            {!isTrial && subscription?.subscription && (
              <p className="text-sm text-muted-foreground">
                Active since {new Date(subscription.subscription.started_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      {analytics?.usage && (
        <Card className="bg-card/50 border-border" data-testid="usage-card">
          <CardHeader><CardTitle className="font-outfit text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Plan Usage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Messages This Month</span>
                  <span className="font-mono text-xs">
                    {analytics.usage.messages_sent}
                    {analytics.usage.message_limit > 0 && ` / ${analytics.usage.message_limit.toLocaleString()}`}
                    {analytics.usage.message_limit === -1 && " / Unlimited"}
                  </span>
                </div>
                <Progress value={analytics.usage.message_limit > 0 ? (analytics.usage.messages_sent / analytics.usage.message_limit) * 100 : 5} className="h-2.5" />
                {analytics.usage.message_limit > 0 && analytics.usage.messages_sent > analytics.usage.message_limit * 0.8 && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <p className="text-xs text-amber-400">Approaching message limit</p>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Team Members</span>
                  <span className="font-mono text-xs">
                    {analytics.usage.agents_used}
                    {analytics.usage.agent_limit > 0 && ` / ${analytics.usage.agent_limit}`}
                    {analytics.usage.agent_limit === -1 && " / Unlimited"}
                  </span>
                </div>
                <Progress value={analytics.usage.agent_limit > 0 ? (analytics.usage.agents_used / analytics.usage.agent_limit) * 100 : 5} className="h-2.5" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(plans).map(([id, plan]) => {
          const isCurrent = currentPlan === id;
          return (
            <Card key={id} className={`border ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-card/50"} hover:bg-card/80 transition-colors`} data-testid={`plan-card-${id}`}>
              <CardContent className="pt-6 pb-5 space-y-4">
                <div>
                  <h3 className="font-outfit text-lg font-bold">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-outfit text-3xl font-bold">₹{plan.price.toLocaleString('en-IN')}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{plan.agents === -1 ? "Unlimited" : plan.agents} agents</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{plan.numbers === -1 ? "Unlimited" : plan.numbers} phone number{plan.numbers !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{plan.messages === -1 ? "Unlimited" : plan.messages.toLocaleString()} messages/mo</span>
                  </div>
                </div>
                {isCurrent ? (
                  <Button disabled className="w-full" variant="outline">Current Plan</Button>
                ) : (
                  <Button onClick={() => handleCheckout(id)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" data-testid={`checkout-${id}`}>
                    {isTrial ? "Start Plan" : "Upgrade"} <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transaction History */}
      <Card className="bg-card/50 border-border">
        <CardHeader><CardTitle className="font-outfit text-base">Payment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No transactions yet</TableCell></TableRow>
              ) : transactions.map(tx => (
                <TableRow key={tx.id} className="border-border" data-testid={`tx-row-${tx.id}`}>
                  <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">{tx.plan_id}</TableCell>
                  <TableCell className="text-sm font-mono">₹{tx.amount.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      tx.payment_status === "paid" ? "bg-green-400/10 text-green-400 border-green-400/20 text-[10px]" :
                        tx.payment_status === "pending" ? "bg-amber-400/10 text-amber-400 border-amber-400/20 text-[10px]" :
                          "text-[10px]"
                    }>
                      {tx.payment_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
