import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Video, Radio, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{
        background: "radial-gradient(circle at 20% 20%, oklch(0.72 0.24 358 / 0.25), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.6 0.22 320 / 0.2), transparent 50%)"
      }} />
      <header className="relative flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <img src={logo} alt="OnlyFriends" className="h-9 w-9" />
          <span className="text-xl font-bold tracking-tight">OnlyFriends</span>
        </div>
        <div className="flex gap-2">
          <Link to="/auth" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-accent">Sign in</Link>
          <Link to="/auth" search={{ mode: "signup" } as never} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground glow-pink">Get started</Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 pt-20 pb-16 md:pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            Only your circle. Nothing more.
          </span>
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight md:text-7xl">
            Chat, stream, and share <span className="text-gradient">only with friends</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            OnlyFriends is a private messenger and video feed. You can only DM someone if you've both subscribed to each other. Post reels, go live, and stay close to the people who matter.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" } as never} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground glow-pink hover:opacity-90">
              Create your account
            </Link>
            <Link to="/auth" className="rounded-full border border-border px-6 py-3 font-semibold hover:bg-accent">Sign in</Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-4">
          {[
            { icon: MessageCircle, title: "Private DMs", desc: "Chat only with mutual subscribers." },
            { icon: Video, title: "Video reels", desc: "Post short videos. Get likes and views." },
            { icon: Radio, title: "Go live", desc: "Stream webcam or screen to your circle." },
            { icon: Users, title: "Subscriptions", desc: "Follow anyone. Chat unlocks when they follow back." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
