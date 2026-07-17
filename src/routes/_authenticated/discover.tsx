import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
});

function DiscoverPage() {
  const [q, setQ] = useState("");
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: people = [] } = useQuery({
    queryKey: ["discover", q, me?.id],
    queryFn: async () => {
      const query = supabase.from("profiles").select("*").limit(50).order("created_at", { ascending: false });
      const { data } = q ? await query.ilike("username", `%${q}%`) : await query;
      return (data ?? []).filter((p) => p.id !== me?.id);
    },
    enabled: !!me,
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-bold">Discover people</h1>
        <p className="text-sm text-muted-foreground">Subscribe. If they subscribe back, you can DM.</p>
        <div className="relative mt-6">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username…"
            className="w-full rounded-full border border-border bg-input pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {people.map((p) => (
            <Link key={p.id} to="/profile/$username" params={{ username: p.username }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
                {(p.display_name ?? p.username)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.display_name ?? p.username}</div>
                <div className="truncate text-xs text-muted-foreground">@{p.username}</div>
              </div>
            </Link>
          ))}
          {people.length === 0 && <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No one found.</div>}
        </div>
      </div>
    </div>
  );
}
