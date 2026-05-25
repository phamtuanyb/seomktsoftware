'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, AuthClientError } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';

const schema = z.object({
  name: z.string().min(1, 'Vui lòng nhập họ tên').max(255).optional().or(z.literal('')),
  email: z.string().email('Email không hợp lệ').max(255),
  password: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .max(72)
    .regex(/[a-z]/, 'Mật khẩu cần ≥1 chữ thường')
    .regex(/[A-Z]/, 'Mật khẩu cần ≥1 chữ hoa')
    .regex(/\d/, 'Mật khẩu cần ≥1 chữ số'),
});
type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await authApi.register({
        email: values.email,
        password: values.password,
        name: values.name || undefined,
      });
      setUser(res.user);
      toast.success(`Chào mừng bạn đến với MKT SEO AI`);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof AuthClientError ? err.message : 'Có lỗi xảy ra, vui lòng thử lại';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Họ và tên (không bắt buộc)</Label>
        <Input id="name" autoComplete="name" {...form.register('name')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
        <p className="text-xs text-muted-foreground">
          Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số
        </p>
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-brand hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
