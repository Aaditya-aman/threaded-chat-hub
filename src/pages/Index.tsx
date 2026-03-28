import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RoomSidebar } from "@/components/RoomSidebar";
import { ChatView } from "@/components/ChatView";
import { MobileNav } from "@/components/MobileNav";
import { Loader2 } from "lucide-react";
import { insertMentionsAndNotifications } from "@/lib/mentions";

export interface RoomData {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string | null;
  memberCount: number;
}

export interface MessageData {
  id: string;
  chat_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  image_url: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  is_pinned: boolean;
  votes_count: number;
  created_at: string;
  profile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  userVote: number;
  children: MessageData[];
  mentionedUsernames: string[];
}

export interface JoinRequest {
  id: string;
  room_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export type AttachmentPayload = { path: string; attachment_type: string };

function flipPinInTree(msgs: MessageData[], messageId: string): MessageData[] {
  return msgs.map((m) => {
    if (m.id === messageId) return { ...m, is_pinned: !m.is_pinned };
    if (m.children.length)
      return { ...m, children: flipPinInTree(m.children, messageId) };
    return m;
  });
}

const Index = () => {
  const { roomId: urlRoomId, messageId: urlMessageId } = useParams<{
    roomId?: string;
    messageId?: string;
  }>();
  const { user, profile, signOut } = useAuth();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const didScrollRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlRoomId) setActiveRoomId(urlRoomId);
  }, [urlRoomId]);

  useEffect(() => {
    didScrollRef.current = null;
  }, [urlMessageId, activeRoomId]);

  // Fetch rooms + membership
  useEffect(() => {
    if (!user) return;
    const fetchRooms = async () => {
      const [{ data: roomData }, { data: memberData }, { data: requestData }] =
        await Promise.all([
          supabase
            .from("chat_rooms")
            .select("*, room_members(count)")
            .order("created_at", { ascending: false }),
          supabase.from("room_members").select("room_id").eq("user_id", user.id),
          supabase.from("room_join_requests").select("*").eq("user_id", user.id),
        ]);

      if (memberData) {
        setMemberRoomIds(new Set(memberData.map((m) => m.room_id)));
      }
      if (requestData) {
        setJoinRequests(requestData as JoinRequest[]);
      }
      if (roomData) {
        const mapped = roomData.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          created_at: r.created_at,
          created_by: r.created_by,
          memberCount: (r.room_members as { count: number }[])?.[0]?.count || 0,
        }));
        setRooms(mapped);
        if (!urlRoomId && !activeRoomId && mapped.length > 0) {
          const memberRoom = mapped.find((r) =>
            memberData?.some((m) => m.room_id === r.id)
          );
          setActiveRoomId(memberRoom?.id || mapped[0].id);
        }
      }
      setLoadingRooms(false);
    };
    fetchRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only; avoid re-fetch when activeRoomId changes
  }, [user]);

  // Fetch messages for active room (only if member)
  useEffect(() => {
    if (!activeRoomId || !user || !memberRoomIds.has(activeRoomId)) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data: msgs } = await supabase
        .from("messages")
        .select(
          "*, profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)"
        )
        .eq("chat_id", activeRoomId)
        .order("created_at", { ascending: true });

      const { data: votes } = await supabase
        .from("votes")
        .select("message_id, value")
        .eq("user_id", user.id);

      const voteMap = new Map<string, number>();
      votes?.forEach((v) => voteMap.set(v.message_id, v.value));

      const mentionByMessage = new Map<string, string[]>();
      if (msgs?.length) {
        const ids = msgs.map((m) => m.id);
        const { data: mentionRows } = await supabase
          .from("mentions")
          .select("message_id, mentioned_user_id")
          .in("message_id", ids);
        const uids = [...new Set(mentionRows?.map((r) => r.mentioned_user_id) || [])];
        if (uids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, username")
            .in("user_id", uids);
          const uidToUser = new Map(
            profs?.map((p) => [p.user_id, p.username?.toLowerCase() || ""]) || []
          );
          for (const row of mentionRows || []) {
            const un = uidToUser.get(row.mentioned_user_id);
            if (!un) continue;
            const arr = mentionByMessage.get(row.message_id) || [];
            arr.push(un);
            mentionByMessage.set(row.message_id, arr);
          }
        }
      }

      if (msgs) {
        const map = new Map<string, MessageData>();
        const roots: MessageData[] = [];

        msgs.forEach((m) => {
          const profileData = Array.isArray((m as { profiles?: unknown }).profiles)
            ? (m as { profiles: unknown[] }).profiles[0]
            : (m as { profiles?: unknown }).profiles;
          map.set(m.id, {
            id: m.id,
            chat_id: m.chat_id,
            parent_id: m.parent_id,
            user_id: m.user_id,
            content: m.content,
            image_url: m.image_url,
            attachment_url: m.attachment_url ?? null,
            attachment_type: m.attachment_type ?? null,
            is_pinned: m.is_pinned ?? false,
            votes_count: m.votes_count,
            created_at: m.created_at,
            profile: profileData || null,
            userVote: voteMap.get(m.id) || 0,
            children: [],
            mentionedUsernames: mentionByMessage.get(m.id) || [],
          });
        });

        msgs.forEach((m) => {
          const node = map.get(m.id)!;
          if (m.parent_id && map.has(m.parent_id)) {
            map.get(m.parent_id)!.children.push(node);
          } else {
            roots.push(node);
          }
        });

        setMessages(roots);
      }
      setLoadingMessages(false);
    };
    fetchMessages();
  }, [activeRoomId, user, memberRoomIds]);

  useEffect(() => {
    if (!urlMessageId || loadingMessages || didScrollRef.current === urlMessageId) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${urlMessageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightMessageId(urlMessageId);
        window.setTimeout(() => setHighlightMessageId(null), 1600);
        didScrollRef.current = urlMessageId;
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [urlMessageId, loadingMessages, messages]);

  const handleVote = useCallback(
    async (messageId: string, vote: 1 | -1) => {
      if (!user) return;
      const findVote = (msgs: MessageData[]): number => {
        for (const m of msgs) {
          if (m.id === messageId) return m.userVote;
          const found = findVote(m.children);
          if (found !== 0) return found;
        }
        return 0;
      };
      const currentVote = findVote(messages);
      const newVote = currentVote === vote ? 0 : vote;
      const diff = newVote - currentVote;

      const updateTree = (msgs: MessageData[]): MessageData[] =>
        msgs.map((m) => {
          if (m.id === messageId)
            return {
              ...m,
              userVote: newVote,
              votes_count: m.votes_count + diff,
            };
          return { ...m, children: updateTree(m.children) };
        });
      setMessages((prev) => updateTree(prev));

      if (newVote === 0) {
        await supabase
          .from("votes")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("votes").upsert(
          { message_id: messageId, user_id: user.id, value: newVote },
          { onConflict: "message_id,user_id" }
        );
      }
    },
    [user, messages]
  );

  const handleReply = useCallback(
    async (
      parentId: string,
      content: string,
      attachment?: AttachmentPayload | null
    ) => {
      if (!user || !activeRoomId) return;
      const { data } = await supabase
        .from("messages")
        .insert({
          chat_id: activeRoomId,
          parent_id: parentId,
          user_id: user.id,
          content: content.trim() || "",
          votes_count: 1,
          attachment_url: attachment?.path ?? null,
          attachment_type: attachment?.attachment_type ?? null,
        })
        .select(
          "*, profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)"
        )
        .single();

      if (data) {
        await supabase.from("votes").insert({
          message_id: data.id,
          user_id: user.id,
          value: 1,
        });
        await insertMentionsAndNotifications(data.id, data.content, user.id);
        const profileData = Array.isArray((data as { profiles?: unknown }).profiles)
          ? (data as { profiles: unknown[] }).profiles[0]
          : (data as { profiles?: unknown }).profiles;
        const newMsg: MessageData = {
          id: data.id,
          chat_id: data.chat_id,
          parent_id: data.parent_id,
          user_id: data.user_id,
          content: data.content,
          image_url: data.image_url,
          attachment_url: data.attachment_url ?? null,
          attachment_type: data.attachment_type ?? null,
          is_pinned: false,
          votes_count: data.votes_count,
          created_at: data.created_at,
          profile: profileData || null,
          userVote: 1,
          children: [],
          mentionedUsernames: [],
        };
        const addToTree = (msgs: MessageData[]): MessageData[] =>
          msgs.map((m) => {
            if (m.id === parentId)
              return { ...m, children: [...m.children, newMsg] };
            return { ...m, children: addToTree(m.children) };
          });
        setMessages((prev) => addToTree(prev));
      }
    },
    [user, activeRoomId]
  );

  const handleNewThread = useCallback(
    async (content: string, attachment?: AttachmentPayload | null) => {
      if (!user || !activeRoomId) return;
      const { data } = await supabase
        .from("messages")
        .insert({
          chat_id: activeRoomId,
          parent_id: null,
          user_id: user.id,
          content: content.trim() || "",
          votes_count: 1,
          attachment_url: attachment?.path ?? null,
          attachment_type: attachment?.attachment_type ?? null,
        })
        .select(
          "*, profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)"
        )
        .single();

      if (data) {
        await supabase.from("votes").insert({
          message_id: data.id,
          user_id: user.id,
          value: 1,
        });
        await insertMentionsAndNotifications(data.id, data.content, user.id);
        const profileData = Array.isArray((data as { profiles?: unknown }).profiles)
          ? (data as { profiles: unknown[] }).profiles[0]
          : (data as { profiles?: unknown }).profiles;
        const newMsg: MessageData = {
          id: data.id,
          chat_id: data.chat_id,
          parent_id: null,
          user_id: data.user_id,
          content: data.content,
          image_url: data.image_url,
          attachment_url: data.attachment_url ?? null,
          attachment_type: data.attachment_type ?? null,
          is_pinned: data.is_pinned ?? false,
          votes_count: data.votes_count,
          created_at: data.created_at,
          profile: profileData || null,
          userVote: 1,
          children: [],
          mentionedUsernames: [],
        };
        setMessages((prev) => [newMsg, ...prev]);
      }
    },
    [user, activeRoomId]
  );

  const handleTogglePin = useCallback(async (messageId: string) => {
    const { error } = await supabase.rpc("toggle_message_pin", {
      p_message_id: messageId,
    });
    if (!error) setMessages((prev) => flipPinInTree(prev, messageId));
  }, []);

  const handleCreateRoom = useCallback(async (name: string, description: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_rooms")
      .insert({ name, description, created_by: user.id })
      .select()
      .single();

    if (data) {
      await supabase.from("room_members").insert({
        room_id: data.id,
        user_id: user.id,
      });
      const newRoom: RoomData = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        created_at: data.created_at,
        created_by: data.created_by,
        memberCount: 1,
      };
      setRooms((prev) => [newRoom, ...prev]);
      setMemberRoomIds((prev) => new Set([...prev, data.id]));
      setActiveRoomId(data.id);
    }
  }, [user]);

  const handleRequestJoin = useCallback(async (roomId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("room_join_requests")
      .insert({ room_id: roomId, user_id: user.id })
      .select()
      .single();
    if (data) {
      setJoinRequests((prev) => [...prev, data as JoinRequest]);
    }
  }, [user]);

  const handleApproveRequest = useCallback(
    async (requestId: string, approved: boolean) => {
      const status = approved ? "approved" : "rejected";
      await supabase.from("room_join_requests").update({ status }).eq("id", requestId);

      if (approved) {
        const req =
          joinRequests.find((r) => r.id === requestId) ||
          (
            await supabase
              .from("room_join_requests")
              .select("*")
              .eq("id", requestId)
              .single()
          ).data;
        if (req) {
          await supabase.from("room_members").insert({
            room_id: (req as JoinRequest).room_id,
            user_id: (req as JoinRequest).user_id,
          });
        }
      }

      setJoinRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      );
    },
    [joinRequests]
  );

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const isMember = activeRoomId ? memberRoomIds.has(activeRoomId) : false;
  const activeRoomRequest = activeRoomId
    ? joinRequests.find((r) => r.room_id === activeRoomId)
    : null;

  useEffect(() => {
    if (!user || !activeRoom) return;
    if (activeRoom.created_by !== user.id) {
      setPendingRequests([]);
      return;
    }
    const fetchPending = async () => {
      const { data } = await supabase
        .from("room_join_requests")
        .select("*")
        .eq("room_id", activeRoom.id)
        .eq("status", "pending");
      setPendingRequests((data as JoinRequest[]) || []);
    };
    fetchPending();
  }, [activeRoom, user, joinRequests]);

  if (loadingRooms) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <MobileNav
        open={mobileNavOpen}
        onToggle={() => setMobileNavOpen(!mobileNavOpen)}
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
        memberRoomIds={memberRoomIds}
      />
      <div className="hidden md:flex">
        <RoomSidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onCreateRoom={handleCreateRoom}
          profile={profile}
          onSignOut={signOut}
          memberRoomIds={memberRoomIds}
        />
      </div>
      {activeRoom ? (
        <ChatView
          room={activeRoom}
          messages={messages}
          loading={loadingMessages}
          onVote={handleVote}
          onReply={handleReply}
          onNewThread={handleNewThread}
          isMember={isMember}
          joinRequest={activeRoomRequest}
          onRequestJoin={() => handleRequestJoin(activeRoom.id)}
          pendingRequests={pendingRequests}
          onApproveRequest={handleApproveRequest}
          isOwner={activeRoom.created_by === user?.id}
          highlightMessageId={highlightMessageId}
          onTogglePin={handleTogglePin}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Create a room to get started!</p>
        </div>
      )}
    </div>
  );
};

export default Index;
