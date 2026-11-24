import { ArrowDown01Icon, ArrowRight01Icon, LinkSquare02Icon, LibraryIcon } from '@hugeicons/core-free-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useManifest } from '@/platform/app/data/useManifest';
import { systemPath } from '#studio/systems';

import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/platform/systems/studio/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/platform/systems/studio/components/tooltip';
import { CodeBlock, PageHeader, SystemFrame } from '@/platform/modules/systems/pages/foundations';
import { Prose } from '@/platform/app/docs/Prose';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/platform/systems/studio/components/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/platform/systems/studio/components/table';
import { useDocsVersion, type ComponentPageData } from '@/platform/modules/systems/data/loadDocs';
import type { PropDoc, SystemComponentDoc } from '@/platform/modules/systems/docs';
import { shadcnDocsUrl } from '@/platform/modules/systems/sources';
import type { DesignSystem } from '@/platform/app/data/types';
import { ErrorBoundary } from 'react-error-boundary';
import { MDXProvider } from '@mdx-js/react';
import ViewError from '@/platform/app/files/FileError';

// One component's page in the Systems section, built from its files: the title and description
// and the Markdown page, then live examples, then its props read from the code. Whatever the
// component doesn't have yet is left out, with a note on the file to add.

// The page's Markdown headings match the page's own sections (18px, under the 26px title), not the
// 21px h2 the small prose size gives.
const PAGE_PROSE = 'studio-prose-h3:text-base';
const componentHeadings = {
  h2: ({ className = '', style, ...props }: React.ComponentProps<'h2'>) => (
    <h2
      {...props}
      className={`mt-12 mb-4 text-lg font-semibold tracking-tight text-foreground ${className}`}
      style={{ ...style, fontSize: '1.125rem', fontWeight: 600, lineHeight: '1.75rem' }}
    />
  ),
};

