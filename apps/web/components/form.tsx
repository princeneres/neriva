'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="nv-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="nv-field-error">{error}</span> : null}
    </div>
  );
}

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return <button {...props} className="nv-button" data-variant={variant} />;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="nv-form-actions">{children}</div>;
}
