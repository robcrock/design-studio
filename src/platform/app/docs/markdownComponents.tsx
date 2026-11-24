import { getSystems } from '#studio/systems';
const SYSTEM_SPECS = getSystems();
import { useContext, type ComponentProps } from 'react';
import { Link } from '@tanstack/react-router';
import type { MDXComponents } from 'mdx/types';
import { DocBase } from '@/platform/app/docs/DocBase';
import { markdownPath } from './referenceLinks';
import ArtifactEmbed from '@/platform/app/artifacts/ArtifactEmbed';
import { MermaidDiagram } from '@/platform/app/diagrams/MermaidDiagram';
import { useManifest } from '@/platform/app/data/useManifest';
import { sourceArtifactPath } from '@/platform/app/artifacts/artifactLinks';

const systemIdentities = Object.fromEntries(Object.entries(SYSTEM_SPECS).map(([key, spec]) => [key, spec.studioId!]));

// Styling for Markdown comes from Tailwind Typography's `studio-prose` classes (see Prose).
// This map covers only what CSS can't: app links navigate without a reload, and
// outside links open in a new tab. In a prototype document, a link like ./main or
// ../lofi/main.tsx is relative to the document, so it keeps working if the prototype's
// folder is renamed. (Moving the document or the file it points to still breaks it.)
function MarkdownLink({ href = '', ...props }: ComponentProps<'a'>) {
  const base = useContext(DocBase);
  const manifest = useManifest();
  if (href.startsWith('/') && !href.startsWith('//')) {
    const url = new URL(href, 'http://doc');
    return (
      <Link
        to={(sourceArtifactPath(manifest, url.pathname) ?? markdownPath(url.pathname, systemIdentities)) as never}
        search={Object.fromEntries(url.searchParams) as never}
        hash={url.hash.slice(1) || undefined}
        {...props}
      />
    );
  }
  if (href.startsWith('#')) return <a href={href} {...props} />;
  if (base !== null && !href.startsWith('?') && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
    const url = new URL(href, `http://doc${base}/`);
    const path = markdownPath(url.pathname, systemIdentities);
    const to = sourceArtifactPath(manifest, url.pathname) ?? path;
    return (
      <Link
        to={to as never}
        search={Object.fromEntries(url.searchParams) as never}
        hash={url.hash.slice(1) || undefined}
        {...props}
      />
    );
  }
  return <a href={href} target='_blank' rel='noopener noreferrer' {...props} />;
}

export const markdownComponents: MDXComponents = {
  a: MarkdownLink,
  'mermaid-diagram': MermaidDiagram,
  'prototype-artifact': ArtifactEmbed,
};
