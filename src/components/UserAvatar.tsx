import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

export function useAvatarUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    if (path.startsWith("http")) { setUrl(path); return; }
    const cached = cache.get(path);
    if (cached) { setUrl(cached); return; }
    let alive = true;
    supabase.storage.from("avatars").createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive || !data) return;
      cache.set(path, data.signedUrl);
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path]);
  return url;
}

export function UserAvatar({
  path,
  name,
  className = "h-8 w-8 text-sm",
}: {
  path?: string | null;
  name: string;
  className?: string;
}) {
  const url = useAvatarUrl(path);
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-full bg-primary/20 font-bold text-primary ${className}`}>
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        (name[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}
