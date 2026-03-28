import { useState, useMemo, useRef } from "react";
import { MessageData, RoomData, JoinRequest, AttachmentPayload } from "@/pages/Index";
import { ThreadMessage } from "./ThreadMessage";
import { FocusView } from "./FocusView";
import { MentionTextarea } from "./MentionTextarea";
import { uploadAttachment } from "@/lib/attachments";
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  Clock,
  Sparkles,
  Send,
  Users,
  X,
  Loader2,
  Lock,
  CheckCircle,
  XCircle,
  UserPlus,
  Paperclip,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SortMode = "top" | "new" | "relevant";

interface ChatViewProps {
  room: RoomData;
  messages: MessageData[];
  loading: boolean;
  onVote: (messageId: string, vote: 1 | -1) => void;
  onReply: (
    parentId: string,
    content: string,
    attachment?: AttachmentPayload | null
  ) => void | Promise<void>;
  onNewThread: (
    content: string,
    attachment?: AttachmentPayload | null
  ) => void | Promise<void>;
  isMember: boolean;
  joinRequest: JoinRequest | null | undefined;
  onRequestJoin: () => void;
  pendingRequests: JoinRequest[];
  onApproveRequest: (requestId: string, approved: boolean) => void;
  isOwner: boolean;
  highlightMessageId?: string | null;
  onTogglePin: (messageId: string) => void | Promise<void>;
}

const sortMessages = (msgs: MessageData[], mode: SortMode): MessageData[] => {
  const sorted = [...msgs];
  switch (mode) {
    case "top":
      sorted.sort((a, b) => b.votes_count - a.votes_count);
      break;
    case "new":
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      break;
    case "relevant":
      sorted.sort(
        (a, b) =>
          b.votes_count * 2 +
          b.children.length -
          (a.votes_count * 2 + a.children.length)
      );
      break;
  }
  return sorted;
};

const messageMatchesSearch = (msg: MessageData, query: string): boolean => {
  if (msg.content.toLowerCase().includes(query)) return true;
  return msg.children.some((c) => messageMatchesSearch(c, query));
};

