import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/features/auth/login-form';

export const metadata = {
  title: 'Đăng nhập — MKT SEO AI',
};

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>Chào mừng quay lại MKT SEO AI</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div>Loading…</div>}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
