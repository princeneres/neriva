import type { ReactNode } from 'react';
import { BoltMark } from './logo';
import styles from './fallback-screen.module.css';

// Shared chrome for the boundaries that sit outside the admin: the root
// not-found, the root error boundary and the public site's own not-found.
// Deliberately free of Mantine and of hooks, so the same component can be
// rendered from a server component (the 404s) and from a client one (the
// error boundary, which needs an onClick for `reset`).

export function FallbackScreen({
  code,
  title,
  description,
  reference,
  children,
}: {
  code?: string;
  title: string;
  description: string;
  reference?: string;
  children?: ReactNode;
}) {
  return (
    <main className={styles.screen}>
      <div className={styles.panel}>
        <BoltMark size={44} />
        {code ? <p className={styles.code}>{code}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children ? <div className={styles.actions}>{children}</div> : null}
        {reference ? (
          <p className={styles.reference}>
            If you need to report this, quote{' '}
            <code className={styles.referenceCode}>{reference}</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}

export function FallbackLink({
  href,
  variant = 'ghost',
  children,
}: {
  href: string;
  variant?: 'primary' | 'ghost';
  children: ReactNode;
}) {
  return (
    <a className={`${styles.action} ${styles[variant]}`} href={href}>
      {children}
    </a>
  );
}

export function FallbackButton({
  onClick,
  variant = 'primary',
  children,
}: {
  onClick: () => void;
  variant?: 'primary' | 'ghost';
  children: ReactNode;
}) {
  return (
    <button type="button" className={`${styles.action} ${styles[variant]}`} onClick={onClick}>
      {children}
    </button>
  );
}
