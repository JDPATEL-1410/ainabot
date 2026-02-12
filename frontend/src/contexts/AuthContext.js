import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      if (data.workspace_id) {
        const wsRes = await api.get("/workspace/current");
        setWorkspace(wsRes.data.workspace);
      }
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser({ ...data.user, workspace_id: data.workspace_id });
    if (data.workspace_id) {
      const wsRes = await api.get("/workspace/current");
      setWorkspace(wsRes.data.workspace);
    }
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const createWorkspace = async (name, timezone) => {
    const { data } = await api.post("/workspace/create", { name, timezone });
    localStorage.setItem("token", data.token);
    setUser((prev) => ({ ...prev, workspace_id: data.workspace.id, role: "owner" }));
    setWorkspace(data.workspace);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setWorkspace(null);
  };

  const refreshWorkspace = async () => {
    const wsRes = await api.get("/workspace/current");
    setWorkspace(wsRes.data.workspace);
  };

  return (
    <AuthContext.Provider
      value={{ user, workspace, loading, login, register, createWorkspace, logout, refreshWorkspace, fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
