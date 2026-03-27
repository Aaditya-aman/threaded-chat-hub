import { useState, useMemo } from "react";
import { MessageData, RoomData } from "@/pages/Index";
import { ThreadMessage } from "./ThreadMessage";
import { FocusView } from "./FocusView";
import { Search, ArrowUpDown, TrendingUp, Clock, Sparkles, Send, Users, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SortMode = "top" | "new" | "relevant";

interface ChatViewProps {
  room: RoomData;
  messages: MessageData[];
  loading: boolean;
  onVote: (messageId: string, vote: 1 | -1) => void;
  onReply: (parentId: string, content: string) => void;
  onNewThread: (content: string) => void;
}

const sortMessages = (msgs: MessageData[], mode: SortMode): MessageData[] => {
  const sorted = [...msgs];
  switch (mode) {
    case "top": sorted.sort((a, b) => b.votes_count - a.votes_count); break;
    case "new": sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    case "relevant": sorted.sort((a, b) => (b.votes_count * 2 + b.children.length) - (a.votes_count * 2 + a.children.length)); break;
  }
  return sorted;
};

const messageMatchesSearch = (msg: MessageData, query: string): boolean => {
  if (msg.content.toLowerCase().includes(query)) return true;
  return msg.children.some(c => messageMatchesSearch(c, query));
};

export const ChatView = ({ room, messages, loading, onVote, onReply, onNewThread }: ChatViewProps) => {
  const [sortMode, setSortMode] = useState<SortMode>("relevant");
  const [searchQuery, setSearchQuery] = useState("");
  const [newThreadText, setNewThreadText] = useState("");
  const [focusedMessage, setFocusedMessage] = useState<MessageData | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const msgs = q ? messages.filter(m => messageMatchesSearch(m, q)) : messages;
    return sortMessages(msgs, sortMode);
  }, [messages, searchQuery, sortMode]);

  const handleNewThread = () => {
    if (newThreadText.trim()) {
      onNewThread(newThreadText.trim());
      setNewThreadText("");
    }
  };

  const sortButtons: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
    { mode: "top", label: "Top", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { mode: "new", label: "New", icon: <Clock className="w-3.5 h-3.5" /> },
    { mode: "relevant", label: "Best", icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  if (focusedMessage) {
    return (
      <FocusView
        message={focusedMessage}
        onBack={() => setFocusedMessage(null)}
        onVote={onVote}
        onReply={onReply}
        onFocus={setFocusedMessage}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <span>{room.emoji}</span> {room.name}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Users className="w-3.5 h-3.5" /> {room.memberCount} members · {room.description}
            </p>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-md transition-colors ${showSearch ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search threads..." className="w-full bg-secondary rounded-md pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" autoFocus />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 mt-3">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {sortButtons.map(sb => (
            <button key={sb.mode} onClick={() => setSortMode(sb.mode)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${sortMode === sb.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              {sb.icon} {sb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageEmpty />
            <p className="mt-2 text-sm">{searchQuery ? "No threads match your search" : "No threads yet. Start one below!"}</p>
          </div>
        ) : (
          filtered.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg p-4 border border-border hover:border-primary/20 transition-colors">
              <ThreadMessage message={msg} depth={0} maxDepth={4} onVote={onVote} onReply={onReply} onFocus={setFocusedMessage} searchQuery={searchQuery} />
            </motion.div>
          ))
        )}
      </div>

      <div className="px-6 py-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <input value={newThreadText} onChange={e => setNewThreadText(e.target.value)} placeholder="Start a new thread..." className="flex-1 bg-secondary rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" onKeyDown={e => e.key === "Enter" && handleNewThread()} />
          <button onClick={handleNewThread} disabled={!newThreadText.trim()} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageEmpty = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-muted-foreground/30">
    <rect x="8" y="12" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
    <path d="M8 20h48" stroke="currentColor" strokeWidth="2" />
    <rect x="16" y="28" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
    <rect x="16" y="35" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
  </svg>
);
