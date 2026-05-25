import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ComingSoonProps {
  title: string;
  sprint: string;
  description: string;
  /** Spec section reference (e.g. "Section 8 — TN1") for traceability. */
  spec: string;
}

export function ComingSoon({ title, sprint, description, spec }: ComingSoonProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{spec}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-accent">
          Triển khai trong {sprint}
        </p>
      </CardContent>
    </Card>
  );
}
