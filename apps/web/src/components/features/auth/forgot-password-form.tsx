'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';

const schema = z.object({ email: z.string().email('Email không hợp lệ') });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  async function onSubmit(values: FormValues) {
    try {
      await authApi.forgotPassword(values.email);
      setSubmitted(true);
    } catch {
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <p>Nếu email tồn tại, hệ thống đã gửi link đặt lại mật khẩu</p>
        <Link href="/login" className="text-sm text-brand hover:underline">
          Quay về đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        Gửi link đặt lại mật khẩu
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand hover:underline">
          ← Quay về đăng nhập
        </Link>
      </p>
    </form>
  );
}
