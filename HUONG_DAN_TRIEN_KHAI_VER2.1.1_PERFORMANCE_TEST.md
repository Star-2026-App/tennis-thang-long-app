# CLB Tennis Thăng Long — Ver2.1.1 PERFORMANCE TEST

## 1. Phạm vi bản test

Đây là bộ FULL được nâng cấp trực tiếp từ Ver2.1.0 đã chốt. Toàn bộ chức năng CUP và dữ liệu hiện tại được giữ nguyên; không cần tạo lại Sheet hoặc migrate dữ liệu.

Bản 2.1.1 xử lý đồng bộ bốn nhóm vấn đề:

1. **Đăng nhập/session:** cache phiên hợp lệ, bỏ ghi `LastUsedAt` ở mỗi request, cache tra cứu thành viên và chuyển cleanup 7 ngày sang lịch bảo trì ban đêm.
2. **Mở app/làm mới dữ liệu:** gộp kiểm tra session + initial data thành một lượt, cache initial data dạng nén theo revision, chống gọi trùng và có timeout rõ ràng.
3. **Ghi dữ liệu:** phân biệt lỗi nghiệp vụ với lỗi mạng/timeout/5xx, giữ nguyên hàng đợi và idempotency key, retry lũy tiến; tối ưu ghi Match/MemberStats; gửi Push ở background sau commit.
4. **CUP/PWA:** initial chỉ nhận tóm tắt CUP, chi tiết tải khi mở tab; polling 60 giây chỉ kiểm tra version; cache giao diện CUP; app shell được cache nhưng toàn bộ `/api/` luôn network-only.

## 2. Triển khai Backend Apps Script

Nên dùng bản Google Sheet TEST và deployment TEST trước.

1. Sao lưu project Apps Script hiện tại.
2. Đồng bộ toàn bộ thư mục `Backend`, hoặc thay đúng các file có thay đổi sau:
   - `AuthService.gs.txt`
   - `Code.gs.txt`
   - `CupService.gs.txt`
   - `IdempotencyService.gs.txt`
   - `MatchService.txt`
   - `MemberService.txt`
   - `MemberStatsService.txt`
   - `Router.gs.txt`
   - `RateLimitService.gs.txt`
3. Lưu project và tạo **New deployment** cho Web App TEST.
4. Trong Apps Script Editor, chọn hàm `installDailyMaintenanceTrigger` và bấm **Run đúng một lần**. Chấp nhận quyền nếu Google hỏi. Hàm sẽ cài lịch dọn `AuthSessions`, `AuthAudit`, `Idempotency` khoảng 03:00 hằng ngày.
5. Giữ nguyên các Script Properties hiện có. Không đổi `OWNER_MEMBER_STT`, secrets hoặc URL nếu môi trường TEST đang chạy đúng.

## 3. Triển khai Frontend Vercel

1. Tạo nhánh test mới, ví dụ `test-performance-v2.1.1`.
2. Thay toàn bộ nội dung bằng thư mục `Frontend` trong gói này.
3. Chạy `npm install` để cài thêm `@vercel/functions` (dùng cho Push background).
4. Commit và deploy Preview/Test trên Vercel.
5. Giữ nguyên Environment Variables của Ver2.1.0; không có biến môi trường mới.
6. Sau deployment, mở app và bấm **Làm mới** một lần để Service Worker nhận phiên bản 2.1.1.

## 4. Kịch bản test bắt buộc

### A. Đăng nhập

- Mở lại app khi cookie còn hạn: phải vào app và nhận dữ liệu chỉ trong một luồng tải.
- Đăng xuất rồi đăng nhập lại bằng `Thanglong2` và một tài khoản Member.
- Thử hai điện thoại đăng nhập gần như cùng lúc trong khi một máy đang ghi dữ liệu.
- Không được xuất hiện cảnh báo mất kết nối lặp lại khi mạng vẫn bình thường.

### B. Refresh/tải dữ liệu

- Bấm Làm mới liên tiếp; không tạo nhiều request initial chạy song song.
- Sửa thử một giá trị ở Google Sheet TEST rồi bấm Làm mới: dữ liệu mới phải xuất hiện vì thao tác Làm mới bỏ qua cache.
- Tắt mạng rồi mở PWA: giao diện app phải mở được từ app shell; dữ liệu API không được lấy từ cache giả.

### C. Ghi dữ liệu

- Thêm một trận mới, sửa và xóa trận bằng Admin.
- Khi đang gửi, chuyển mạng yếu/tắt mạng ngắn rồi bật lại: hàng đợi phải giữ thao tác và tự gửi lại, không ghi trùng.
- Kiểm tra `MemberStats` chỉ thay đổi đúng bốn người của trận.
- Kiểm tra người ghi nhận kết quả sớm; Push có thể đến sau và không được làm chậm phản hồi ghi.

### D. CUP

- Mở app nhưng không vào CUP: không tải toàn bộ danh sách/trận CUP.
- Mở tab CUP: chi tiết tải một lần và hiển thị đủ bảng, lịch, kết quả.
- Hai máy cùng mở CUP; máy A ghi kết quả, máy B phải tự nhận version mới trong tối đa khoảng 60 giây hoặc nhận ngay khi bấm Làm mới.
- Kiểm tra quyền Member ghi lần đầu; Admin/Owner sửa kết quả như Ver2.1.0.

## 5. Chạy kiểm thử mã nguồn

Từ thư mục `Frontend`:

```bash
npm test
```

Kết quả mong đợi:

- `PERFORMANCE_REGRESSION_TEST_PASS`
- `CUP_LOGIC_TEST_PASS`
- `CUP_FRONTEND_TEST_PASS`

## 6. Tiêu chí PASS trước khi đưa production

- Không mất hoặc ghi trùng thao tác khi mạng chập chờn.
- Không còn ghi `LastUsedAt` mỗi lần đọc session.
- Refresh cưỡng bức nhận được thay đổi mới từ Sheet.
- Chức năng CUP, tài chính, thành viên và phân quyền không hồi quy.
- Test liên tục tối thiểu 1–2 ngày trên nhánh TEST với hai điện thoại và một máy tính.

Nếu có lỗi, rollback bằng bộ FULL Ver2.1.0 ban đầu; bản 2.1.1 không thay đổi cấu trúc dữ liệu bắt buộc nên rollback code an toàn.
