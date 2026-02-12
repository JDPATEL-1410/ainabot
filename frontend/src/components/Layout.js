import Sidebar from "./Sidebar";
import { Toaster } from "../components/ui/sonner";

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background" data-testid="app-layout">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
