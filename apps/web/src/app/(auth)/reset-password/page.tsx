import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResetPasswordForm } from '@/components/features/auth/reset-password-form';

export const metadata = {
  title: 'Đặt lại mật khẩu — MKT SEO AI',
};

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Đặt mật khẩu mới</CardTitle>
        <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div>Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
