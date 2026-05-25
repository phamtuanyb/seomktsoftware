'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  async function handle() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Button variant="outline" className="w-full justify-start" onClick={handle}>
      <LogOut className="mr-2 h-4 w-4" />
      Đăng xuất
    </Button>
  );
}
