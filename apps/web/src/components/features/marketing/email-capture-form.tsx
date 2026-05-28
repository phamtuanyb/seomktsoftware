'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      toast.success('Đã lưu email. Chúng tôi sẽ gửi thông tin truy cập sớm cho bạn.');
      setEmail('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Nhập địa chỉ email của bạn"
        className="h-14 rounded-xl border border-white/20 bg-white/10 px-5 text-base text-white placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0"
        required
      />
      <Button
        type="submit"
        variant="accent"
        disabled={submitting}
        className="h-14 rounded-xl px-8 text-base font-semibold shadow-[0_12px_24px_rgba(249,115,22,0.22)]"
      >
        {submitting ? 'Đang gửi...' : 'Đăng ký'}
      </Button>
    </form>
  );
}
