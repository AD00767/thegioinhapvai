import React, { useEffect } from 'react';
import { Shield, Lock, Eye, Database, Server, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: "thong-tin-thu-thap", num: "01", title: "Thông tin được thu thập" },
    { id: "authentication", num: "02", title: "Authentication (Xác thực)" },
    { id: "firebase-firestore", num: "03", title: "Firebase & Firestore" },
    { id: "muc-dich-su-dung", num: "04", title: "Mục đích sử dụng dữ liệu" },
    { id: "du-lieu-cong-khai", num: "05", title: "Dữ liệu công khai" },
    { id: "bao-mat-tai-khoan", num: "06", title: "Bảo mật tài khoản" },
    { id: "quyen-nguoi-dung", num: "07", title: "Quyền của người dùng" },
    { id: "luu-tru-du-lieu", num: "08", title: "Lưu trữ dữ liệu" },
    { id: "thay-doi-chinh-sach", num: "09", title: "Thay đổi chính sách" },
    { id: "lien-he", num: "10", title: "Liên hệ hỗ trợ" },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -80;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 transition-colors duration-200 pb-24 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20">
        
        {/* Header Block - Editorial Style */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-10 mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 text-xs font-semibold tracking-wider uppercase mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Quyền riêng tư & An toàn dữ liệu</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight text-neutral-950 dark:text-white mb-4">
            CHÍNH SÁCH BẢO MẬT
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-base sm:text-lg leading-relaxed max-w-3xl font-sans">
            Cam kết minh bạch về cách thức nền tảng <strong>THẾ GIỚI NHẬP VAI AD</strong> thu thập, lưu trữ, sử dụng và bảo vệ thông tin của bạn.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            <span>Phiên bản: 1.0</span>
            <span>•</span>
            <span>Cập nhật lần cuối: 20/08/2026</span>
            <span>•</span>
            <span>Cơ chế bảo vệ: Firebase Security</span>
          </div>
        </div>

        {/* Table of Contents / Mục Lục Nhanh */}
        <div className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-6 mb-16 shadow-sm">
          <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>MỤC LỤC NỘI DUNG</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-left text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors"
              >
                <span className="text-xs font-mono font-bold text-neutral-400 dark:text-neutral-500">{sec.num}.</span>
                <span className="truncate">{sec.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-14">
          
          {/* Section 1 */}
          <section id="thong-tin-thu-thap" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">01.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Thông tin được thu thập
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Để vận hành các dịch vụ và chức năng cộng đồng, chúng tôi chỉ thu thập những thông tin thực sự cần thiết, bao gồm:
              </p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li>
                  <strong>Email tài khoản:</strong> Được sử dụng làm định danh duy nhất khi bạn đăng nhập qua Google Sign-in hoặc Email.
                </li>
                <li>
                  <strong>Display Name (Tên hiển thị) & Avatar (Ảnh đại diện):</strong> Dùng để đại diện cho bạn khi tương tác với cộng đồng.
                </li>
                <li>
                  <strong>Thông tin hồ sơ:</strong> Các mô tả Bio, liên kết mạng xã hội do chính bạn tự nguyện cung cấp trong phần cài đặt hồ sơ.
                </li>
                <li>
                  <strong>Nội dung do bạn đăng tải:</strong> Dữ liệu về các Character, Prompt, Feedback và Comment bạn khởi tạo.
                </li>
                <li>
                  <strong>Dữ liệu hoạt động cần thiết:</strong> Lịch sử Bookmark, Follow, lượt xem, phản hồi cảm xúc và các tương tác phục vụ chức năng hiển thị trên website.
                </li>
              </ul>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
                Website tuyệt đối không thu thập các thông tin ngoài phạm vi vận hành hoặc dữ liệu nhạy cảm không cần thiết.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="authentication" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">02.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Authentication (Xác thực tài khoản)
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Hệ thống xác thực người dùng của website được xây dựng trên nền tảng <strong>Firebase Authentication</strong>:
              </p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li>Hỗ trợ đăng nhập tiện lợi qua tài khoản <strong>Google (Google Sign-in)</strong> cũng như Email và mật khẩu.</li>
                <li>
                  <strong>Cam kết an toàn mật khẩu:</strong> Chúng tôi <strong>không bao giờ lưu trữ mật khẩu người dùng trực tiếp</strong> trong cơ sở dữ liệu Firestore. Toàn bộ cơ chế mã hóa và quản lý phiên đăng nhập được xử lý hoàn toàn khép kín bởi hạ tầng bảo mật của Google Firebase.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="firebase-firestore" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">03.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Firebase & Firestore
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-4">
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-700 dark:text-neutral-300 shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div className="text-sm space-y-1.5">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-base">Hạ tầng đám mây Google Firestore</h4>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Tất cả dữ liệu tài khoản, hồ sơ người dùng, Character, Prompt, tương tác bình luận và thông báo đều được lưu trữ an toàn trên dịch vụ cơ sở dữ liệu đám mây Google Cloud Firestore.
                  </p>
                </div>
              </div>
              <p>
                Dữ liệu được tổ chức theo cấu trúc phân quyền nghiêm ngặt, đảm bảo tính toàn vẹn và ngăn chặn các truy cập trái phép.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section id="muc-dich-su-dung" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">04.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Mục đích sử dụng dữ liệu
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>Các dữ liệu thu thập được sử dụng duy nhất cho các mục đích chức năng của website:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
                  <strong>Đăng nhập & Quản lý:</strong> Xác thực danh tính và duy trì trạng thái phiên làm việc.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
                  <strong>Hiển thị Hồ sơ:</strong> Hiển thị trang cá nhân, trạng thái Creator và các tác phẩm.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
                  <strong>Quản lý Nội dung:</strong> Cho phép tạo, sửa, xóa, sao chép Character và Prompt.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
                  <strong>Tương tác Cộng đồng:</strong> Vận hành tính năng Follow, Notification, Comment, Feedback.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
                  <strong>Tìm kiếm & Lọc:</strong> Cung cấp bộ lọc và tìm kiếm Character, Prompt, Creator.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60">
                  <strong>Bảo mật & Phân quyền:</strong> Giám sát hệ thống và ngăn ngừa các hành vi gian lận.
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="du-lieu-cong-khai" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">05.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Dữ liệu công khai
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Khi bạn đăng tải nội dung hoặc tương tác trên nền tảng, một số thông tin sẽ được hiển thị công khai cho tất cả thành viên và khách truy cập, bao gồm:
              </p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li>Display Name (Tên hiển thị) và Avatar (Ảnh đại diện).</li>
                <li>Trang Creator Profile cùng số liệu thống kê lượt xem, yêu thích, lưu trữ.</li>
                <li>Các bài đăng Character, Prompt được chia sẻ công khai.</li>
                <li>Các Feedback được thiết lập ở chế độ công khai (Public) và toàn bộ các Comment dưới bài viết.</li>
              </ul>
              <div className="p-4 rounded-xl border-l-4 border-amber-500 bg-neutral-100 dark:bg-neutral-800/80 text-sm text-neutral-800 dark:text-neutral-200">
                <strong>Nguyên tắc ẩn Email:</strong> Hệ thống tự động ẩn địa chỉ Email của bạn khỏi mọi giao diện công khai để bảo vệ quyền riêng tư cá nhân.
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="bao-mat-tai-khoan" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">06.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Bảo mật tài khoản
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Chúng tôi áp dụng các tiêu chuẩn an toàn kỹ thuật phù hợp với mô hình hoạt động của website:
              </p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li>Sử dụng giao thức mã hóa đường truyền HTTPS/SSL cho toàn bộ lưu lượng truy cập.</li>
                <li>Thiết lập quy tắc bảo mật dữ liệu Firestore Security Rules để ngăn chặn truy cập trái phép hoặc ghi đè dữ liệu.</li>
                <li>Áp dụng hệ thống xác thực CAPTCHA đối với các biểu mẫu quan trọng nhằm ngăn chặn bot và spam.</li>
              </ul>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
                * Lưu ý: Mặc dù chúng tôi nỗ lực tối đa để bảo vệ dữ liệu, không có bất kỳ hệ thống truyền tải hay lưu trữ nào trên môi trường Internet có thể cam kết mức độ "bảo mật tuyệt đối 100%".
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="quyen-nguoi-dung" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">07.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Quyền của người dùng
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>Với tư cách là thành viên của website, bạn có các quyền sau đối với dữ liệu của mình:</p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li><strong>Xem và chỉnh sửa:</strong> Bạn có quyền tự do thay đổi Tên hiển thị, Avatar, Bio và các thông tin cá nhân trong trang Cài đặt / Hồ sơ.</li>
                <li><strong>Quản lý nội dung:</strong> Bạn có toàn quyền sửa đổi, ghim hoặc xóa bỏ các Character, Prompt và bình luận do chính mình đăng tải.</li>
                <li><strong>Đăng xuất:</strong> Bạn có thể chủ động đăng xuất khỏi tài khoản trên thiết bị bất cứ lúc nào.</li>
                <li><strong>Yêu cầu hỗ trợ:</strong> Bạn có quyền gửi yêu cầu hỗ trợ hoặc phản ánh vấn đề tài khoản cho ban quản trị thông qua trang Liên hệ.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="luu-tru-du-lieu" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">08.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Lưu trữ dữ liệu
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Dữ liệu tài khoản và các tác phẩm của bạn được lưu trữ trên hệ thống trong suốt thời gian website hoạt động và tài khoản của bạn duy trì trạng thái hợp lệ. Khi một bài đăng hoặc tài nguyên được bạn chủ động xóa bỏ, dữ liệu liên quan sẽ được cập nhật trạng thái tương ứng trên hệ thống.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="thay-doi-chinh-sach" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">09.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Thay đổi chính sách
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Chính sách bảo mật này có thể được điều chỉnh hoặc cập nhật để phản ánh đúng sự thay đổi trong tính năng hoặc quy định kỹ thuật của website. Mọi thay đổi sẽ được cập nhật công khai tại trang này kèm theo mốc thời gian sửa đổi mới nhất.
              </p>
            </div>
          </section>

          {/* Section 10 - Contact Card */}
          <section id="lien-he" className="scroll-mt-24 pt-4">
            <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-bold text-lg">
                    <span className="text-neutral-400 font-mono">10.</span>
                    <h3>Liên hệ về Quyền riêng tư</h3>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
                    Nếu bạn có bất kỳ câu hỏi nào về cách chúng tôi xử lý dữ liệu hoặc muốn phản ánh về vấn đề bảo mật, vui lòng gửi tin nhắn qua trang Liên hệ.
                  </p>
                </div>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-medium text-sm rounded-xl hover:opacity-90 transition-opacity shrink-0 shadow-sm"
                >
                  <span>Gửi yêu cầu hỗ trợ</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
