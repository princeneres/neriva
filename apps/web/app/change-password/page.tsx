'use client';

import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconLockCheck } from '@tabler/icons-react';
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
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Password change failed');
      setBusy(false);
    }
  }

  return (
    <Center mih="100vh" bg="slate.0" p="md">
      <Paper w="100%" maw={420} p="xl" radius="lg" withBorder>
        <ThemeIcon size={44} radius="md" variant="light" mb="md">
          <IconLockCheck size={24} />
        </ThemeIcon>
        <Title order={2} fz="h3" mb={4}>
          Set a new password
        </Title>
        <Text c="slate.5" size="sm" mb="xl">
          For your security, you must replace the temporary password before continuing.
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap="md">
            {error ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />} radius="md">
                {error}
              </Alert>
            ) : null}
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            />
            <PasswordInput
              label="New password"
              description="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
            />
            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
            />
            <Button type="submit" loading={busy} fullWidth mt="xs">
              Save and continue
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