// "WithIcon" → "With icon".
const sentence = (name: string) =>
  name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
    .replace(/ ([A-Z])(?![A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='mt-12'>
      <h2 className='mb-4 text-lg font-semibold tracking-tight text-foreground'>{title}</h2>
      {children}
    </section>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className='text-sm text-muted-foreground'>{children}</p>
);

// One line of a table cell. If the cell is too narrow for it, it ends in an ellipsis and the whole
// text shows in a tooltip on hover or focus (only then: a text that fits needs none).
function Truncated({ children }: { children: string }) {
  // The trigger is a span (below), though the tooltip's types say button.
  const ref = useRef<HTMLButtonElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCut(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);
  return (
    <Tooltip disabled={!cut}>
      <TooltipTrigger
        ref={ref}
        render={
          <span
            tabIndex={cut ? 0 : undefined}
            className={`block max-w-full truncate outline-none ${cut ? 'cursor-help focus-visible:text-foreground' : ''}`}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-md font-mono text-xs break-words whitespace-normal'>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

// The columns keep fixed shares of the width, so a long type can't crowd out the others.
function PropsTable({ props }: { props: PropDoc[] }) {
  return (
    <div className='rounded-lg border border-border'>
      <Table className='table-fixed text-[13px]'>
        <TableHeader>
          <TableRow className='bg-muted/50 hover:bg-muted/50'>
            <TableHead className='w-[28%] px-3 text-xs text-muted-foreground'>Prop</TableHead>
            <TableHead className='w-[52%] px-3 text-xs text-muted-foreground'>Type</TableHead>
            <TableHead className='w-[20%] px-3 text-xs text-muted-foreground'>Default</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.map(p => (
            <TableRow key={p.name}>
              <TableCell className='px-3 py-2 align-top font-mono text-xs break-words whitespace-normal text-foreground'>
                {/* The description is a tooltip on the name (hover or focus), so the table stays short. */}
                {p.description ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span
                          tabIndex={0}
                          className='cursor-help underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground'
                        />
                      }
                    >
                      {p.name}
                    </TooltipTrigger>
                    <TooltipContent side='right' sideOffset={12} className='max-w-xs font-sans'>
                      {p.description}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  p.name
                )}
                {p.required && (
                  <span className='text-destructive' title='Required'>
                    {' '}
                    *
                  </span>
                )}
              </TableCell>
              <TableCell className='px-3 py-2 align-top font-mono text-xs text-foreground/90'>
                <Truncated>{p.type}</Truncated>
              </TableCell>
              <TableCell className='px-3 py-2 align-top font-mono text-xs text-muted-foreground'>
                {p.default ? <Truncated>{p.default}</Truncated> : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// A link from a page's frontmatter, if it's a web address (never javascript: or the like).
function webLink(url: string | null) {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

// `origin`
// is where the system's components come from: 'shadcn' links the page to that component's shadcn/ui
// docs when the shadcn library entry lists the component, unless its frontmatter gives a link of its own.
export function ComponentDocPage({
  system,
  sys,
  component,
  origin,
  loaded,
}: {
  system: string;
  sys: DesignSystem;
  component: SystemComponentDoc;
  loaded: ComponentPageData;
  origin: 'shadcn' | null;
}) {
  const { source, examples, doc } = component.files;
  const errors = loaded.errors;
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  // Credit only what this component declares: a library lists the components it supplies, so an adapted
  // system never credits its origin for components that came from somewhere else.
  const libraries = (useManifest().systems[system]?.libraries ?? []).filter(library =>
    library.components?.includes(component.slug),
  );
  const fromOrigin = libraries.some(library => library.id === origin);
  const version = useDocsVersion();
  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current !== version) {
      previousVersion.current = version;
      void router.invalidate();
    }
  }, [version, router]);

  const stem = (source ?? component.name).replace(/^.*\//, '').replace(/\.[jt]sx$/, '');
  const docsLink =
    webLink(component.docsUrl) ?? webLink(origin === 'shadcn' && fromOrigin && source ? shadcnDocsUrl(stem) : null);
  const filePath = source ?? doc ?? examples;
  const credited = libraries.length > 0 || Boolean(component.sourceNote) || Boolean(docsLink);
  const propCount = loaded.props?.reduce((total, item) => total + item.props.length, 0) ?? 0;
  const Doc = loaded.doc;
  return (
    <>
      <div className='relative'>
        <PageHeader title={component.title} description={component.description || undefined} />
      </div>
      {errors.length > 0 && (
        <div role='alert' className='space-y-2 rounded-md border border-border p-3 text-sm'>
          <p>Some component files couldn't load.</p>
          {errors.map(error => (
            <p key={error} className='text-muted-foreground'>
              {error}
            </p>
          ))}
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              setRetry(value => value + 1);
              void router.invalidate();
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {Doc ? (
        <ErrorBoundary resetKeys={[Doc, retry]} FallbackComponent={ViewError}>
          <Prose className={PAGE_PROSE}>
            <MDXProvider components={componentHeadings}>
              <Doc />
            </MDXProvider>
          </Prose>
        </ErrorBoundary>
      ) : (
        !doc && (
          <Note>
            No page yet. Add <code>{stem}.md</code> next to the component to describe it and say when to use it.
          </Note>
        )
      )}

      <Section title='Examples'>
        {!examples ? (
          <Note>
            No examples yet. Add <code>{stem}.examples.tsx</code> next to the component: each export named with a
            capital is one example.
          </Note>
        ) : (
          loaded.examples && (
            <>
              <div className='space-y-5'>
                {loaded.examples.map(({ name, Component }) => (
                  <div key={name}>
                    <h3 className='mb-2 text-xs font-medium text-muted-foreground'>{sentence(name)}</h3>
                    <SystemFrame>
                      <div className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-6'>
                        <ErrorBoundary resetKeys={[Component, retry]} FallbackComponent={ViewError}>
                          <Component />
                        </ErrorBoundary>
                      </div>
                    </SystemFrame>
                  </div>
                ))}
              </div>
              {loaded.source && (
                <Collapsible className='mt-4'>
                  <CollapsibleTrigger className='group flex cursor-pointer items-center gap-1.5 rounded-sm text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={14}
                      className='text-muted-foreground transition-transform group-not-data-panel-open:-rotate-90'
                    />
                    Show code
                  </CollapsibleTrigger>
                  <CollapsibleContent className='mt-2'>
                    <CodeBlock>{loaded.source}</CodeBlock>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )
        )}
      </Section>

      {filePath && (
        <Section title='Source'>
          <div className='flex items-start gap-3 rounded-lg border border-border p-4'>
            {/* The library icon belongs to a credit; a component from the team's own code shows only its file. */}
            {credited && (
              <HugeiconsIcon
                icon={LibraryIcon}
                aria-hidden='true'
                className='mt-0.5 size-4 shrink-0 text-muted-foreground'
              />
            )}
            <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3'>
              {credited && (
                <div className='min-w-0 flex-1 basis-56'>
                  {libraries.length > 0 && (
                    <div className='flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium'>
                      {libraries.map(library => (
                        <Link
                          key={library.id}
                          to={`${systemPath(system)}/libraries` as never}
                          hash={library.id}
                          className='inline-flex items-center gap-1 hover:underline'
                          aria-label={`${library.label} in Libraries`}
                        >
                          {library.label}
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            aria-hidden='true'
                            className='size-3.5 text-muted-foreground'
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                  {component.sourceNote && (
                    <p className={`${libraries.length ? 'mt-1 ' : ''}text-sm leading-6 text-muted-foreground`}>
                      {component.sourceNote}
                    </p>
                  )}
                </div>
              )}
              {docsLink && (
                <a
                  href={docsLink.href}
                  target='_blank'
                  rel='noreferrer'
                  className='ml-auto inline-flex items-center gap-1 text-sm underline underline-offset-4 hover:text-muted-foreground'
                >
                  Component docs <HugeiconsIcon icon={LinkSquare02Icon} aria-hidden='true' className='size-3.5' />
                </a>
              )}
              <p className='w-full break-all font-mono text-xs text-muted-foreground'>
                <span className='font-sans'>File: </span>
                {sys.dir}
                {filePath}
              </p>
            </div>
          </div>
        </Section>
      )}

      {source && loaded.props && (
        <section className='mt-12'>
          <Collapsible>
            <h2 className='text-lg font-semibold tracking-tight'>
              <CollapsibleTrigger className='group flex w-full cursor-pointer flex-wrap items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  className='text-muted-foreground transition-transform group-not-data-panel-open:-rotate-90'
                />
                <span className='text-lg font-semibold tracking-tight'>Props</span>
                <span className='text-xs text-muted-foreground'>
                  {loaded.props.length} {loaded.props.length === 1 ? 'component' : 'components'} · {propCount}{' '}
                  {propCount === 1 ? 'prop' : 'props'}
                </span>
              </CollapsibleTrigger>
            </h2>
            <CollapsibleContent className='mt-4'>
              <div className='space-y-6'>
                {loaded.props.map(c => (
                  <div key={c.name}>
                    {loaded.props!.length > 1 && <h3 className='mb-2 font-mono text-sm text-foreground'>{c.name}</h3>}
                    {c.props.length > 0 && <PropsTable props={c.props} />}
                    <p className={`text-sm text-muted-foreground ${c.props.length > 0 ? 'mt-2' : ''}`}>
                      {c.props.length === 0 && !c.native
                        ? 'No props.'
                        : c.native
                          ? `${c.props.length ? 'Also accepts' : 'Accepts'} every native attribute of the element it renders.`
                          : null}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}
    </>
  );
}
