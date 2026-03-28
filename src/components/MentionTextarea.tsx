import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ProfileRow = { username: string; display_name: string | null };

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  onSubmit?: () => void;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 2,
  disabled,
  onSubmit,
}: MentionTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [active, setActive] = useState(0);

  const load = useCallback(async (prefix: string) => {
    if (!prefix.length) {
      setItems([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name")
      .ilike("username", `${prefix}%`)
      .limit(8);
    setItems((data || []).filter((p): p is ProfileRow => !!p.username));
  }, []);

  const insertMention = (username: string) => {
    const ta = taRef.current;
    const pos = ta?.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const repl = before.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
    onChange(repl + after);
    setOpen(false);
    setItems([]);
    requestAnimationFrame(() => {
      ta?.focus();
      const len = (repl + after).length;
      ta?.setSelectionRange(len, len);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const match = before.match(/@([a-zA-Z0-9_]*)$/);
    if (match) {
      setOpen(true);
      setActive(0);
      void load(match[1]);
    } else {
      setOpen(false);
      setItems([]);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(items[active].username);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          "w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none",
          className
        )}
      />
      {open && items.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1"
          role="listbox"
        >
          {items.map((p, i) => (
            <li key={p.username}>
              <button
                type="button"
                role="option"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-secondary flex flex-col",
                  i === active && "bg-secondary"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(p.username)}
              >
                <span className="font-medium">@{p.username}</span>
                {p.display_name && (
                  <span className="text-xs text-muted-foreground truncate">{p.display_name}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
