import React, { useEffect } from 'react';
import { BookOpen, Shield, AlertTriangle, ArrowRight, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: "gioi-thieu", num: "01", title: "Giới thiệu" },
    { id: "tai-khoan", num: "02", title: "Tài khoản" },
    { id: "noi-dung-nguoi-dung", num: "03", title: "Nội dung người dùng" },
    { id: "noi-dung-bi-cam", num: "04", title: "Nội dung bị cấm" },
    { id: "character-prompt", num: "05", title: "Character và Prompt" },
    { id: "comment-feedback", num: "06", title: "Comment và Feedback" },
    { id: "quyen-quan-tri", num: "07", title: "Quyền quản trị" },
    { id: "vi-pham", num: "08", title: "Xử lý vi phạm" },
    { id: "thay-doi-dich-vu", num: "09", title: "Thay đổi dịch vụ" },
    { id: "thay-doi-dieu-khoan", num: "10", title: "Thay đổi điều khoản" },
    { id: "lien-he", num: "11", title: "Liên hệ hỗ trợ" },
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
            <BookOpen className="w-3.5 h-3.5" />
            <span>Văn bản pháp lý & Quy định cộng đồng</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-sans font-extrabold tracking-tight text-neutral-950 dark:text-white mb-4">
            ĐIỀU KHOẢN SỬ DỤNG
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-base sm:text-lg leading-relaxed max-w-3xl font-sans">
            Các quy tắc, trách nhiệm và tiêu chuẩn hoạt động áp dụng cho tất cả thành viên khi tham gia nền tảng cộng đồng <strong>THẾ GIỚI NHẬP VAI AD</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            <span>Phiên bản: 1.0</span>
            <span>•</span>
            <span>Cập nhật lần cuối: 20/08/2026</span>
            <span>•</span>
            <span>Áp dụng: Toàn bộ thành viên</span>
          </div>
        </div>

        {/* Table of Contents / Mục Lục Nhanh */}
        <div className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-6 mb-16 shadow-sm font-sans">
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
        <div className="space-y-14 font-sans">
          
          {/* Section 1 */}
          <section id="gioi-thieu" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">01.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Giới thiệu
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Chào mừng bạn đến với <strong>THẾ GIỚI NHẬP VAI AD</strong>. Website của chúng tôi là một nền tảng cộng đồng mở dành cho những người dùng quan tâm và sử dụng công cụ Google AI Studio trong lĩnh vực sáng tạo Roleplay.
              </p>
              <p>
                <strong>Mục đích của website:</strong> Cung cấp một không gian văn minh, chuyên nghiệp để người dùng có thể tự do khám phá, chia sẻ các Character (nhân vật nhập vai), Prompt (câu lệnh định hướng AI), tìm kiếm các Creator tài năng và tương tác, trao đổi kinh nghiệm cùng cộng đồng.
              </p>
              <p>
                Bằng việc truy cập, tạo tài khoản hoặc sử dụng bất kỳ tính năng nào trên website, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn bộ các điều khoản được quy định dưới đây.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="tai-khoan" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">02.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Tài khoản
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <ul className="list-disc pl-6 space-y-2.5">
                <li>
                  <strong>Trách nhiệm bảo vệ tài khoản:</strong> Người dùng có trách nhiệm tự bảo mật thông tin đăng nhập cá nhân (thông qua tài khoản Google hoặc Email đã đăng ký). Mọi hành động diễn ra từ tài khoản của bạn sẽ được xem là do chính bạn thực hiện hoặc ủy quyền.
                </li>
                <li>
                  <strong>Mục đích sử dụng hợp lệ:</strong> Tuyệt đối không sử dụng tài khoản để thực hiện các hành vi vi phạm quy định cộng đồng, phát tán nội dung độc hại, lạm dụng tài nguyên hoặc gây ảnh hưởng đến sự ổn định của hệ thống.
                </li>
                <li>
                  <strong>Xử lý vi phạm tài khoản:</strong> Tài khoản có thể bị cảnh báo, tạm khóa hoặc chấm dứt quyền truy cập vĩnh viễn nếu phát hiện có hành vi gian lận, phá hoại hoặc vi phạm các quy định hiện hành.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="noi-dung-nguoi-dung" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">03.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Nội dung người dùng
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>Nội dung người dùng (User-Generated Content) trên nền tảng bao gồm:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm my-3">
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">Character & Plot:</span> Thông tin, bối cảnh, tính cách và câu chuyện nhân vật.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">Prompt:</span> Các đoạn câu lệnh, kịch bản hướng dẫn AI.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">Feedback:</span> Ý kiến đóng góp, phản hồi công khai và riêng tư.
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">Comment & Creator Info:</span> Bình luận, tiểu sử và thông tin tác giả.
                </div>
              </div>
              <p>
                <strong>Trách nhiệm cá nhân:</strong> Bạn chịu hoàn toàn trách nhiệm pháp lý và đạo đức đối với mọi nội dung, hình ảnh, văn bản mà mình khởi tạo và đăng tải lên website.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section id="noi-dung-bi-cam" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">04.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Nội dung bị cấm
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>Nhằm duy trì một môi trường an toàn và lành mạnh, nghiêm cấm đăng tải, lưu trữ hoặc phát tán các loại nội dung sau:</p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li>Nội dung vi phạm các quy định pháp luật hiện hành.</li>
                <li>Hành vi gian lận, lừa đảo, chiếm đoạt tài sản hoặc thông tin của người khác.</li>
                <li>Spam, quảng cáo thương mại không được phép, gửi hàng loạt tin rác.</li>
                <li>Mạo danh các cá nhân, tổ chức, Creator khác hoặc ban quản trị.</li>
                <li>Xâm phạm quyền riêng tư, công khai dữ liệu cá nhân nhạy cảm của người khác mà không có sự đồng ý.</li>
                <li>Xâm phạm bản quyền tác giả hoặc quyền sở hữu trí tuệ của bên thứ ba.</li>
                <li>Nội dung độc hại, kích động bạo lực, thù địch, quấy rối hoặc cố ý phá hoại sự phát triển của cộng đồng.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section id="character-prompt" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">05.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Character và Prompt
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <ul className="list-disc pl-6 space-y-2.5">
                <li>
                  <strong>Trách nhiệm người đăng:</strong> Tác giả (Creator/User) tự chịu trách nhiệm về tính chính xác, bản quyền và nội dung của Character/Prompt do mình chia sẻ.
                </li>
                <li>
                  <strong>Quyền xử lý của nền tảng:</strong> Website có toàn quyền ẩn, sửa đổi trạng thái hoặc xóa bỏ các Character/Prompt vi phạm tiêu chuẩn mà không bắt buộc phải thông báo trước.
                </li>
                <li>
                  <strong>Miễn trừ bảo đảm:</strong> Việc một Character hoặc Prompt xuất hiện công khai trên website không đồng nghĩa với việc website xác nhận, khuyến nghị hay bảo đảm tính đúng đắn, an toàn của nội dung đó.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="comment-feedback" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">06.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Comment và Feedback
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <ul className="list-disc pl-6 space-y-2.5">
                <li>
                  Người dùng tự chịu trách nhiệm về mọi bình luận (Comment) và phản hồi (Feedback) do mình gửi đi.
                </li>
                <li>
                  Không sử dụng các tính năng tương tác này để spam, công kích cá nhân, quấy rối, xúc phạm danh dự của thành viên khác hoặc đăng tải nội dung vi phạm quy định.
                </li>
                <li>
                  Các bình luận và phản hồi vi phạm sẽ bị xóa và người thực hiện có thể bị xử lý kỷ luật tài khoản theo mức độ vi phạm.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section id="quyen-quan-tri" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">07.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Quyền quản trị
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Đội ngũ Quản trị viên (Admin) và Kiểm duyệt viên (Moderator) có thẩm quyền xử lý nội dung và tài khoản theo đúng quy chế:
              </p>
              <ul className="list-disc pl-6 space-y-2.5">
                <li>Được quyền xóa nội dung, cảnh cáo, giới hạn tính năng hoặc khóa tài khoản khi phát hiện dấu hiệu vi phạm.</li>
                <li>Được quyền kiểm duyệt, phân loại các báo cáo (Report) do cộng đồng gửi về.</li>
                <li>Tất cả các thao tác quản trị được lưu trữ tự động trong hệ thống nhật ký (Audit Log) để đảm bảo tính minh bạch, chính xác và có thể tra cứu khi cần.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="vi-pham" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">08.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Xử lý vi phạm
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>Khi phát hiện các hành vi vi phạm điều khoản, website áp dụng các biện pháp xử lý theo mức độ:</p>
              <div className="space-y-2 text-sm">
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></span>
                  <div><strong>Nhắc nhở & Ẩn nội dung:</strong> Tạm ẩn bài đăng hoặc bình luận có nghi vấn vi phạm để kiểm tra.</div>
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                  <div><strong>Xóa nội dung:</strong> Xóa bỏ vĩnh viễn các bài đăng, bình luận hoặc tài nguyên vi phạm rõ ràng.</div>
                </div>
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                  <div><strong>Hạn chế / Khóa tài khoản:</strong> Tạm ngưng hoặc khóa vĩnh viễn quyền truy cập của tài khoản đối với các hành vi cố ý hoặc nghiêm trọng.</div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section id="thay-doi-dich-vu" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">09.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Thay đổi dịch vụ
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Website có quyền cập nhật, bổ sung, điều chỉnh giao diện, tính năng hoặc tạm ngừng một phần/toàn bộ dịch vụ khi cần thiết nhằm mục đích nâng cấp hệ thống hoặc bảo trì kỹ thuật mà không chịu trách nhiệm bồi thường.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section id="thay-doi-dieu-khoan" className="scroll-mt-24 space-y-4">
            <div className="flex items-baseline gap-3 border-b border-neutral-200/80 dark:border-neutral-800 pb-3">
              <span className="text-xl sm:text-2xl font-mono font-bold text-neutral-400 dark:text-neutral-600">10.</span>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">
                Thay đổi điều khoản
              </h2>
            </div>
            <div className="text-neutral-700 dark:text-neutral-300 space-y-4 text-base leading-relaxed">
              <p>
                Các điều khoản sử dụng này có thể được điều chỉnh hoặc cập nhật định kỳ để phù hợp với định hướng hoạt động của nền tảng. Khi có sửa đổi quan trọng, chúng tôi sẽ thông báo trên trang chủ hoặc cập nhật mốc thời gian ở phần đầu văn bản. Việc bạn tiếp tục sử dụng website đồng nghĩa với việc bạn đồng ý với các điều khoản đã được cập nhật.
              </p>
            </div>
          </section>

          {/* Section 11 - Contact Card */}
          <section id="lien-he" className="scroll-mt-24 pt-4">
            <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-bold text-lg">
                    <span className="text-neutral-400 font-mono">11.</span>
                    <h3>Liên hệ & Hỗ trợ</h3>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
                    Nếu bạn có bất kỳ câu hỏi, góp ý hoặc cần báo cáo nội dung vi phạm điều khoản sử dụng, vui lòng liên hệ trực tiếp với chúng tôi qua trang Liên hệ.
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
