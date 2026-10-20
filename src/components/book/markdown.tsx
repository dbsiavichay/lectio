"use client";

import { Fragment, memo, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import { RefChip } from "./ref-chip";

const REF = /\[\[([^\]]+)\]\]/g;
const REF_PROTOCOL = "lectio-ref:";

const components: Components = {
  a({ href, children }) {
    if (href?.startsWith(REF_PROTOCOL))
      return <RefChip refText={decodeURIComponent(href.slice(REF_PROTOCOL.length))} />;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
        {children}
      </blockquote>
    );
  },
};

const inlineComponents: Components = {
  ...components,
  p: ({ children }) => <Fragment>{children}</Fragment>,
};

/**
 * Notebook Markdown, with book references (`[[Cap. 1 › Sección]]`) turned
 * into tappable chips. Raw HTML in the source is never rendered.
 */
export const Markdown = memo(function Markdown({
  md,
  inline = false,
  className,
}: {
  md: string;
  inline?: boolean;
  className?: string;
}): ReactNode {
  const source = md.replace(
    REF,
    (_, ref: string) => `[${ref}](${REF_PROTOCOL}${encodeURIComponent(ref)})`,
  );
  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={(url) => (url.startsWith(REF_PROTOCOL) ? url : defaultUrlTransform(url))}
      components={inline ? inlineComponents : components}
    >
      {source}
    </ReactMarkdown>
  );
  return inline ? (
    <span className={className}>{body}</span>
  ) : (
    <div className={cn("prose-reading", className)}>{body}</div>
  );
});
