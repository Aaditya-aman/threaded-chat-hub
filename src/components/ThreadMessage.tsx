import { useState, useRef, type ReactNode } from "react";
import { MessageData, AttachmentPayload } from "@/pages/Index";
import { VoteButton } from "./VoteButton";
import { MentionTextarea } from "./MentionTextarea";
import { getAttachmentPublicUrl, isImageMime, uploadAttachment } from "@/lib/attachments";
import {
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Pin,
  Link2,
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ThreadMessageProps {
  message: MessageData;
  depth: number;
  maxDepth: number;
  roomId: string;
  onVote: (messageId: string, vote: 1 | -1) => void;
  onReply: (
    parentId: string,
    content: string,
    attachment?: AttachmentPayload | null
  ) => void | Promise<void>;
  onFocus: (message: MessageData) => void;
  searchQuery?: string;
  highlightMessageId?: string | null;
  isRoomOwner?: boolean;
  onTogglePin?: (messageId: string) => void | Promise<void>;
  onScrollToMessage?: (messageId: string) => void;
}

const timeAgo = (dateStr: string) => {
  const mins = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 60000
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

function highlightSearchInText(text: string, query?: string): ReactNode {
  if (!query || !query.trim()) return text;
  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  );
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        className="bg-primary/30 text-foreground rounded px-0.5"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function renderContentWithMentions(
  content: string,
  mentionSet: Set<string>,
  searchQuery?: string
) {
  const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const u = part.slice(1).toLowerCase();
      if (mentionSet.has(u)) {
        return (
          <span
            key={i}
            className="text-primary font-medium bg-primary/10 rounded px-0.5"
          >
            {part}
          </span>
        );
      }
    }
    return (
      <span key={i}>{highlightSearchInText(part, searchQuery)}</span>
    );
  });
}

export const ThreadMessage = ({
  message,
  depth,
  maxDepth,
  roomId,
  onVote,
  onReply,
  onFocus,
  searchQuery,
  highlightMessageId,
  isRoomOwner,
  onTogglePin,
  onScrollToMessage,
}: ThreadMessageProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replySending, setReplySending] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const mentionSet = new Set(message.mentionedUsernames || []);

  const handleSubmitReply = async () => {
    if ((!replyText.trim() && !replyFile) || replySending) return;
    setReplySending(true);
    try {
      let attachment: AttachmentPayload | undefined;
      if (replyFile) attachment = await uploadAttachment(roomId, replyFile);
      await onReply(message.id, replyText.trim(), attachment);
      setReplyText("");
      setReplyFile(null);
      setReplying(false);
    } finally {
      setReplySending(false);
    }
  };

  const copyThreadLink = async () => {
    const url = `${window.location.origin}/room/${roomId}/thread/${message.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const canNest = depth < maxDepth;
  const displayName =
    message.profile?.display_name || message.profile?.username || "Unknown";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const username = message.profile?.username;

  const attachmentUrl = message.attachment_url
    ? getAttachmentPublicUrl(message.attachment_url)
    : null;
  const isImage = isImageMime(message.attachment_type);

  const isHighlighted = highlightMessageId === message.id;

  return (
    <div
      className={`group rounded-md transition-colors ${isHighlighted ? "message-flash-highlight" : ""}`}
      data-message-id={message.id}
    >
      <div className="flex gap-2">
        {depth > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="thread-line hover:thread-line-hover flex-shrink-0 w-0 ml-0 cursor-pointer transition-colors"
            aria-label={collapsed ? "Expand thread" : "Collapse thread"}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex gap-2">
            <VoteButton
              count={message.votes_count}
              userVote={message.userVote as 1 | -1 | 0}
              onVote={(vote) => onVote(message.id, vote)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => username && navigate(`/profile/${username}`)}
                  className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground flex-shrink-0 hover:ring-1 hover:ring-primary transition-all cursor-pointer"
                >
                  {initials}
                </button>
                <button
                  type="button"
                  onClick={() => username && navigate(`/profile/${username}`)}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  {displayName}
                </button>
                <span className="text-xs text-muted-foreground">
                  · {timeAgo(message.created_at)}
                </span>
                {message.is_pinned && depth === 0 && (
                  <Pin className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                )}
              </div>

              {depth > 0 && message.parent_id && onScrollToMessage && (
                <button
                  type="button"
                  onClick={() => onScrollToMessage(message.parent_id!)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-1"
                >
                  <ArrowUp className="w-3 h-3" /> Parent message
                </button>
              )}

              {message.content.trim().length > 0 && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-1.5 whitespace-pre-wrap break-words">
                  {renderContentWithMentions(
                    message.content,
                    mentionSet,
                    searchQuery
                  )}
                </p>
              )}

              {attachmentUrl && (
                <div className="mb-2">
                  {isImage ? (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-md overflow-hidden border border-border max-w-xs"
                    >
                      <img
                        src={attachmentUrl}
                        alt=""
                        className="max-h-48 w-auto object-contain"
                      />
                    </a>
                  ) : (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      Open attachment
                    </a>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                {canNest && (
                  <button
                    type="button"
                    onClick={() => setReplying(!replying)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" /> Reply
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onFocus(message)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Maximize2 className="w-3 h-3" /> Focus
                </button>
                <button
                  type="button"
                  onClick={copyThreadLink}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Link2 className="w-3 h-3" /> Copy link
                </button>
                {depth === 0 && isRoomOwner && onTogglePin && (
                  <button
                    type="button"
                    onClick={() => void onTogglePin(message.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pin className="w-3 h-3" />{" "}
                    {message.is_pinned ? "Unpin" : "Pin"}
                  </button>
                )}
                {message.children.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {collapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {collapsed
                      ? `Show ${message.children.length} replies`
                      : "Collapse"}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {replying && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 overflow-hidden space-y-2"
                  >
                    <p className="text-xs text-muted-foreground border-l-2 border-primary/50 pl-2">
                      Replying to{" "}
                      <span className="font-medium text-foreground">
                        {displayName}
                      </span>
                      {message.content.trim().slice(0, 80)}
                      {message.content.length > 80 ? "…" : ""}
                    </p>
                    <input
                      ref={replyFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,application/pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        setReplyFile(e.target.files?.[0] || null);
                        e.target.value = "";
                      }}
                    />
                    {replyFile && (
                      <p className="text-xs text-muted-foreground truncate">
                        {replyFile.name}
                      </p>
                    )}
                    <div className="flex gap-2 items-end">
                      <button
                        type="button"
                        onClick={() => replyFileRef.current?.click()}
                        className="p-2 rounded-md bg-secondary shrink-0"
                        title="Attach"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <MentionTextarea
                          value={replyText}
                          onChange={setReplyText}
                          placeholder="Write a reply… @mention"
                          rows={2}
                          disabled={replySending}
                          onSubmit={handleSubmitReply}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => void handleSubmitReply()}
                        disabled={
                          (!replyText.trim() && !replyFile) || replySending
                        }
                        className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        {replySending && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplying(false);
                          setReplyFile(null);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
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
                    {message.children.map((child) => (
                      <ThreadMessage
                        key={child.id}
                        message={child}
                        depth={depth + 1}
                        maxDepth={maxDepth}
                        roomId={roomId}
                        onVote={onVote}
                        onReply={onReply}
                        onFocus={onFocus}
                        searchQuery={searchQuery}
                        highlightMessageId={highlightMessageId}
                        isRoomOwner={isRoomOwner}
                        onTogglePin={onTogglePin}
                        onScrollToMessage={onScrollToMessage}
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
