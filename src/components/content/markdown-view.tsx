export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose max-w-none text-[var(--color-ink)]">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[var(--color-ink)]">{content}</pre>
    </div>
  );
}