export const ChatView = ({
  room,
  messages,
  loading,
  onVote,
  onReply,
  onNewThread,
  isMember,
  joinRequest,
  onRequestJoin,
  pendingRequests,
  onApproveRequest,
  isOwner,
  highlightMessageId,
  onTogglePin,
}: ChatViewProps) => {
  const [sortMode, setSortMode] = useState<SortMode>("relevant");
  const [searchQuery, setSearchQuery] = useState("");
  const [newThreadText, setNewThreadText] = useState("");
  const [focusedMessage, setFocusedMessage] = useState<MessageData | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingThread, setSendingThread] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const scrollToMessage = (id: string) => {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("message-flash-highlight");
    window.setTimeout(() => el?.classList.remove("message-flash-highlight"), 1500);
  };

  const { pinnedThreads, otherThreads } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const roots = q
      ? messages.filter((m) => messageMatchesSearch(m, q))
      : messages;
    const pinned = sortMessages(
      roots.filter((m) => m.is_pinned),
      sortMode
    );
    const rest = sortMessages(
      roots.filter((m) => !m.is_pinned),
      sortMode
    );
    return { pinnedThreads: pinned, otherThreads: rest };
  }, [messages, searchQuery, sortMode]);

  const handleNewThread = async () => {
    if ((!newThreadText.trim() && !pendingFile) || sendingThread) return;
    setSendingThread(true);
    try {
      let attachment: AttachmentPayload | undefined;
      if (pendingFile) {
        attachment = await uploadAttachment(room.id, pendingFile);
      }
      await onNewThread(newThreadText.trim(), attachment);
      setNewThreadText("");
      setPendingFile(null);
    } finally {
      setSendingThread(false);
    }
  };

  const sortButtons: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
    { mode: "top", label: "Top", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { mode: "new", label: "New", icon: <Clock className="w-3.5 h-3.5" /> },
    {
      mode: "relevant",
      label: "Best",
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

  if (focusedMessage) {
    return (
      <FocusView
        message={focusedMessage}
        roomId={room.id}
        onBack={() => setFocusedMessage(null)}
        onVote={onVote}
        onReply={onReply}
        onFocus={setFocusedMessage}
        highlightMessageId={highlightMessageId}
        isRoomOwner={isOwner}
        onTogglePin={onTogglePin}
        onScrollToMessage={scrollToMessage}
      />
    );
  }

  const renderThreadCard = (msg: MessageData) => (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg p-4 border border-border hover:border-primary/20 transition-colors"
    >
      <ThreadMessage
        message={msg}
        depth={0}
        maxDepth={4}
        roomId={room.id}
        onVote={onVote}
        onReply={onReply}
        onFocus={setFocusedMessage}
        searchQuery={searchQuery}
        highlightMessageId={highlightMessageId}
        isRoomOwner={isOwner}
        onTogglePin={onTogglePin}
        onScrollToMessage={scrollToMessage}
      />
    </motion.div>
  );

  const searchMode = !!searchQuery.trim();
  const combinedWhenSearch = searchMode
    ? [...pinnedThreads, ...otherThreads]
    : otherThreads;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{room.name}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users className="w-3.5 h-3.5" /> {room.memberCount} members ·{" "}
              {room.description}
            </p>
          </div>
          {isMember && (
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-md transition-colors ${showSearch ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>

        {isOwner && pendingRequests.length > 0 && (
          <div className="mt-3 p-3 bg-accent/50 rounded-lg border border-accent">
            <p className="text-sm font-medium text-accent-foreground mb-2">
              <UserPlus className="w-4 h-4 inline mr-1" />
              {pendingRequests.length} pending join request
              {pendingRequests.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between bg-background rounded-md px-3 py-2"
                >
                  <span className="text-sm text-foreground">User request</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onApproveRequest(req.id, true)}
                      className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                      title="Approve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onApproveRequest(req.id, false)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      title="Reject"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isMember && (
          <>
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search threads..."
                      className="w-full bg-secondary rounded-md pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-1 mt-3">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {sortButtons.map((sb) => (
                <button
                  key={sb.mode}
                  type="button"
                  onClick={() => setSortMode(sb.mode)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${sortMode === sb.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                >
                  {sb.icon} {sb.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 px-6">
          <Lock className="w-10 h-10 text-muted-foreground/50" />
          <p className="text-center text-sm">
            You need to join this room to see messages and participate.
          </p>
          {joinRequest?.status === "pending" ? (
            <div className="px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium">
              Request pending…
            </div>
          ) : joinRequest?.status === "rejected" ? (
            <div className="px-4 py-2 bg-destructive/10 text-destructive rounded-md text-sm font-medium">
              Request was rejected
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestJoin}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Request to Join
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            ref={scrollRootRef}
            className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4"
          >
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : searchMode ? (
              combinedWhenSearch.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageEmpty />
                  <p className="mt-2 text-sm">No threads match your search</p>
                </div>
              ) : (
                combinedWhenSearch.map((msg) => renderThreadCard(msg))
              )
            ) : (
              <>
                {pinnedThreads.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Pinned
                    </p>
                    <div className="space-y-4">
                      {pinnedThreads.map((msg) => renderThreadCard(msg))}
                    </div>
                  </div>
                )}
                {otherThreads.length > 0 && (
                  <div className="space-y-3">
                    {pinnedThreads.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 border-t border-border">
                        Threads
                      </p>
                    )}
                    <div className="space-y-4">
                      {otherThreads.map((msg) => renderThreadCard(msg))}
                    </div>
                  </div>
                )}
                {pinnedThreads.length === 0 && otherThreads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageEmpty />
                    <p className="mt-2 text-sm">
                      No threads yet. Start one below!
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,application/pdf,.docx,.txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPendingFile(f || null);
                e.target.value = "";
              }}
            />
            {pendingFile && (
              <p className="text-xs text-muted-foreground mb-2 truncate">
                {pendingFile.name}
              </p>
            )}
            <div className="flex gap-2 items-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-md bg-secondary text-foreground hover:bg-secondary/80 shrink-0"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <MentionTextarea
                  value={newThreadText}
                  onChange={setNewThreadText}
                  placeholder="Start a new thread… (use @ to mention)"
                  rows={2}
                  disabled={sendingThread}
                  onSubmit={handleNewThread}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleNewThread()}
                disabled={
                  (!newThreadText.trim() && !pendingFile) || sendingThread
                }
                className="bg-primary text-primary-foreground px-4 py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {sendingThread ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const MessageEmpty = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    className="text-muted-foreground/30"
  >
    <rect
      x="8"
      y="12"
      width="48"
      height="36"
      rx="4"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M8 20h48" stroke="currentColor" strokeWidth="2" />
    <rect
      x="16"
      y="28"
      width="20"
      height="3"
      rx="1.5"
      fill="currentColor"
      opacity="0.4"
    />
    <rect
      x="16"
      y="35"
      width="28"
      height="3"
      rx="1.5"
      fill="currentColor"
      opacity="0.3"
    />
  </svg>
);
