import { supabase } from "@/integrations/supabase/client";

const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

export function parseMentionUsernames(content: string): string[] {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, "g");
  while ((m = re.exec(content)) !== null) {
    seen.add(m[1].toLowerCase());
  }
  return [...seen];
}

export async function insertMentionsAndNotifications(
  messageId: string,
  content: string,
  authorUserId: string
): Promise<void> {
  const names = parseMentionUsernames(content);
  if (names.length === 0) return;

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in(
      "username",
      names.map((n) => n.toLowerCase())
    );

  if (pErr || !profiles?.length) return;

  const rows: { message_id: string; mentioned_user_id: string }[] = [];
  const notif: { user_id: string; message_id: string }[] = [];
  const seen = new Set<string>();

  for (const p of profiles) {
    if (!p.username) continue;
    const un = p.username.toLowerCase();
    if (!names.includes(un)) continue;
    if (p.user_id === authorUserId) continue;
    if (seen.has(p.user_id)) continue;
    seen.add(p.user_id);
    rows.push({ message_id: messageId, mentioned_user_id: p.user_id });
    notif.push({ user_id: p.user_id, message_id: messageId });
  }

  if (rows.length === 0) return;

  await supabase.from("mentions").insert(rows);
  await supabase.from("notifications").insert(notif);
}
