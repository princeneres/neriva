'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAccessToken } from '../lib/auth-storage';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getAccessToken() ? '/admin' : '/login');
  }, [router]);

  return null;
}
