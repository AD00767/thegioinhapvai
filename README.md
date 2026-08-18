# Thế giới nhập vai_AD

Khởi đầu cho mọi hành trình Roleplay. Nền tảng cộng đồng dành cho Google AI Studio.

## Kiến trúc & Giả định (Architecture & Assumptions)

Theo yêu cầu của Module 01-36, dự án được xây dựng dưới dạng Full-stack website.

1. **Tech Stack & Cơ sở dữ liệu (Database)**
   - Do Cloud SQL không khả dụng trong môi trường hiện tại (lỗi `NO_VALID_PROJECT`), **Firebase Firestore** và **Firebase Authentication (Google Sign-in)** đã được sử dụng làm cơ sở dữ liệu chính và hệ thống xác thực. Điều này hoàn toàn đáp ứng được nhu cầu mở rộng, realtime và kiến trúc serverless hiện đại.
   - **Backend:** Node.js (Express) sử dụng kiến trúc phân tầng, Firebase Admin SDK để giao tiếp với cơ sở dữ liệu.
   - **Frontend:** React 19 (Vite), Tailwind CSS 4, Zustand (State Management), React Router.

2. **AI Search (Tìm kiếm bằng AI)**
   - Áp dụng Module 12: Sử dụng `Gemini 2.5 Flash` qua `@google/genai` trên Backend để phân tích truy vấn ngôn ngữ tự nhiên của người dùng thành các tiêu chí lọc có cấu trúc (Tags, Gender, Keywords).
   - Truy vấn Firestore dựa trên tiêu chí được AI bóc tách để lọc nội dung một cách chính xác mà không cần người dùng nhập đúng từ khóa tuyệt đối.

3. **Bảo mật & Hiệu năng (Security & Performance)**
   - Ứng dụng Express Rate Limit chặn spam (Max 100 requests/15 mins).
   - Kiểm tra xác thực qua Firebase ID Token.
   - Frontend áp dụng Skeleton Loading, Responsive đầy đủ (Mobile First), Hỗ trợ Dark Mode/Light Mode.

## Các module đã triển khai cốt lõi

- **Module 03:** Welcome Screen.
- **Module 04:** Authentication (Google Sign-in, User Creation).
- **Module 05:** Website Layout (Header, Sidebar Responsive, Navigation).
- **Module 06:** Home (Featured Content Layout).
- **Module 09:** Character System (Data Schema & Fetching).
- **Module 12:** AI Search (Gemini Natural Language Parsing).
- **Module 21 & 22:** Database Schema Blueprint & REST API (Express).

## Cách chạy dự án

- **Cài đặt dependencies:** `npm install`
- **Khởi động server Dev:** `npm run dev` (Khởi chạy đồng thời Express Server và Vite middleware trên cổng 3000)
- **Build Production:** `npm run build`
- **Khởi chạy Production:** `npm start`
