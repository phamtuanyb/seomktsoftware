'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, AuthClientError } from '@/lib/api/auth';

const schema = z.object({
  password: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .regex(/[a-z]/, 'Cần ≥1 chữ thường')
    .regex(/[A-Z]/, 'Cần ≥1 chữ hoa')
    .regex(/\d/, 'Cần ≥1 chữ số'),
});
type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: FormValues) {
    if (!token) {
      toast.error('Token đặt lại mật khẩu thiếu hoặc không hợp lệ');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, values.password);
      toast.success('Đặt lại mật khẩu thành công, vui lòng đăng nhập');
      router.replace('/login');
    } catch (err) {
      const message =
        err instanceof AuthClientError ? err.message : 'Token không hợp lệ hoặc đã hết hạn';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu mới</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting || !token}>
        {submitting ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
      </Button>
    </form>
  );
}
