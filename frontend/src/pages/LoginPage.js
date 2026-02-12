import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Radio, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success("Welcome back!");
      navigate(data.workspace_id ? "/dashboard" : "/setup");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#060608] items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent" />
        <div className="relative z-10 max-w-md px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Radio className="w-6 h-6 text-primary-foreground" strokeWidth={2} />
            </div>
            <h1 className="font-outfit font-bold text-3xl tracking-tight">YourApp</h1>
          </div>
          <h2 className="font-outfit text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
            WhatsApp Business<br />
            <span className="text-primary">Messaging Platform</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Connect your WhatsApp Business account, manage conversations, automate messaging, and grow your business — all from one powerful dashboard.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Radio className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
              </div>
              <span className="font-outfit font-bold text-xl">YourApp</span>
            </div>
            <CardTitle className="font-outfit text-2xl font-bold tracking-tight">Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email-input"
                  className="bg-secondary/30 border-border focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
                  className="bg-secondary/30 border-border focus:border-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline" data-testid="signup-link">
                Create account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
