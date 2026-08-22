let currentUserRole = "member";
let loggedInMemberName = "";
let openingBalance = 2656160;

let systemSettings = {
    quyAmount: 600000,
    reward16h: 20000,
    reward18h: 30000,
    rewardCVTT5: 0,
    maxRewardLimit: 15,
    bankId: "TCB",
    bankAccount: "19726868686868",
    accountName: "NGUYEN ANH THI"
};

let members = [];
let matches = [];
let bookingLogs = [];
let cashbookLogs = [];
let gocLogs = [];
let quyLogs = [];
let rulesList = [];

let syncQueue = [];
let isSyncing = false;
let syncIntervalId = null;

let financeSortField = 'stt';
let financeSortAsc = true;

let pendingActionCallback = null;

const defaultFallbackMembers = [
    { stt: 1, name: "Nguyễn Anh Thi 72", status: "Đang tham gia", base: 6.2, role: "admin", username: "Thanglong1" },
    { stt: 2, name: "Nguyễn Văn Sao 88", status: "Đang tham gia", base: 6.2, role: "admin", username: "Thanglong2" },
    { stt: 3, name: "Đỗ Quang Vinh Trọc 77", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong3" },
    { stt: 4, name: "Phạm Quang Vinh Già 71", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong4" },
    { stt: 5, name: "Trần Đại An 85", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong5" },
    { stt: 6, name: "Dương Khắc Đông 98", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong6" },
    { stt: 7, name: "Trần Quang Báo 85", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong7" },
    { stt: 8, name: "Nguyễn Trọng Hùng Lớp 98", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong8" },
    { stt: 9, name: "Thế Vinh 94", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong9" },
    { stt: 10, name: "Nguyễn Tiến Tùng 83", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong10" },
    { stt: 11, name: "Nguyễn Văn Long 84", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong11" },
    { stt: 12, name: "Hoàng Long Trọc 80", status: "Đang tham gia", base: 6.25, role: "member", username: "Thanglong12" },
    { stt: 13, name: "Hoàng Minh Hưng 78", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong13" },
    { stt: 14, name: "Nguyễn Đức Sơn Nước 81", status: "Bận tạm nghỉ", base: 6.25, role: "member", username: "Thanglong14" },
    { stt: 15, name: "Hoàng Văn Thái 94", status: "Đặc cách", base: 6.2, role: "admin", username: "Thanglong15" },
    { stt: 16, name: "Hồ Tuấn Nha 80", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong16" },
    { stt: 17, name: "Lê Việt Trung Bộ Đội 73", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong17" },
    { stt: 18, name: "Vũ Văn Thanh 87", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong18" },
    { stt: 19, name: "Nguyễn Trọng Quân Cận 94", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong19" },
    { stt: 20, name: "Căn Ngọc Quân 92", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong20" },
    { stt: 21, name: "Lê Thái 97", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong21" },
    { stt: 22, name: "Phùng Mạnh Hùng IT 89", status: "Đang tham gia", base: 6.25, role: "member", username: "Thanglong22" },
    { stt: 23, name: "Hồ Sỹ Hiệp 93", status: "Bận tạm nghỉ", base: 6.25, role: "member", username: "Thanglong23" },
    { stt: 24, name: "Đỗ Văn Tường 90", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong24" },
    { stt: 25, name: "Nguyễn Anh Tài 2k", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong25" },
    { stt: 26, name: "Nguyễn Trường Sơn Dubai 81", status: "Đang tham gia", base: 6.4, role: "member", username: "Thanglong26" },
    { stt: 27, name: "Nguyễn Thành Tiến 83", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong27" },
    { stt: 28, name: "Lý Đức Thái Oto 72", status: "Bận tạm nghỉ", base: 6.2, role: "member", username: "Thanglong28" },
    { stt: 29, name: "Phạm Quốc Việt 97", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong29" },
    { stt: 30, name: "Hồng Thái Già 62", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong30" },
    { stt: 31, name: "Đoàn Kiên 79", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong31" },
    { stt: 32, name: "Hải Phạm 73", status: "Đang tham gia", base: 6.3, role: "member", username: "Thanglong32" },
    { stt: 33, name: "Anh Tú 78", status: "Đang tham gia", base: 6.4, role: "member", username: "Thanglong33" },
    { stt: 34, name: "Anh Kết 85", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong34" },
    { stt: 35, name: "Trần Quân 74", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong35" },
    { stt: 36, name: "Khách mời", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong36" },
    { stt: 37, name: "Khách mời 2", status: "Đang tham gia", base: 6.2, role: "member", username: "Thanglong37" }
];
