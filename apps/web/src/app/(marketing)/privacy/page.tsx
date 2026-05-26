import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — MKT SEO AI',
  description: 'Chính sách bảo mật và xử lý dữ liệu cá nhân của MKT SEO AI.',
};

const EFFECTIVE_DATE = '2026-05-26';

export default function PrivacyPage() {
  return (
    <div className="container py-12">
      <article className="prose prose-zinc mx-auto max-w-3xl">
        <h1>Chính sách bảo mật</h1>
        <p className="text-sm text-muted-foreground">Hiệu lực từ: {EFFECTIVE_DATE}</p>

        <p>
          MKT SEO AI tôn trọng quyền riêng tư của bạn và cam kết tuân thủ Nghị định 13/2023/NĐ-CP về
          bảo vệ dữ liệu cá nhân (Việt Nam) và GDPR khi áp dụng với người dùng EU.
        </p>

        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li>
            <strong>Tài khoản:</strong> email, tên, mật khẩu (bcrypt hashed, không thể giải mã), số
            điện thoại (tuỳ chọn), avatar URL (tuỳ chọn).
          </li>
          <li>
            <strong>Nội dung:</strong> từ khoá, outline, bài viết, brand voice profile, hình ảnh,
            log publish — mọi thứ bạn tạo trong app.
          </li>
          <li>
            <strong>Credentials tích hợp:</strong> Application Password WordPress được mã hoá
            AES-256-GCM với master key xoay 90 ngày trước khi lưu DB.
          </li>
          <li>
            <strong>Logs vận hành:</strong> request method, path, status code, latency, user_id, IP
            — lưu 30 ngày để debug + audit. Body request không được log.
          </li>
          <li>
            <strong>Audit logs:</strong> mọi hành động admin override (đổi role, đổi plan, override
            quota) được lưu vĩnh viễn để truy vết.
          </li>
        </ul>

        <h2>2. Dữ liệu chúng tôi KHÔNG thu thập</h2>
        <ul>
          <li>Cookie tracking (Google Analytics, Meta Pixel...) — chúng tôi không dùng.</li>
          <li>Mật khẩu plaintext — bcrypt one-way hash.</li>
          <li>Nội dung email cá nhân, danh bạ, file hệ thống.</li>
        </ul>

        <h2>3. Cách chúng tôi dùng dữ liệu</h2>
        <ul>
          <li>
            Cung cấp Dịch vụ: gọi AI provider (Anthropic Claude, OpenAI, Replicate Flux) thay mặt
            bạn.
          </li>
          <li>Bảo vệ hệ thống: phát hiện lạm dụng, rate limit, audit log.</li>
          <li>Cải thiện sản phẩm: thống kê tổng hợp (anonymized).</li>
          <li>Liên lạc qua email cho thông báo bảo mật, billing, cập nhật quan trọng.</li>
        </ul>

        <h2>4. Bên thứ ba chúng tôi chia sẻ dữ liệu</h2>
        <p>Chỉ chia sẻ với những bên cần thiết để vận hành Dịch vụ:</p>
        <ul>
          <li>
            <strong>Anthropic (Claude):</strong> prompt + context của bài viết khi bạn gọi AI.
            Anthropic không train model từ data API.
          </li>
          <li>
            <strong>OpenAI (GPT-4o, DALL-E 3):</strong> tương tự, không train từ API data.
          </li>
          <li>
            <strong>Replicate (Flux):</strong> prompt sinh ảnh.
          </li>
          <li>
            <strong>Cloudflare R2:</strong> lưu hình ảnh đã sinh.
          </li>
          <li>
            <strong>Stripe / Sepay:</strong> xử lý thanh toán. Số thẻ KHÔNG đi qua server của chúng
            tôi.
          </li>
          <li>
            <strong>Sentry:</strong> error tracking. Không gửi PII (email, IP) — chỉ user_id +
            stacktrace.
          </li>
          <li>
            <strong>WordPress sites của bạn:</strong> bài viết + featured image khi bạn nhấn
            Publish.
          </li>
        </ul>

        <h2>5. Bảo mật</h2>
        <ul>
          <li>HTTPS bắt buộc trên mọi endpoint production.</li>
          <li>Mật khẩu: bcrypt 12 rounds.</li>
          <li>JWT có TTL 15 phút (access) + 30 ngày (refresh), refresh token rotation.</li>
          <li>API key bên thứ ba mã hoá AES-256-GCM ở DB level.</li>
          <li>Backup PostgreSQL hàng ngày, retain 30 ngày, encrypted at rest.</li>
        </ul>

        <h2>6. Quyền của bạn</h2>
        <p>Theo Nghị định 13/2023 và GDPR, bạn có quyền:</p>
        <ul>
          <li>
            <strong>Truy cập:</strong> xem toàn bộ dữ liệu cá nhân qua trang Cài đặt.
          </li>
          <li>
            <strong>Sửa đổi:</strong> cập nhật tên, phone, avatar, preferences qua /users/me API.
          </li>
          <li>
            <strong>Xoá:</strong> request xoá tài khoản qua email{' '}
            <a href="mailto:privacy@mkt-seo-ai.com">privacy@mkt-seo-ai.com</a>. Soft-delete ngay,
            hard-delete sau 30 ngày.
          </li>
          <li>
            <strong>Export:</strong> request bản sao dữ liệu (JSON) qua email — phản hồi trong 30
            ngày.
          </li>
          <li>
            <strong>Khiếu nại:</strong> với Cục An toàn thông tin (Bộ TT&TT) hoặc DPA EU.
          </li>
        </ul>

        <h2>7. Cookie</h2>
        <p>
          Chúng tôi chỉ dùng cookie session bắt buộc (httpOnly, SameSite=Lax) cho JWT access +
          refresh. Không cookie quảng cáo, không tracking pixel.
        </p>

        <h2>8. Lưu trữ + chuyển dữ liệu quốc tế</h2>
        <p>
          Database chính đặt tại Việt Nam (data center Viettel IDC) hoặc Singapore (AWS
          ap-southeast-1) tuỳ plan. Một số request AI có thể được Anthropic/OpenAI xử lý tại US theo
          terms của họ.
        </p>

        <h2>9. Thay đổi chính sách</h2>
        <p>
          Khi có thay đổi quan trọng, chúng tôi sẽ thông báo qua email 30 ngày trước khi áp dụng.
          Bạn có quyền chấm dứt tài khoản nếu không đồng ý.
        </p>

        <h2>10. Liên hệ</h2>
        <p>
          Privacy officer: <a href="mailto:privacy@mkt-seo-ai.com">privacy@mkt-seo-ai.com</a>
        </p>
      </article>
    </div>
  );
}
