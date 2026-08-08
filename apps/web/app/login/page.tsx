'use client';

import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconArrowRight } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { BoltMark, NerivaLogo } from '../../components/logo';
import { ApiError, login } from '../../lib/api';
import { saveTokens } from '../../lib/auth-storage';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await login(email, password);
      saveTokens(data);
      router.replace(data.mustChangePassword ? '/change-password' : '/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <Box style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Brand panel */}
      <Box
        visibleFrom="md"
        style={{
          width: '44%',
          background: '#1a1917',
          color: '#faf9f7',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '3rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box style={{ position: 'absolute', right: -80, bottom: -110, opacity: 0.08 }}>
          <BoltMark size={520} color="#faf9f7" />
        </Box>
        <NerivaLogo size={30} textColor="#faf9f7" />
        <Box style={{ position: 'relative' }}>
          <Title
            order={1}
            style={{
              fontSize: '2.6rem',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-display)',
            }}
          >
            Content, without
            <br />
            the heavy machinery.
          </Title>
          <Text mt="md" c="#a8a49b" maw={380}>
            Pages built from blocks, structured content, and a style book. Everything through one
            API.
          </Text>
        </Box>
        <Text size="xs" c="#5c5850">
          Neriva CMS
        </Text>
      </Box>

      {/* Form panel */}
      <Center style={{ flex: 1, padding: '2rem' }}>
        <Paper w="100%" maw={400} p="xl" radius="lg" withBorder={false}>
          <Box hiddenFrom="md" mb="xl">
            <NerivaLogo size={28} />
          </Box>
          <Title order={2} fz="h3" mb={4}>
            Welcome back
          </Title>
          <Text c="slate.5" size="sm" mb="xl">
            Sign in to manage your content.
          </Text>

          <form onSubmit={onSubmit}>
            <Stack gap="md">
              {error ? (
                <Alert color="red" icon={<IconAlertCircle size={16} />} radius="md">
                  {error}
                </Alert>
              ) : null}
              <TextInput
                label="Email"
                type="email"
                autoComplete="username"
                required
                size="md"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                required
                size="md"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <Group justify="flex-end" mt="xs">
                <Button
                  type="submit"
                  size="md"
                  loading={busy}
                  rightSection={<IconArrowRight size={16} />}
                  fullWidth
                >
                  Sign in
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Center>
    </Box>
  );
}
