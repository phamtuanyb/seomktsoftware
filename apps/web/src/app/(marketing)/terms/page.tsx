import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng — MKT SEO AI',
  description: 'Điều khoản sử dụng dịch vụ MKT SEO AI.',
};

const EFFECTIVE_DATE = '2026-05-26';

export default function TermsPage() {
  return (
    <div className="container py-12">
      <article className="prose prose-zinc mx-auto max-w-3xl">
        <h1>Điều khoản sử dụng</h1>
        <p className="text-sm text-muted-foreground">Hiệu lực từ: {EFFECTIVE_DATE}</p>

        <p>
          Chào mừng đến với MKT SEO AI. Bằng việc đăng ký và sử dụng dịch vụ, bạn đồng ý với các
          điều khoản dưới đây. Vui lòng đọc kỹ trước khi sử dụng. Đây là điều khoản phiên bản beta;
          chúng tôi sẽ cập nhật và thông báo qua email khi có thay đổi quan trọng.
        </p>

        <h2>1. Định nghĩa</h2>
        <p>
          <strong>&quot;Dịch vụ&quot;</strong> nghĩa là phần mềm MKT SEO AI bao gồm website, web
          app, API và các tài nguyên liên quan. <strong>&quot;Người dùng&quot;</strong> là cá nhân
          hoặc tổ chức đã đăng ký tài khoản và sử dụng Dịch vụ.{' '}
          <strong>&quot;Nội dung&quot;</strong> bao gồm bài viết, từ khoá, hình ảnh, brand voice
          profile và mọi dữ liệu Người dùng tạo ra trong Dịch vụ.
        </p>

        <h2>2. Tài khoản</h2>
        <ul>
          <li>Bạn phải cung cấp thông tin chính xác khi đăng ký.</li>
          <li>Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hành động dưới tài khoản của mình.</li>
          <li>
            Một tài khoản chỉ dành cho một cá nhân hoặc tổ chức cụ thể; không chia sẻ với bên thứ
            ba.
          </li>
        </ul>

        <h2>3. Trial và thanh toán</h2>
        <p>
          Trial 14 ngày miễn phí cho tài khoản mới với hạn mức quota theo plan trial (Section 10).
          Sau trial, bạn chọn plan có phí (Starter / Pro / Agency / Lifetime). Thanh toán qua Stripe
          (quốc tế) hoặc Sepay (VN). Chúng tôi không tự gia hạn nếu bạn chưa chọn plan.
        </p>

        <h2>4. Sử dụng hợp lệ</h2>
        <p>Bạn cam kết KHÔNG dùng Dịch vụ để:</p>
        <ul>
          <li>Sinh nội dung vi phạm pháp luật Việt Nam, bản quyền, hoặc kích động bạo lực.</li>
          <li>
            Tạo nội dung lừa đảo, spam, mạo danh người thật, hoặc deepfake gây hiểu lầm về danh
            tính.
          </li>
          <li>Reverse engineer, crawl bypass rate-limit, hoặc tấn công hệ thống.</li>
          <li>Bán lại tài khoản hoặc tài nguyên đã sinh ra dưới danh nghĩa MKT SEO AI.</li>
        </ul>

        <h2>5. Nội dung do AI sinh ra</h2>
        <p>
          Mọi nội dung AI tạo ra thuộc về bạn — bạn được quyền chỉnh sửa, xuất bản và thương mại
          hoá. Tuy nhiên:
        </p>
        <ul>
          <li>
            Bạn chịu trách nhiệm cuối cùng về độ chính xác và tính hợp pháp của nội dung trước khi
            xuất bản công khai.
          </li>
          <li>
            AI có thể nhầm lẫn sự kiện (hallucination). Hãy kiểm tra số liệu, tên riêng, mốc thời
            gian trước khi đăng.
          </li>
          <li>
            Chúng tôi không chịu trách nhiệm với hậu quả pháp lý phát sinh từ nội dung bạn xuất bản.
          </li>
        </ul>

        <h2>6. Hạn mức và rate limit</h2>
        <p>
          Mỗi plan có quota riêng (bài viết, từ khoá, hình ảnh, sites). Rate limit theo Section 10:
          10 req/phút cho /auth, 60 req/phút cho các endpoint thông thường. Lạm dụng rate limit có
          thể dẫn đến tạm khoá tài khoản.
        </p>

        <h2>7. Chấm dứt</h2>
        <p>
          Bạn có thể xoá tài khoản bất kỳ lúc nào qua trang Cài đặt. Chúng tôi có thể tạm khoá hoặc
          xoá tài khoản nếu bạn vi phạm điều khoản. Khi chấm dứt, dữ liệu của bạn được soft-delete
          trong 30 ngày trước khi xoá hoàn toàn.
        </p>

        <h2>8. Giới hạn trách nhiệm</h2>
        <p>
          Dịch vụ cung cấp &quot;as-is&quot;. Trong phạm vi pháp luật cho phép, trách nhiệm tối đa
          của MKT SEO AI với bất kỳ thiệt hại nào không vượt quá số tiền bạn đã thanh toán trong 12
          tháng gần nhất.
        </p>

        <h2>9. Liên hệ</h2>
        <p>
          Mọi câu hỏi về điều khoản: <a href="mailto:legal@mkt-seo-ai.com">legal@mkt-seo-ai.com</a>
        </p>
      </article>
    </div>
  );
}
