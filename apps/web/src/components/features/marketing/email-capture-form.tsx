'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Sprint 2 lead-capture form. Stores submissions in localStorage until the
 * marketing backend endpoint exists (Sprint 3+) — gives us click-through data
 * and confirmation UX without a missing API call.
 */
export function EmailCaptureForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Email không hợp lệ');
      return;
    }
    setSubmitting(true);
    try {
      const leads = JSON.parse(localStorage.getItem('mkt-seo-leads') ?? '[]') as string[];
      if (!leads.includes(email)) leads.push(email);
      localStorage.setItem('mkt-seo-leads', JSON.stringify(leads));
      toast.success('Cảm ơn! Chúng tôi sẽ gửi email cho bạn sớm nhất.');
      setEmail('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ban@example.com"
        className="flex-1"
        required
      />
      <Button type="submit" variant="accent" disabled={submitting}>
        {submitting ? 'Đang gửi…' : 'Đăng ký'}
      </Button>
    </form>
  );
}
