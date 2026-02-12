import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Radio, Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo",
  "Asia/Shanghai", "Australia/Sydney", "Pacific/Auckland"
];

export default function SetupPage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(false);
  const { createWorkspace } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a workspace name");
      return;
    }
    setLoading(true);
    try {
      await createWorkspace(name, timezone);
      toast.success("Workspace created! Welcome to YourApp.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background" data-testid="setup-page">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Radio className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
          </div>
          <span className="font-outfit font-bold text-xl tracking-tight">YourApp</span>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <Building2 className="w-7 h-7 text-primary" strokeWidth={1.5} />
            </div>
            <CardTitle className="font-outfit text-2xl font-bold tracking-tight">Set up your workspace</CardTitle>
            <CardDescription>Create your team workspace to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Company / Workspace Name</Label>
                <Input
                  id="ws-name"
                  placeholder="Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="workspace-name-input"
                  className="bg-secondary/30 border-border focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger data-testid="timezone-select" className="bg-secondary/30 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={loading}
                data-testid="create-workspace-btn"
              >
                {loading ? "Creating..." : "Create Workspace"}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
