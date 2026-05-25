import { ComingSoon } from '@/components/shared/coming-soon';

export const metadata = { title: 'Webhook — MKT SEO AI' };

export default function WebhooksPage() {
  return (
    <ComingSoon
      title="Webhook outgoing"
      sprint="Sprint 6"
      spec="Section 6 — Webhook Events"
      description="Đăng ký URL nhận event article.created / article.published / publish.failed / brand_voice.trained / quota.warning. HMAC-SHA256 verify."
    />
  );
}
