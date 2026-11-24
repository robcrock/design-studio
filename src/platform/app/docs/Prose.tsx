import type { ReactNode } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { markdownComponents } from '@/platform/app/docs/markdownComponents';
import { cn } from '#studio/runtime';

// Compiled Markdown, styled as a document with Tailwind Typography (the small size, 14px):
// https://github.com/tailwindlabs/tailwindcss-typography
// The plugin's class is `studio-prose`, so a system's own `prose` class never picks up its styles.
// `className` adjusts it for one place, like a smaller heading scale.
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MDXProvider components={markdownComponents}>
      <div
        className={cn(
          'studio-prose studio-prose-sm studio-prose-neutral dark:studio-prose-invert max-w-none studio-prose-headings:scroll-mt-8 studio-prose-h1:text-3xl studio-prose-h1:font-semibold studio-prose-h1:tracking-tight studio-prose-pre:border studio-prose-pre:border-border studio-prose-pre:bg-muted/50 studio-prose-pre:text-foreground studio-prose-code:before:content-none studio-prose-code:after:content-none',
          className,
        )}
      >
        {children}
      </div>
    </MDXProvider>
  );
}
