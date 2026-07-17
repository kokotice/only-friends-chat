import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Video, Radio, Upload, LogOut, User, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
    toast.success("Signed out");
  }

  const nav_items = [
    { to: "/app", label: "Messages", icon: MessageCircle },
    { to: "/feed", label: "Feed", icon: Video },
    { to: "/live", label: "Live", icon: Radio },
    { to: "/discover", label: "Discover", icon: Search },
    { to: "/upload", label: "Upload", icon: Upload },
  ];

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <Link to="/app" className="flex items-center gap-2 px-5 py-4 border-b border-sidebar-border">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="font-bold tracking-tight">OnlyFriends</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {nav_items.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          {profile && (
            <Link to="/profile/$username" params={{ username: profile.username }} className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
                {profile.display_name?.[0]?.toUpperCase() ?? profile.username[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{profile.display_name ?? profile.username}</div>
                <div className="truncate text-xs text-muted-foreground">@{profile.username}</div>
              </div>
            </Link>
          )}
          <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
