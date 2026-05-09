import { useRef } from 'react';
import { Bold, Code2, Eraser, FileImage, Italic, Link2, List, ListOrdered, Underline } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FormSelect } from '../ui/FormSelect';

type MarkdownNode = {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
};

export function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="markdown-block">
      <ReactMarkdown
        components={{
          code({ children, className }) {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <pre className="markdown-block__code">
                  <code>{children}</code>
                </pre>
              );
            }

            return <code className="markdown-block__inline">{children}</code>;
          },
        }}
        remarkPlugins={[remarkGfm, remarkUnderline]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function constraintItemsFromMarkdown(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, "").trim().replace(/^`+|`+$/g, "").trim())
    .filter(Boolean);
}

export function remarkUnderline() {
  return (tree: MarkdownNode) => {
    transformUnderlineNodes(tree);
  };
}

export function transformUnderlineNodes(node: MarkdownNode) {
  if (!node.children) {
    return;
  }

  const nextChildren: MarkdownNode[] = [];

  node.children.forEach((child) => {
    if (child.type === "text" && child.value?.includes("++")) {
      nextChildren.push(...splitUnderlineText(child.value));
      return;
    }

    transformUnderlineNodes(child);
    nextChildren.push(child);
  });

  node.children = nextChildren;
}

export function splitUnderlineText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const pattern = /\+\+([\s\S]+?)\+\+/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", value: value.slice(cursor, match.index) });
    }

    nodes.push({
      type: "underline",
      data: {
        hName: "u",
      },
      children: [{ type: "text", value: match[1] }],
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    nodes.push({ type: "text", value: value.slice(cursor) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", value }];
}

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="min-h-[108px] p-3 text-[14px] leading-6 text-[var(--text-secondary)]">
      {content.trim() ? (
        <ReactMarkdown
          components={{
            code({ children, className }) {
              const isBlock = (className ?? "").includes("language-");
              if (isBlock) {
                return (
                  <pre className="my-2 overflow-auto rounded-lg bg-slate-950 p-3 text-[12px] leading-5 text-slate-100">
                    <code>{children}</code>
                  </pre>
                );
              }

              return (
                <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 font-mono text-[12px] text-[var(--text-primary)]">
                  {children}
                </code>
              );
            },
            a({ children, href }) {
              return (
                <a className="font-semibold text-[#3B82F6] underline-offset-2 hover:underline" href={href}>
                  {children}
                </a>
              );
            },
          }}
          remarkPlugins={[remarkGfm, remarkUnderline]}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-[var(--text-muted)]">Preview will appear here.</p>
      )}
    </div>
  );
}

export type MarkdownEditorProps = {
  activeTab: "write" | "preview";
  onChange: (value: string) => void;
  onTabChange: (tab: "write" | "preview") => void;
  value: string;
};

export function MarkdownEditor({ activeTab, onChange, onTabChange, value }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function updateSelection(nextValue: string, selectionStart: number, selectionEnd = selectionStart) {
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function withSelection(format: (selected: string) => { text: string; cursorStart?: number; cursorEnd?: number }) {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(selectionStart, selectionEnd);
    const formatted = format(selected);
    const nextValue = `${value.slice(0, selectionStart)}${formatted.text}${value.slice(selectionEnd)}`;
    const cursorStart = selectionStart + (formatted.cursorStart ?? formatted.text.length);
    const cursorEnd = selectionStart + (formatted.cursorEnd ?? formatted.cursorStart ?? formatted.text.length);

    updateSelection(nextValue, cursorStart, cursorEnd);
  }

  function prefixLines(prefixer: (index: number) => string) {
    withSelection((selected) => {
      const fallback = "List item";
      const lines = (selected || fallback).split(/\r?\n/);
      return {
        text: lines.map((line, index) => `${prefixer(index)}${line.replace(/^([-*]|\d+\.)\s+/, "")}`).join("\n"),
      };
    });
  }

  function stripFormatting(text: string) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\+\+([\s\S]+?)\+\+/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^([-*]|\d+\.)\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  }

  function applyFormat(format: string) {
    onTabChange("write");

    if (format === "heading") {
      withSelection((selected) => ({ text: `## ${selected || "Heading"}` }));
      return;
    }

    if (format === "inline-code") {
      withSelection((selected) => ({ text: `\`${selected || "code"}\`` }));
      return;
    }

    if (format === "code-block") {
      withSelection((selected) => ({ text: `\n\`\`\`\n${selected || "code"}\n\`\`\`\n` }));
    }
  }

  const toolbarActions = [
    {
      label: "Bold",
      icon: Bold,
      action: () => withSelection((selected) => ({ text: `**${selected || "bold text"}**` })),
    },
    {
      label: "Italic",
      icon: Italic,
      action: () => withSelection((selected) => ({ text: `*${selected || "italic text"}*` })),
    },
    {
      label: "Underline",
      icon: Underline,
      action: () => withSelection((selected) => ({ text: `++${selected || "underlined text"}++` })),
    },
    {
      label: "Bullet list",
      icon: List,
      action: () => prefixLines(() => "- "),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      action: () => prefixLines((index) => `${index + 1}. `),
    },
    {
      label: "Link",
      icon: Link2,
      action: () => withSelection((selected) => ({ text: `[${selected || "link text"}](https://example.com)` })),
    },
    {
      label: "Image",
      icon: FileImage,
      action: () => withSelection((selected) => ({ text: `![${selected || "alt text"}](https://example.com/image.png)` })),
    },
    {
      label: "Code block",
      icon: Code2,
      action: () => applyFormat("code-block"),
    },
    {
      label: "Clear formatting",
      icon: Eraser,
      action: () =>
        withSelection((selected) => {
          const source = selected || value;
          const cleaned = stripFormatting(source);
          return { text: cleaned };
        }),
    },
  ];
  const editorFormatOptions = [
    { label: "Paragraph", value: "paragraph" },
    { label: "Heading", value: "heading" },
    { label: "Inline code", value: "inline-code" },
    { label: "Code block", value: "code-block" },
  ] as const;

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]">
      <div className="flex items-end gap-4 border-b border-[var(--border)] px-3 pt-2">
        {(["write", "preview"] as const).map((tab) => (
          <button
            className={`border-b-2 px-1 pb-2 text-[13px] font-semibold capitalize ${
              activeTab === tab
                ? "border-[#3B82F6] text-[#3B82F6]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            key={tab}
            onClick={() => onTabChange(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        <FormSelect
          ariaLabel="Editor format"
          className="h-8 w-32 text-[12px]"
          options={editorFormatOptions}
          value="paragraph"
          onValueChange={(value) => {
            if (value !== "paragraph") {
              applyFormat(value);
            }
          }}
        />
        {toolbarActions.map(({ action, icon: Icon, label }) => (
          <button
            aria-label={label}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:h-8 md:w-8"
            key={label}
            onClick={action}
            type="button"
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      {activeTab === "write" ? (
        <textarea
          ref={textareaRef}
          aria-label="Problem description markdown"
          className="!min-h-[132px] !w-full resize-y !rounded-none !border-0 !bg-[var(--bg-card)] !p-3 text-[14px] !text-[var(--text-primary)] !shadow-none outline-none placeholder:text-[var(--text-muted)] focus:!ring-0"
          placeholder="Describe the problem in markdown..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <MarkdownPreview content={value} />
      )}
    </section>
  );
}
