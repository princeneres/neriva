'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ApiError, changePassword } from '../../lib/api';
import { saveTokens } from '../../lib/auth-storage';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await changePassword(currentPassword, newPassword);
      saveTokens(data);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Password change failed');
      setBusy(false);
    }
  }

  return (
    <main className="nv-auth-page">
      <form className="nv-auth-card" onSubmit={onSubmit}>
        <div className="nv-brand">Neriva</div>
        <h1>Change your password</h1>
        <p>You must set a new password before continuing.</p>
        {error ? <div className="nv-error">{error}</div> : null}
        <div className="nv-field">
          <label htmlFor="current">Current password</label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="nv-field">
          <label htmlFor="new">New password</label>
          <input
            id="new"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="nv-field">
          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button className="nv-button" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </main>
  );
}
