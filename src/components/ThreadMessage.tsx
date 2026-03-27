import { useState } from "react";
import { Message } from "@/types/replychain";
import { VoteButton } from "./VoteButton";
import { MessageSquare, ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ThreadMessageProps {
  message: Message;
  depth: number;
  maxDepth: number;
  onVote: (messageId: string, vote: 1 | -1) => void;
  onReply: (parentId: string, content: string) => void;
  onFocus: (message: Message) => void;
  searchQuery?: string;
}

const MAX_DEPTH = 4;

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

const highlightText = (text: string, query?: string) => {
  if (!query || !query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{part}</mark>
      : part
  );
};

export const ThreadMessage = ({ message, depth, maxDepth, onVote, onReply, onFocus, searchQuery }: ThreadMessageProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onReply(message.id, replyText.trim());
      setReplyText("");
      setReplying(false);
    }
  };

  const canNest = depth < maxDepth;

  return (
    <div className="group">
      <div className="flex gap-2">
        {depth > 0 && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="thread-line hover:thread-line-hover flex-shrink-0 w-0 ml-0 cursor-pointer transition-colors"
            aria-label={collapsed ? "Expand thread" : "Collapse thread"}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex gap-2">
            <VoteButton
              count={message.votesCount}
              userVote={message.userVote}
              onVote={(vote) => onVote(message.id, vote)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground flex-shrink-0">
                  {message.user.avatar}
                </div>
                <span className="text-sm font-medium text-foreground">{message.user.name}</span>
                <span className="text-xs text-muted-foreground">· {timeAgo(message.createdAt)}</span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed mb-1.5">
                {highlightText(message.content, searchQuery)}
              </p>
              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                {canNest && (
                  <button
                    onClick={() => setReplying(!replying)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" /> Reply
                  </button>
                )}
                <button
                  onClick={() => onFocus(message)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Maximize2 className="w-3 h-3" /> Focus
                </button>
                {message.children.length > 0 && (
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {collapsed ? `Show ${message.children.length} replies` : "Collapse"}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {replying && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
                      rows={2}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitReply();
                        if (e.key === "Escape") setReplying(false);
                      }}
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={handleSubmitReply} className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-md hover:opacity-90 transition-opacity">Reply</button>
                      <button onClick={() => setReplying(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {!collapsed && message.children.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 space-y-2 overflow-hidden"
                  >
                    {message.children.map(child => (
                      <ThreadMessage
                        key={child.id}
                        message={child}
                        depth={depth + 1}
                        maxDepth={maxDepth}
                        onVote={onVote}
                        onReply={onReply}
                        onFocus={onFocus}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
