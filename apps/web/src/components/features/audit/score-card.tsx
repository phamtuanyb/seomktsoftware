'use client';

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuditReport, RuleStatus } from '@/lib/api/audit';

interface ScoreCardProps {
  report: AuditReport;
}

function statusColor(s: RuleStatus): string {
  return s === 'good' ? 'text-green-700' : s === 'warning' ? 'text-amber-700' : 'text-destructive';
}

function statusBadge(s: RuleStatus): string {
  return s === 'good'
    ? 'bg-green-100 text-green-800'
    : s === 'warning'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-red-100 text-red-800';
}

function statusIcon(s: RuleStatus) {
  if (s === 'good') return <CheckCircle2 className="h-4 w-4 text-green-700" />;
  if (s === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-700" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export function ScoreCard({ report }: ScoreCardProps) {
  const rules = Object.values(report.breakdown).sort(
    (a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Content score</CardTitle>
            <CardDescription>
              12 rules · weighted average · ran trong {report.duration_ms} ms
            </CardDescription>
          </div>
          <div className={`text-right ${statusColor(report.status)}`}>
            <p className="text-4xl font-bold">{report.score}</p>
            <p className="text-xs uppercase tracking-wide">{report.status}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {rules.map((r) => (
            <li key={r.rule_id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-2">
                  {statusIcon(r.status)}
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-muted-foreground">{r.message}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge(r.status)}`}
                  >
                    {r.score}/100
                  </span>
                  <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                    weight {Math.round(r.weight * 100)}%
                  </p>
                </div>
              </div>
              {r.suggestions.length > 0 && r.score < 80 && (
                <ul className="ml-6 mt-2 space-y-1">
                  {r.suggestions.map((s, i) => (
                    <li key={i} className="text-xs">
                      <span
                        className={
                          s.action === 'auto-fixable'
                            ? 'rounded bg-brand/10 px-1.5 py-0.5 text-brand'
                            : 'rounded bg-muted px-1.5 py-0.5 text-muted-foreground'
                        }
                      >
                        {s.action === 'auto-fixable' ? 'auto-fix' : 'manual'}
                      </span>{' '}
                      {s.text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
