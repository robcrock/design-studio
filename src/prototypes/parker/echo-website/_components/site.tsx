// Echo's homepage, shared by the two directions: `tone` picks a cobalt or a light hero, and `hero`
// carries the values home.tsx tunes with DialKit. Everything below the hero is the same in both.
import type { CSSProperties } from 'react';
import { ArrowRight } from '@/systems/marketing/libraries/icons';
import { buttonVariants } from '@/systems/marketing/components/button';
import { cn } from '#studio/runtime';
import CompanyLogo from './CompanyLogo';
import { StatusLabel, type Status } from './marks';
import { EchoMark, ProductShot } from './product-shot';
import styles from './site.module.css';

export type HeroTuning = { titleSize: number; shotOverlap: number };

const sources = [
  { name: 'Email', count: 128 },
  { name: 'Chat', count: 94 },
  { name: 'Calls', count: 41 },
  { name: 'Surveys', count: 67 },
];
const roadmap = [
  { title: 'Bulk-assign to a teammate', mrr: '$38k' },
  { title: 'Import keeps line breaks', mrr: '$27k' },
  { title: 'Vote on planned items', mrr: '$21k' },
];
const accountStats = [
  { label: 'MRR', value: '$18.9k' },
  { label: 'Seats', value: '240' },
  { label: 'Requests', value: '4' },
];
const accountAsks: { title: string; via: string; status: Status }[] = [
  { title: 'Slack alerts for high-value accounts', via: 'Chat', status: 'New' },
  { title: 'Import from a spreadsheet drops line breaks', via: 'Email', status: 'Planned' },
  { title: 'SSO for contractor accounts', via: 'Interview', status: 'Triaged' },
  { title: 'Export an audit log of changes', via: 'Email', status: 'Resolved' },
];
const steps = [
  { n: '01', title: 'Connect your channels', text: 'Forward an inbox, add the Slack app, or paste notes from a call. Echo keeps the customer’s own words.' },
  { n: '02', title: 'Match feedback to accounts', text: 'Every request is linked to the company behind it, with its plan and revenue from your CRM.' },
  { n: '03', title: 'Decide and close the loop', text: 'Rank requests by reach and revenue, plan the work, and tell every customer when it ships.' },
];

function Header({ onBrand }: { onBrand: boolean }) {
  return (
    <header className={styles.header}>
      <a href="#top" className={styles.brand}><EchoMark className={styles.brandMark} />Echo</a>
      <nav className={styles.nav}>
        <a href="#product">Product</a>
        <a href="#customers">Customers</a>
        <a href="#how">How it works</a>
      </nav>
      <div className={styles.headerActions}>
        <a href="#start" className={cn(styles.signIn)}>Sign in</a>
        <a href="#start" className={cn(buttonVariants({ size: 'sm' }), onBrand && styles.buttonOnBrand)}>Start free</a>
      </div>
    </header>
  );
}

export function EchoHome({ tone, hero }: { tone: 'cobalt' | 'light'; hero?: HeroTuning }) {
  const onBrand = tone === 'cobalt';
  const vars = hero && ({ '--hero-title': `${hero.titleSize}px`, '--shot-overlap': `${hero.shotOverlap}px` } as CSSProperties);
  return (
    <div id="top" className={styles.page} style={vars}>
      <section className={cn(styles.hero, onBrand ? styles.heroCobalt : styles.heroLight)}>
        <Header onBrand={onBrand} />
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle}>Hear every customer.{!onBrand && <><br /><span className={styles.accent}>Build what matters.</span></>}</h1>
          <p className={styles.heroLede}>Echo brings feedback from email, chat, calls, and surveys into one inbox, tied to the accounts behind it, so your team builds what matters next.</p>
          <div className={styles.heroActions}>
            <a href="#start" className={cn(buttonVariants({ size: 'lg' }), onBrand && styles.buttonOnBrand)}>Start free <ArrowRight /></a>
            <a href="#how" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), onBrand && styles.outlineOnBrand)}>See how it works</a>
          </div>
        </div>
        <div className={styles.shotWrap}><ProductShot /></div>
      </section>

      <section id="product" className={styles.section}>
        <h2 className={styles.sectionTitle}>Every channel, every account, one place to decide.</h2>
        <div className={styles.bento}>
          <article className={cn(styles.card, styles.cardLarge)}>
            <div className={styles.cardText}>
              <h3>Know who is asking</h3>
              <p>Each request carries its account, plan, and revenue, so the loudest voice isn’t the only one heard.</p>
            </div>
            <div className={styles.accountPanel}>
              <div className={styles.account}>
                <CompanyLogo company="Arcadia Bank" className={styles.accountLogo} />
                <div><b>Arcadia Bank</b><small>Enterprise plan · Renews in March</small></div>
                <span className={styles.tagBrand}>Key account</span>
              </div>
              <dl className={styles.accountStats}>
                {accountStats.map((s) => (
                  <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
                ))}
              </dl>
              <ul className={styles.accountAsks}>
                {accountAsks.map((a) => (
                  <li key={a.title}><span>{a.title}<small>via {a.via}</small></span><StatusLabel status={a.status} /></li>
                ))}
              </ul>
            </div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardText}>
              <h3>Capture it where it’s said</h3>
              <p>Support threads, sales calls, and surveys land in one inbox, in the customer’s own words.</p>
            </div>
            <div className={styles.sources}>
              {sources.map((s) => (
                <div key={s.name} className={styles.sourceRow}><span>{s.name}</span><span className={styles.sourceBar}><i style={{ width: `${(s.count / 128) * 100}%` }} /></span><span className={styles.count}>{s.count}</span></div>
              ))}
            </div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardText}>
              <h3>Plan with the full picture</h3>
              <p>Rank what to build by reach and revenue, then tell every customer when it ships.</p>
            </div>
            <div className={styles.roadmap}>
              {roadmap.map((r) => (
                <div key={r.title} className={styles.roadmapRow}><span className={styles.roadmapDot} /><span className={styles.roadmapTitle}>{r.title}</span><span className={styles.count}>{r.mrr}</span></div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section id="customers" className={styles.quote}>
        <figure>
          <blockquote>“We used to plan around whoever shouted last. Now every roadmap review starts with who is asking and what they’re worth to us.”</blockquote>
          <figcaption><span className={styles.quoteAvatar}>DO</span><span><b>Dana Okafor</b>Head of product, Fernway</span></figcaption>
        </figure>
      </section>

      <section id="how" className={cn(styles.section, styles.sectionTinted)}>
        <div className={styles.how}>
          <div className={styles.howIntro}>
            <h2 className={styles.sectionTitle}>Up and running in an afternoon.</h2>
            <p>No migration project. Point Echo at the places customers already talk to you, and the inbox fills itself.</p>
          </div>
          <ol className={styles.steps}>
            {steps.map((s) => (
              <li key={s.n}><span className={styles.stepNumber}>{s.n}</span><div><h3>{s.title}</h3><p>{s.text}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="start" className={styles.closing}>
        <h2>Build what your customers are asking for.</h2>
        <p>Free for teams of up to five. No credit card.</p>
        <a href="#top" className={cn(buttonVariants({ size: 'lg' }), styles.buttonOnBrand)}>Start free <ArrowRight /></a>
      </section>

      <footer className={styles.footer}>
        <span className={styles.brand}><EchoMark className={styles.brandMark} />Echo</span>
        <span className={styles.muted}>Echo is a fictional product, made for Design Studio’s examples.</span>
      </footer>
    </div>
  );
}
