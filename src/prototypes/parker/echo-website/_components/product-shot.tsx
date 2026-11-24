// The Echo app, recreated for the website: the feedback inbox under its top bar. It's a picture made of
// markup, so it stays sharp at any size and follows the theme, and it never links into the app prototype.
import CompanyLogo from './CompanyLogo';
import { PriorityIcon, StatusLabel, type Priority, type Status } from './marks';
import styles from './site.module.css';

const rows: { title: string; via: string; person: string; company: string; mrr: string; priority: Priority; status: Status }[] = [
  { title: 'Slack alerts for high-value accounts', via: 'Chat', person: 'Marcus Bell', company: 'Arcadia Bank', mrr: '$18.9k', priority: 'High', status: 'New' },
  { title: 'Export to CSV is missing columns', via: 'Email', person: 'Maya Chen', company: 'Northwind Labs', mrr: '$4.2k', priority: 'High', status: 'New' },
  { title: 'Dark mode makes the status badges hard to read', via: 'Chat', person: 'Luis Ortega', company: 'Brightline', mrr: '$1.9k', priority: 'Medium', status: 'Triaged' },
  { title: 'Let me bulk-assign items to a teammate', via: 'Interview', person: 'Priya Nair', company: 'Kestrel Health', mrr: '$12.4k', priority: 'High', status: 'Planned' },
  { title: 'Search should look inside the description', via: 'Survey', person: 'Tom Becker', company: 'Fieldnote', mrr: '$860', priority: 'Medium', status: 'New' },
  { title: 'Weekly digest should group by account', via: 'Email', person: 'Hannah Weiss', company: 'Kestrel Health', mrr: '$12.4k', priority: 'Medium', status: 'Triaged' },
];

export function EchoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="7" cy="12" r="3.5" fill="currentColor" />
      <path d="M13 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17.5 3.5a11.5 11.5 0 0 1 0 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function ProductShot() {
  return (
    <div className={styles.shot} role="img" aria-label="The Echo feedback inbox, with each request's priority, status, and account and its monthly revenue">
      <div className={styles.shotChrome}><span /><span /><span /></div>
      <div className={styles.shotBar}>
        <div className={styles.shotWorkspace}><span className={styles.shotLogo}><EchoMark /></span>Echo</div>
        <div className={styles.shotNav}>Overview</div>
        <div className={`${styles.shotNav} ${styles.shotNavOn}`}>Feedback inbox<span>12</span></div>
        <i className={styles.shotAvatar}>SR</i>
      </div>
      <div className={styles.shotBody}>
        <div className={styles.shotMain}>
          <div className={styles.shotHead}>
            <div>
              <div className={styles.shotTitle}>Feedback inbox</div>
              <div className={styles.shotSub}>Everything customers have told us, newest first.</div>
            </div>
            <span className={styles.shotButton}>+ New feedback</span>
          </div>
          <div className={styles.shotTable}>
            <div className={`${styles.shotRow} ${styles.shotRowHead}`}><span /><span>Feedback</span><span>Status</span><span>Customer</span><span>MRR</span></div>
            {rows.map((r) => (
              <div key={r.title} className={styles.shotRow}>
                <PriorityIcon priority={r.priority} />
                <span className={styles.shotFeedback}><b>{r.title}</b><small>via {r.via}</small></span>
                <StatusLabel status={r.status} />
                <span className={styles.shotPerson}><CompanyLogo company={r.company} className={styles.shotLogoMark} /><span>{r.company}</span></span>
                <span className={styles.count}>{r.mrr}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
