import Markdown, { type Components } from "react-markdown";

const ALLOWED_PROTOCOLS = /^(?:https:|mailto:)/i;

/**
 * Only https, mailto and same-site absolute paths survive. Everything else
 * (javascript:, data:, protocol-relative //host) becomes an inert empty href.
 */
export function safeMarkdownUrl(url: string): string {
  const trimmed = url.trim();

  if (ALLOWED_PROTOCOLS.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  return "";
}

const components: Components = {
  a: ({ children, href }) =>
    href ? (
      <a
        className="font-semibold text-[var(--accent-strong)] underline underline-offset-2"
        href={href}
        rel={href.startsWith("/") ? undefined : "noopener noreferrer nofollow"}
        target={href.startsWith("/") ? undefined : "_blank"}
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

export function SafeMarkdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div
      className={`space-y-4 leading-7 [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h3]:mt-6 [&_h3]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:space-y-2 ${className}`}
    >
      <Markdown
        components={components}
        disallowedElements={["img", "iframe", "script", "style"]}
        skipHtml
        unwrapDisallowed
        urlTransform={safeMarkdownUrl}
      >
        {children}
      </Markdown>
    </div>
  );
}
