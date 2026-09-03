import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Video, Radio, Upload, LogOut, Search, Wallet, Dice5, ShoppingBag, Trophy, Package, Shield, Footprints } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { applyTheme, getThemes } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import logo from "@/assets/logo.png";
import { UserAvatar } from "@/components/UserAvatar";
import { toast } from "sonner";
import { StepTrackerProvider, useStepTracker } from "@/hooks/useStepTracker";


const NAV = [
  { to: "/app", label: "Chats", icon: MessageCircle },
  { to: "/feed", label: "Feed", icon: Video },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/discover", label: "Find", icon: Search },
  { to: "/upload", label: "Post", icon: Upload },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/walk", label: "Walk", icon: Footprints },
  { to: "/casino", label: "Casino", icon: Dice5 },

  { to: "/crates", label: "Crates", icon: Package },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/staff", label: "Staff", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StepTrackerProvider>
      <AppShellInner>{children}</AppShellInner>
    </StepTrackerProvider>
  );
}

function WalkBadge() {
  const { tracking, session, earned } = useStepTracker();
  if (!tracking) return null;
  return (
    <Link
      to="/walk"
      className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary"
    >
      <Footprints className="h-3.5 w-3.5 animate-pulse" />
      {session} · +{earned}
    </Link>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: themes } = useQuery({ queryKey: ["themes"], queryFn: getThemes, staleTime: Infinity });


  // Apply the equipped theme's tokens to the document.
  const activeKey = profile?.active_theme;
  useEffect(() => {
    if (!themes || !activeKey) return;
    applyTheme(themes.find((t) => t.key === activeKey));
  }, [themes, activeKey]);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
    toast.success("Signed out");
  }

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <Link to="/app" className="flex items-center gap-2 px-5 py-4 border-b border-sidebar-border">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="font-bold tracking-tight">OnlyFriends</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => {
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
            <>
              <Link to="/wallet" className="mb-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Sparks</span>
                <span className="font-bold text-primary">💖 {profile.sparks ?? 0}</span>
              </Link>
              <Link to="/profile/$username" params={{ username: profile.username }} className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent">
                <UserAvatar path={profile.avatar_url} name={profile.display_name ?? profile.username} className="h-8 w-8 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{profile.display_name ?? profile.username}</div>
                  <div className="truncate text-xs text-muted-foreground">@{profile.username}</div>
                </div>
              </Link>
            </>
          )}
          <a
            href="https://discord.gg/wVSv5sT3dB"
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" /> Discord server
          </a>
          <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3">
        <Link to="/app" className="flex items-center gap-2">
          <img src={logo} alt="" className="h-7 w-7" />
          <span className="font-bold">OnlyFriends</span>
        </Link>
        <div className="flex items-center gap-2">
        <WalkBadge />
        {profile && (

          <Link to="/wallet" className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
            💖 {profile.sparks ?? 0}
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-hidden pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-sidebar-border bg-sidebar/95 backdrop-blur">
        {["/app", "/feed", "/walk", "/discover", "/upload"].map((to) => NAV.find((n) => n.to === to)!).map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
        <Link to="/wallet" className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${path.startsWith("/wallet") || path.startsWith("/casino") || path.startsWith("/shop") ? "text-primary" : "text-muted-foreground"}`}>
          <Wallet className="h-5 w-5" />
          More
        </Link>
      </nav>
    </div>
  );
}
