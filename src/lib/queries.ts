import { supabase } from "@/integrations/supabase/client";

/** Columns any signed-in user may read from another person's profile. */
export const PUBLIC_PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, bio, created_at, boost_until, active_theme";

export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  // Sensitive profile columns (balance, VIP, limits) are owner-only, served by this RPC.
  const { data } = await supabase.rpc("my_profile");
  return data?.[0] ?? null;
}

export async function getProfileByUsername(username: string) {
  const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("username", username).maybeSingle();
  return data;
}

export async function getFriends(userId: string) {
  const { data: iFollow } = await supabase.from("subscriptions").select("subscribed_to_id").eq("subscriber_id", userId);
  const { data: followsMe } = await supabase.from("subscriptions").select("subscriber_id").eq("subscribed_to_id", userId);
  const followSet = new Set((iFollow ?? []).map((r) => r.subscribed_to_id));
  const mutual = (followsMe ?? []).map((r) => r.subscriber_id).filter((id) => followSet.has(id));
  if (mutual.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", mutual);
  return profiles ?? [];
}

export async function getSubscriptionStatus(myId: string, otherId: string) {
  const { data } = await supabase.from("subscriptions").select("subscriber_id, subscribed_to_id")
    .or(`and(subscriber_id.eq.${myId},subscribed_to_id.eq.${otherId}),and(subscriber_id.eq.${otherId},subscribed_to_id.eq.${myId})`);
  const iSubscribe = !!data?.find((r) => r.subscriber_id === myId && r.subscribed_to_id === otherId);
  const theySubscribe = !!data?.find((r) => r.subscriber_id === otherId && r.subscribed_to_id === myId);
  return { iSubscribe, theySubscribe, friends: iSubscribe && theySubscribe };
}

export async function getMyTransactions(limit = 30) {
  const { data } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}
