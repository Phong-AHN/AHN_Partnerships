# AHN Partnerships: plan triển khai app mới

App theo dõi đối tác và hội viên doanh nghiệp (corporate membership) cho AHN/AHNF năm 2027. Đây là bản đơn giản hoá của Mercator: giữ phần khung (đăng nhập, phân quyền, giao diện, cách viết server action), bỏ toàn bộ phần migration store.

Folder gợi ý: `D:\Data\AHN_Media\AHN_Partnerships`. Tên package: `@partners/*`.

---

## 1. Mục tiêu

Mỗi đối tác là một **deal trong pipeline**, đúng như anh Bryan yêu cầu: _"Work this as a pipeline rather than sending 50 identical sponsorship emails."_ App phải trả lời được nhanh:

1. Mỗi đối tác đang ở giai đoạn nào, ai phụ trách, việc tiếp theo là gì và hạn khi nào.
2. Mình đang đề xuất gì với họ: hội viên hạng nào (giá cố định), hợp tác referral/revenue, hay hợp tác strategic/community.
3. Tổng giá trị đã chốt so với tổng giá trị đang trong pipeline năm 2027.
4. Deal nào quá hạn follow-up, hội viên nào sắp đến hạn gia hạn.

### Có trong v1

- Đăng nhập (chỉ nội bộ AHN), 3 vai trò.
- Danh sách đối tác, người liên hệ, deal, hội viên (membership).
- **Bảng hạng hội viên có giá cố định**, admin quản lý.
- Pipeline dạng board (kanban) và dạng bảng có bộ lọc.
- Trang chi tiết đối tác, có ghi chú và lịch sử liên hệ.
- Dashboard tổng quan.
- Seed sẵn 50 đối tác trong email (Phụ lục A), nhập/xuất CSV.

### Không có trong v1

- Portal cho đối tác bên ngoài, email follow-up/marketing từ app, tích hợp Gmail/Slack/ClickUp. (Email duy nhất app gửi là link đăng nhập và lời mời, qua Resend - mục 5.4.)
- Hoá đơn và thanh toán (v1 chỉ ghi "đã thanh toán / chưa").
- Upload file (proposal PDF chỉ lưu dưới dạng link).
- Worker nền, Redis, S3.
- Multi-tenant: chỉ có một tổ chức là AHN.

---

## 2. Cần chốt trước khi code

| #   | Câu hỏi                                                                           | Mặc định nếu chưa có câu trả lời                                        |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Tên, giá và quyền lợi của từng hạng hội viên**                                  | **Đã chốt** (mục 5.3): Title $50,000/năm, Small Business $10,000/năm    |
| 2   | Hạng hội viên áp dụng cho AHN, AHNF, hay cả hai? Mỗi bên có bảng giá riêng không? | Một bảng giá chung; deal có trường `entity`                             |
| 3   | Chu kỳ hội viên                                                                   | 12 tháng tính từ ngày bắt đầu, nhắc gia hạn trước 60 ngày               |
| 4   | Tiền tệ                                                                           | USD, lưu bằng cent (`amountMinor`), giống Mercator                      |
| 5   | Ai dùng app, ai là admin                                                          | Bryan và Phong là ADMIN, team là MEMBER                                 |
| 6   | Deal referral/strategic có cần ghi giá trị ước tính không?                        | Có, nhập tay, không bắt buộc                                            |
| 7   | Mục tiêu doanh thu năm 2027                                                       | Trường cấu hình `annualTargetMinor`, hiện trên dashboard                |
| 8   | Domain và host                                                                    | Vercel (region `sin1` như Mercator) + một Postgres riêng (Neon/Railway) |

**Database phải tách riêng khỏi Mercator.** Không dùng chung database hay biến môi trường.

---

## 3. Kiến trúc

Stack giống Mercator, để team không phải học lại:

| Thành phần  | Lựa chọn                                                               |
| ----------- | ---------------------------------------------------------------------- |
| Runtime     | Node ≥ 22, pnpm 10 (monorepo nhỏ)                                      |
| Web         | Next.js 15 (App Router, Server Components, Server Actions), React 19   |
| Style       | Tailwind 4 + design tokens copy từ `@relay/ui`                         |
| DB          | Postgres 17 + Prisma 6                                                 |
| Validate    | zod 3                                                                  |
| Test        | vitest (unit) + vitest integration chạy với Postgres thật trong docker |
| Lint/format | eslint 9 + typescript-eslint, prettier + plugin tailwind               |
| Deploy      | Vercel (web) + Postgres managed                                        |

Bỏ khỏi Mercator: `apps/worker`, `packages/queue`, `packages/storage`, `packages/storefront`, `packages/integrations`, Redis, MinIO, puppeteer/chromium, Gemini.

### Cấu trúc thư mục

```
AHN_Partnerships/
├─ apps/web/                     Next.js app
│  └─ src/
│     ├─ app/
│     │  ├─ (auth)/sign-in/
│     │  └─ (app)/
│     │     ├─ dashboard/
│     │     ├─ pipeline/          board + bảng
│     │     ├─ partners/          danh sách + [id]/ chi tiết
│     │     ├─ members/           hội viên đang active + gia hạn
│     │     └─ settings/          tiers/, users/, import/
│     ├─ features/                partners, deals, memberships, tiers, activity, dashboard, import
│     ├─ server/                  action.ts, session.ts, record.ts (copy từ Mercator)
│     └─ components/
├─ packages/
│  ├─ config/                    env (zod) - copy, rút gọn biến
│  ├─ core/                      enums, labels, format, clock, errors - copy phần dùng được
│  ├─ db/                        Prisma schema MỚI + seed
│  ├─ auth/                      password, session, sign-in, rate-limit - copy nguyên
│  ├─ rbac/                      viết lại matrix cho 3 vai trò
│  └─ ui/                        copy nguyên, bỏ before-after/showcase
├─ docker-compose.yml            chỉ Postgres (port 5434 để không trùng Mercator)
├─ .env.example
├─ CLAUDE.md
└─ docs/PLAN.md                  file này
```

### Copy gì từ Mercator (`D:\Data\AHN_Media\AHN_MigrateToolSHOPLINE`)

| Từ Mercator                                                                                                   | Cách dùng                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `package.json` gốc, `pnpm-workspace.yaml`, `tsconfig*`, `eslint.config.*`, `.prettierrc`, `vitest*.config.ts` | Copy, đổi tên `relay` → `partners`, bỏ script worker                                                 |
| `packages/auth/`                                                                                              | Copy nguyên (hash mật khẩu, session cookie, chống dò mật khẩu)                                       |
| `packages/ui/`                                                                                                | Copy, bỏ `before-after.tsx` và `showcase.tsx`                                                        |
| `packages/core/src/{clock,errors,format}.ts`                                                                  | Copy. `enums.ts`/`labels.ts` viết lại theo domain mới                                                |
| `packages/config/src/env.ts`                                                                                  | Copy, chỉ giữ `DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `SESSION_SECRET`, `LOG_LEVEL`                 |
| `packages/observability/`                                                                                     | Copy (logger)                                                                                        |
| `apps/web/src/server/{action,session,record}.ts`                                                              | Copy. Chính `defineAction` là phần giữ cho mọi mutation đi qua bước xác thực → phân quyền → validate |
| `apps/web/src/components/use-action.ts`, `components/shell/*`                                                 | Copy, sửa menu                                                                                       |
| `apps/web/next.config.ts` (CSP headers)                                                                       | Copy, bỏ các domain S3/Slack                                                                         |
| `packages/rbac/src/engine.ts`                                                                                 | Copy engine; `matrix.ts`/`permissions.ts`/`navigation.ts` viết lại                                   |

**Không copy `packages/db/prisma/schema.prisma` và các migration.** Viết schema mới từ đầu (mục 4), migration đầu tiên là `init`.

---

## 4. Data model (Prisma)

```prisma
enum UserRole   { ADMIN MEMBER VIEWER }
enum Entity     { AHN AHNF BOTH }
enum Sector     { BANKING_FINANCIAL TECH_COMMERCE_SMB PROFESSIONAL_SERVICES CORPORATE_CONSUMER_MEDIA GLOBAL_GOVERNMENT_ECOSYSTEM }
enum Priority   { IN_MOTION NEXT_OUTREACH OPPORTUNITY BACKLOG }
enum AskType    { CORPORATE_MEMBERSHIP REFERRAL_REVENUE STRATEGIC_COMMUNITY }
enum DealStage  { PROSPECT CONTACTED IN_DISCUSSION PROPOSAL_SENT NEGOTIATING WON LOST ON_HOLD }
enum MembershipStatus { ACTIVE EXPIRED CANCELLED }
enum ActivityType { NOTE EMAIL CALL MEETING STAGE_CHANGE DEAL_CREATED MEMBERSHIP_STARTED }

model User {
  id           String   @id @default(uuid(7)) @db.Uuid
  email        String   @unique
  name         String
  passwordHash String
  role         UserRole @default(MEMBER)
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime? @db.Timestamptz(3)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  sessions     Session[]
  // + PasswordToken, SignInThrottle: copy model từ Mercator để @relay/auth chạy được
}

/// Hạng hội viên. Giá cố định; khi đổi giá thì tạo hạng mới cho năm mới
/// hoặc sửa giá - các deal cũ đã chụp lại giá vào `Deal.amountMinor`.
model MembershipTier {
  id          String   @id @default(uuid(7)) @db.Uuid
  code        String   @unique          // "TITLE_2027"
  name        String                     // "Title Package"
  year        Int                        // 2027
  priceMinor  Int                        // 5000000 = $50,000
  benefits    String[]                   // danh sách quyền lợi
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  deals       Deal[]
  memberships Membership[]
  @@unique([name, year])
}

model Partner {
  id         String   @id @default(uuid(7)) @db.Uuid
  name       String   @unique
  website    String?
  sector     Sector
  priority   Priority @default(BACKLOG)
  /// "existing AHN relationship" trong email = true
  existingRelationship Boolean @default(false)
  summary    String?                     // mô tả cơ hội, như từng dòng trong email
  ownerId    String?  @db.Uuid           // người AHN phụ trách
  createdAt  DateTime @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @db.Timestamptz(3)
  archivedAt DateTime? @db.Timestamptz(3)
  contacts    PartnerContact[]
  deals       Deal[]
  memberships Membership[]
  activities  Activity[]
  @@index([sector]) @@index([priority])
}

model PartnerContact {
  id        String  @id @default(uuid(7)) @db.Uuid
  partnerId String  @db.Uuid
  name      String
  title     String?
  email     String?
  phone     String?
  linkedin  String?
  isPrimary Boolean @default(false)
  notes     String?
  partner   Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  @@index([partnerId])
}

/// Một đề xuất cụ thể với một đối tác cho một năm. Một đối tác có thể có
/// nhiều deal (ví dụ ADP: một deal sponsor hằng năm + một deal referral).
model Deal {
  id                String    @id @default(uuid(7)) @db.Uuid
  partnerId         String    @db.Uuid
  title             String                  // "2027 Corporate Membership"
  year              Int       @default(2027)
  entity            Entity    @default(AHN)
  askType           AskType
  tierId            String?   @db.Uuid      // bắt buộc khi askType = CORPORATE_MEMBERSHIP
  /// Với membership: chụp lại giá của tier lúc gán, để việc đổi giá sau
  /// không viết lại lịch sử. Với loại khác: giá trị ước tính, nhập tay.
  amountMinor       Int?
  stage             DealStage @default(PROSPECT)
  stageChangedAt    DateTime  @default(now()) @db.Timestamptz(3)
  expectedCloseDate DateTime? @db.Date
  closedAt          DateTime? @db.Timestamptz(3)
  lostReason        String?
  nextAction        String?
  nextActionDue     DateTime? @db.Date
  ownerId           String?   @db.Uuid
  proposalUrl       String?
  createdAt         DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime  @updatedAt @db.Timestamptz(3)
  partner    Partner         @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  tier       MembershipTier? @relation(fields: [tierId], references: [id])
  membership Membership?
  activities Activity[]
  @@index([stage]) @@index([year, stage]) @@index([nextActionDue])
}

/// Một hội viên đã chốt. Sinh ra khi deal CORPORATE_MEMBERSHIP chuyển sang WON.
model Membership {
  id          String   @id @default(uuid(7)) @db.Uuid
  partnerId   String   @db.Uuid
  tierId      String   @db.Uuid
  dealId      String?  @unique @db.Uuid
  startDate   DateTime @db.Date
  endDate     DateTime @db.Date
  amountMinor Int                       // giá chụp từ deal
  status      MembershipStatus @default(ACTIVE)
  paidAt      DateTime? @db.Timestamptz(3)
  notes       String?
  partner Partner        @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  tier    MembershipTier @relation(fields: [tierId], references: [id])
  deal    Deal?          @relation(fields: [dealId], references: [id])
  @@index([endDate]) @@index([status])
}

model Activity {
  id         String       @id @default(uuid(7)) @db.Uuid
  partnerId  String       @db.Uuid
  dealId     String?      @db.Uuid
  type       ActivityType
  body       String
  occurredAt DateTime     @default(now()) @db.Timestamptz(3)
  authorId   String?      @db.Uuid
  partner Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  deal    Deal?   @relation(fields: [dealId], references: [id], onDelete: SetNull)
  @@index([partnerId, occurredAt])
}

model AuditLog { /* copy từ Mercator, bỏ projectId */ }
model AppSetting { key String @id  value Json }   // annualTargetMinor, renewalNoticeDays
```

### Check constraint (viết tay trong migration SQL, như Mercator)

```sql
-- Deal membership phải có hạng (và giá đã chụp) từ lúc gửi proposal trở đi.
-- Ở giai đoạn đầu thì chưa cần: lúc đó thường chưa biết đối tác hợp hạng nào.
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_membership_needs_tier"
  CHECK (
    "askType" <> 'CORPORATE_MEMBERSHIP'
    OR "stage" IN ('PROSPECT','CONTACTED','IN_DISCUSSION','LOST','ON_HOLD')
    OR ("tierId" IS NOT NULL AND "amountMinor" IS NOT NULL)
  );
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_closed_has_timestamp"
  CHECK ("stage" NOT IN ('WON','LOST') OR "closedAt" IS NOT NULL);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_amount_non_negative"
  CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_end_after_start"
  CHECK ("endDate" > "startDate");
```

**Bài học từ lỗi `Project_target_after_start` của Mercator:** mọi check constraint phải được kiểm tra trước ở server action (dùng `ValidationError` có `fieldErrors`) và ở form (`min`/`required`). Constraint trong database chỉ là lưới an toàn cuối cùng, không phải chỗ hiện lỗi cho người dùng.

### Quy tắc nghiệp vụ (trong `features/deals/mutations.ts`)

- **Gán tier cho deal:** `amountMinor = tier.priceMinor` tại thời điểm gán. Người dùng không sửa tay giá của deal membership. Nếu đổi tier thì chụp lại giá.
- **Chuyển stage:**
  - Deal membership sang `PROPOSAL_SENT`, `NEGOTIATING` hoặc `WON` mà chưa có tier → `ValidationError` "Choose a membership tier first."
  - Ghi `stageChangedAt` và tạo một `Activity` loại `STAGE_CHANGE`.
  - Khi sang `WON`/`LOST`, đặt `closedAt`. Sang `LOST` thì bắt buộc nhập `lostReason`.
  - Mở lại từ `WON`/`LOST` thì xoá `closedAt`. Nếu deal đã sinh ra membership thì phải huỷ membership trước.
- **Deal `CORPORATE_MEMBERSHIP` chuyển sang `WON`:** trong cùng transaction, tạo `Membership`. `startDate` mặc định là hôm nay, người dùng chọn được; `endDate` là `startDate` + 12 tháng.
- **Gia hạn:**
  - Nút "Renew" trên membership tạo một deal mới cho năm sau, tier mặc định giữ nguyên, stage `IN_DISCUSSION`.
  - Hết `endDate` thì status hiển thị là `EXPIRED`. Tính khi đọc dữ liệu, không cần cron.
- **Deal quá hạn follow-up:** `nextActionDue < hôm nay` và stage chưa đóng.
- **Deal bị bỏ quên:** chưa đóng, và không có activity nào trong 21 ngày. Ngưỡng 21 ngày cấu hình được.

---

## 5. Màn hình

| Route              | Nội dung                                                                                                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`       | Các ô số liệu: tổng đã chốt năm 2027 so với mục tiêu, tổng đang trong pipeline (có trọng số theo stage), số hội viên active, số follow-up quá hạn. Biểu đồ funnel theo stage. Phân bố theo ngành và theo loại đề xuất. Danh sách "Cần làm tuần này" (`nextActionDue` ≤ 7 ngày tới, kể cả quá hạn). Danh sách gia hạn trong 60 ngày tới. |
| `/pipeline`        | Board kanban theo stage, kéo-thả để đổi stage (có hộp thoại khi sang LOST hoặc WON). Chuyển được sang dạng bảng. Lọc theo ngành, ưu tiên, loại đề xuất, người phụ trách, entity, năm. Thẻ deal hiện tên đối tác, tier hoặc giá trị, việc tiếp theo và hạn (đỏ nếu quá hạn).                                                             |
| `/partners`        | Bảng đối tác, tìm kiếm, lọc theo ngành và ưu tiên. Nút "New partner".                                                                                                                                                                                                                                                                   |
| `/partners/[id]`   | Header gồm tên, ngành, ưu tiên, người phụ trách. Các khối: người liên hệ (thêm/sửa), deal (tạo, đổi stage, gán tier), membership, timeline activity với ô ghi chú nhanh (Note/Email/Call/Meeting).                                                                                                                                      |
| `/members`         | Hội viên đang active, theo tier, ngày hết hạn, đã thanh toán chưa. Nút Renew.                                                                                                                                                                                                                                                           |
| `/settings/tiers`  | ADMIN quản lý tier: tên, năm, giá, quyền lợi, thứ tự, ẩn/hiện.                                                                                                                                                                                                                                                                          |
| `/settings/users`  | ADMIN mời và vô hiệu hoá người dùng (dùng luồng password token copy từ Mercator).                                                                                                                                                                                                                                                       |
| `/settings/import` | Upload CSV đối tác (cột theo Phụ lục A), xem trước, xác nhận. Xuất CSV toàn bộ pipeline.                                                                                                                                                                                                                                                |

Nhãn trong giao diện dùng tiếng Anh, giống Mercator, vì sếp đọc tiếng Anh.

### Phân quyền

| Quyền                                     | ADMIN | MEMBER | VIEWER |
| ----------------------------------------- | ----- | ------ | ------ |
| Xem mọi thứ                               | ✓     | ✓      | ✓      |
| Tạo/sửa đối tác, liên hệ, deal, ghi chú   | ✓     | ✓      |        |
| Đổi stage, chốt WON/LOST                  | ✓     | ✓      |        |
| Sửa membership, đánh dấu đã thanh toán    | ✓     | ✓      |        |
| Quản lý tier, người dùng, import, cài đặt | ✓     |        |        |
| Xoá (archive) đối tác                     | ✓     |        |        |

Mỗi mutation đều đi qua `defineAction({ permission })`, giống Mercator.

### 5.3 Gói hội viên 2027 (đã chốt)

| code                  | name                   | year | price         |
| --------------------- | ---------------------- | ---- | ------------- |
| `TITLE_2027`          | Title Package          | 2027 | $50,000 / năm |
| `SMALL_BUSINESS_2027` | Small Business Package | 2027 | $10,000 / năm |

Hai đề xuất $50K trong email (Azurium, Steller) được seed vào Title Package. Quyền lợi của từng gói admin nhập ở `/settings/tiers`.

### 5.4 Đăng nhập bằng magic link (thay cho mật khẩu)

- Không có mật khẩu. Người dùng nhập email ở `/sign-in` và nhận link đăng nhập dùng một lần qua **Resend** (hết hạn sau 15 phút).
- Admin mời người mới ở `/settings/users`: app tự gửi email mời (link hết hạn sau 7 ngày). Admin không phải copy link; nút "Send sign-in link" gửi lại khi cần.
- Mở link chỉ hiện nút xác nhận; bấm nút mới đăng nhập, để trình quét link trong email (Outlook Safe Links...) không dùng mất link.
- Phản hồi giống nhau dù email có tài khoản hay không; giới hạn tần suất theo IP và tối đa 1 link/người/phút.
- Biến môi trường: `RESEND_API_KEY` (bắt buộc ở production), `EMAIL_FROM` (domain đã verify trong Resend). Local không có key thì link được in ra log của `pnpm dev`.

---

## 6. Các giai đoạn triển khai

Mỗi giai đoạn kết thúc bằng `pnpm verify`, tức format, lint, typecheck và test đều phải qua. Sau mỗi giai đoạn tạo một commit.

### Giai đoạn 0: Khởi tạo (½ ngày)

1. `git init`, tạo cấu trúc thư mục, copy các file cấu hình và package theo bảng ở mục 3.
2. Tạo `docker-compose.yml` chỉ có Postgres (`5434:5432`, user/db `partners`).
3. Tạo `.env.example` và `packages/config` rút gọn.
4. `pnpm install`, `pnpm infra:up`, rồi `pnpm dev` hiện được một trang trống.

**Xong khi:** `pnpm verify` qua trên repo gần như trống.

### Giai đoạn 1: Schema và seed (1 ngày)

1. Viết `schema.prisma` theo mục 4 và migration `init` có check constraint.
2. `prisma/seed.ts`:
   - tier ở mục 5.3;
   - 1 admin lấy từ biến `SEED_ADMIN_EMAIL` (đăng nhập bằng magic link, không có mật khẩu);
   - 50 đối tác ở Phụ lục A, kèm người liên hệ (tách theo `;`);
   - mỗi đối tác 1 deal năm 2027 với `askType`, stage và priority theo phụ lục.
3. Integration test cho các constraint, bảo đảm vi phạm thì bị từ chối.

**Xong khi:** `pnpm db:migrate:dev && pnpm db:seed` cho ra 50 đối tác, khoảng 80 người liên hệ và 50 deal.

### Giai đoạn 2: Đăng nhập và khung app (1 ngày)

1. Gắn `@partners/auth`: trang sign-in, sign-out, session cookie, rate limit.
2. `rbac`: 3 vai trò theo bảng ở mục 5, kèm `navigation.ts`.
3. Shell gồm sidebar (Dashboard, Pipeline, Partners, Members, Settings), user menu, chuyển theme.

**Xong khi:** đăng nhập được bằng admin; VIEWER không thấy nút sửa và bị server từ chối nếu gọi action trực tiếp (có test).

### Giai đoạn 3: Đối tác, liên hệ, ghi chú (1,5 ngày)

1. Bảng `/partners` có tìm kiếm và lọc. Trang `/partners/[id]` có các khối như mục 5.
2. Action: `createPartner`, `updatePartner`, `archivePartner`, `upsertContact`, `deleteContact`, `logActivity`.

**Xong khi:** tạo được đối tác mới, thêm 2 người liên hệ, ghi một note, và thấy note trong timeline.

### Giai đoạn 4: Deal và pipeline (2 ngày)

1. Action: `createDeal`, `updateDeal`, `assignTier` (chụp giá), `moveStage` (theo quy tắc ở mục 4), `setNextAction`.
2. `/pipeline` dạng board có kéo-thả (dùng `@dnd-kit/core`) và dạng bảng; bộ lọc lưu trên URL.
3. Unit test cho phần tính stage, quá hạn và bị bỏ quên. Integration test cho `moveStage` → WON tạo membership.

**Xong khi:** kéo deal Azurium từ PROPOSAL_SENT sang WON thì sinh ra membership Title Package $50,000.

### Giai đoạn 5: Hội viên và gia hạn (1 ngày)

1. `/members`, đánh dấu đã thanh toán, huỷ membership, nút Renew sinh deal năm 2028.
2. Trạng thái EXPIRED tính khi đọc, và danh sách sắp hết hạn.

### Giai đoạn 6: Dashboard (1 ngày)

Các ô số liệu, funnel, phân bố, danh sách "Cần làm tuần này" và gia hạn, theo mục 5. Tính tổng bằng `groupBy` ở server, không tải toàn bộ deal về trình duyệt.

### Giai đoạn 7: Cài đặt, import/export (1 ngày)

1. `/settings/tiers`, `/settings/users`.
2. Import CSV: parse, validate từng dòng, xem trước, ghi trong một transaction. Trùng tên đối tác thì cập nhật, không tạo bản mới.
3. Export CSV.

### Giai đoạn 8: Deploy (½ ngày)

1. Tạo Postgres production và project Vercel mới (Root Directory `apps/web`, region `sin1`). Đặt env.
2. **Chạy `pnpm db:migrate:deploy` lên production TRƯỚC khi deploy code có migration mới.** Đây chính là lỗi đã làm sập trang project của Mercator. Cân nhắc đưa bước này vào build command.
3. Chạy seed một lần với dữ liệu thật, tạo tài khoản cho team.
4. Thêm `docs/RUNBOOK.md` gồm: chạy local, migrate, deploy, backup.

**Tổng cộng khoảng 9–10 ngày làm việc cho một người.**

---

## 7. CLAUDE.md cho repo mới

```markdown
# AHN Partnerships

Internal pipeline for AHN/AHNF corporate memberships and partnerships (2027+).
Simplified sibling of Mercator (D:\Data\AHN_Media\AHN_MigrateToolSHOPLINE) - same stack and conventions.

- Every mutation goes through `defineAction` (apps/web/src/server/action.ts): auth → permission → zod → handler.
- Validate every DB check constraint in the action first and return `ValidationError` with `fieldErrors`;
  never let a Postgres 23514 reach the user.
- Money is integer cents (`amountMinor`). A membership deal's amount is the tier price snapshotted at assignment.
- Dates: use `clock.now()` from @partners/core, never `new Date()` (lint enforces it).
- Before deploying code with a new migration, run `pnpm db:migrate:deploy` against production.
- `pnpm verify` must pass before every commit.
- Plan: docs/PLAN.md.
```

## 8. Prompt để bắt đầu trong workspace mới

> Đọc `docs/PLAN.md`. Thực hiện **Giai đoạn 0**: tạo monorepo theo mục 3, copy các file và package được liệt kê từ `D:\Data\AHN_Media\AHN_MigrateToolSHOPLINE` (đổi scope `@relay` → `@partners`, bỏ những gì mục 3 nói bỏ), tạo docker-compose chỉ có Postgres ở port 5434, rồi chạy `pnpm install` và `pnpm verify`. Dừng lại báo cáo trước khi sang Giai đoạn 1.

Làm từng giai đoạn một, kiểm tra xong rồi mới sang giai đoạn kế tiếp.

---

## Phụ lục A: dữ liệu seed (50 đối tác)

Cột:

- `ask_type`: CM = CORPORATE_MEMBERSHIP, RR = REFERRAL_REVENUE, SC = STRATEGIC_COMMUNITY.
- `priority`: lấy theo mục "Immediate follow-up priority" trong email. Đối tác nằm trong cả "Next outreach" lẫn "Biggest additional opportunities" thì xếp vào NEXT_OUTREACH.
- `stage`: trạng thái ban đầu ước đoán từ email; xem lại trước khi seed lên production.
- `existing`: 1 nếu email ghi "existing relationship".

`ask_type` và `stage` là suy luận từ mô tả trong email, không phải dữ liệu đã được xác nhận.

```csv
name,sector,contacts,ask_type,priority,stage,existing,amount_usd,summary
BMO / Elavon,BANKING_FINANCIAL,Priscilla Lim; Baran Elahi; Phil Jung,CM,IN_MOTION,IN_DISCUSSION,0,,"Corporate member + payments/referral partner. Convert referral relationship into 2027 corporate partnership."
JPMorgan Chase,BANKING_FINANCIAL,Tony Chopp; Vivian Young; Lola Kielsmeier; Malika Lees,RR,NEXT_OUTREACH,PROSPECT,0,,"Banking + founder/private wealth partner"
MidFirst Bank,BANKING_FINANCIAL,An Na Tran,CM,IN_MOTION,IN_DISCUSSION,0,,"Corporate member + advisor opportunity. Follow up on membership + advisor ask."
Bank of America,BANKING_FINANCIAL,"Jaspal ""JP"" Dhillon",CM,NEXT_OUTREACH,PROSPECT,0,,"Corporate membership + banking"
East West Bank,BANKING_FINANCIAL,Angel Pham-Truong,SC,NEXT_OUTREACH,PROSPECT,0,,"Banking + economic summit/founder programming"
Silicon Valley Bank,BANKING_FINANCIAL,Katrina Samonte; Fiona Fan,SC,NEXT_OUTREACH,PROSPECT,0,,"Founder/investor events + startup banking"
Merrill Lynch,BANKING_FINANCIAL,Jay Le,SC,NEXT_OUTREACH,PROSPECT,0,,"Wealth management + dinner sponsorship"
Goldman Sachs,BANKING_FINANCIAL,Alex King,RR,OPPORTUNITY,PROSPECT,0,,"Founder/investor + wealth partnership"
Conventus Lending,BANKING_FINANCIAL,Brenda Chen; Steven Kim,CM,NEXT_OUTREACH,PROSPECT,0,,"Lending/referral + corporate membership"
TomoCredit,BANKING_FINANCIAL,Kristy Kim,RR,BACKLOG,PROSPECT,0,,"Fintech/referral + community partnership"
Robinhood,BANKING_FINANCIAL,Marketing team,SC,BACKLOG,PROSPECT,0,,"Investing/financial education partnership"
Comcast,TECH_COMMERCE_SMB,Joon Kim,CM,IN_MOTION,IN_DISCUSSION,0,,"Corporate member + SMB/Comcast RISE. Follow up with Joon."
T-Mobile,TECH_COMMERCE_SMB,Mitchel,CM,NEXT_OUTREACH,PROSPECT,0,,"Telecom + corporate membership"
ADP,TECH_COMMERCE_SMB,Steven Thuyen; Louisa Guo; Ben Bao,CM,IN_MOTION,IN_DISCUSSION,0,,"Payroll/HR + referral + annual sponsor. Convert sponsorship/affiliate relationship into annual partnership."
SHOPLINE,TECH_COMMERCE_SMB,Alex Ling; Peter Salib; Lily Liu; David Gardner,SC,NEXT_OUTREACH,PROSPECT,0,,"Official commerce/platform partner"
BigCommerce / Commerce,TECH_COMMERCE_SMB,Alex Boxer; John-David Klausner,RR,BACKLOG,PROSPECT,0,,"Agency + merchant referral partnership"
Alibaba.com,TECH_COMMERCE_SMB,Alex Tsai; Kay,SC,NEXT_OUTREACH,PROSPECT,0,,"Sourcing/seller + event partnership"
Walmart,TECH_COMMERCE_SMB,Joanne Tabellija-Murphy,SC,NEXT_OUTREACH,PROSPECT,0,,"Marketplace/seller + corporate partnership"
Meta,TECH_COMMERCE_SMB,Hae Min Lee,SC,NEXT_OUTREACH,PROSPECT,0,,"Entrepreneur/community programming"
Google,TECH_COMMERCE_SMB,,SC,BACKLOG,CONTACTED,1,,"Founder/community programming"
beehiiv,TECH_COMMERCE_SMB,Alec Kremins,SC,OPPORTUNITY,PROSPECT,0,,"Newsletter/media partnership"
NachoNacho,TECH_COMMERCE_SMB,Sanjay Goel,RR,BACKLOG,PROSPECT,0,,"SMB SaaS/member benefits partnership"
Azurium,PROFESSIONAL_SERVICES,Hieu Le; Anurag Kakar; Jason Aroesty,CM,IN_MOTION,PROPOSAL_SENT,0,50000,"$50K AHF partnership proposal - close it."
JLL,PROFESSIONAL_SERVICES,,SC,BACKLOG,CONTACTED,1,,"Real estate/workplace + venue partnership"
SERHANT.,PROFESSIONAL_SERVICES,Kelly Du; Chester Yow,RR,BACKLOG,PROSPECT,0,,"Real estate + founder referrals/events"
Gunderson Dettmer,PROFESSIONAL_SERVICES,Kristie Lam,SC,BACKLOG,PROSPECT,0,,"Legal/startup ecosystem partnership"
Northwestern Mutual,PROFESSIONAL_SERVICES,,RR,BACKLOG,CONTACTED,1,,"Financial planning + founder referrals"
Workstream,PROFESSIONAL_SERVICES,,RR,BACKLOG,CONTACTED,1,,"SMB/HR partnership"
TRI3E,PROFESSIONAL_SERVICES,Steve Liu,SC,BACKLOG,IN_DISCUSSION,0,,"Current content/partnership discussions"
Accomplices,PROFESSIONAL_SERVICES,Tesa Lau; Lexus Johnson,RR,BACKLOG,PROSPECT,0,,"Agency/channel + international campaigns"
Nielsen,CORPORATE_CONSUMER_MEDIA,Stacie deArmas,SC,NEXT_OUTREACH,PROSPECT,0,,"Data/media/community partnership"
Hennessy,CORPORATE_CONSUMER_MEDIA,,SC,NEXT_OUTREACH,CONTACTED,1,,"Events + cultural/community sponsorship"
Southwest Airlines,CORPORATE_CONSUMER_MEDIA,,SC,BACKLOG,CONTACTED,1,,"Travel + event partnership"
T&T Supermarket,CORPORATE_CONSUMER_MEDIA,Emily Chu,SC,NEXT_OUTREACH,PROSPECT,0,,"Asian community/events + consumer partnership"
KIA,CORPORATE_CONSUMER_MEDIA,Jenny Kim; Janice Mah,CM,OPPORTUNITY,PROSPECT,0,,"ERG + corporate partnership"
Steller,CORPORATE_CONSUMER_MEDIA,Annette Taus,CM,NEXT_OUTREACH,CONTACTED,0,50000,"Previously discussed $50K corporate membership"
My Cha,CORPORATE_CONSUMER_MEDIA,Jessica Kim,SC,BACKLOG,PROSPECT,0,,"Events + beverage/community partnership"
New York Asian Film Festival,CORPORATE_CONSUMER_MEDIA,Diana Choi; NYAFF team,SC,BACKLOG,PROSPECT,0,,"Media/content/community partnership"
Great Star Theater,CORPORATE_CONSUMER_MEDIA,Alice Chu,SC,BACKLOG,PROSPECT,0,,"Venue/cultural programming"
Asian Creator Awards,CORPORATE_CONSUMER_MEDIA,Jerry Won,SC,BACKLOG,PROSPECT,0,,"Creator/media partnership"
Singapore Global Network / Singapore EDB,GLOBAL_GOVERNMENT_ECOSYSTEM,Cheryl Lee; Daryl Png; Vincent Song,SC,BACKLOG,PROSPECT,0,,"Multi-year global partnership"
Startup Island TAIWAN,GLOBAL_GOVERNMENT_ECOSYSTEM,,SC,BACKLOG,CONTACTED,1,,"Taiwan/U.S. founder programs"
Clark County,GLOBAL_GOVERNMENT_ECOSYSTEM,Thomas Nally; Kathleen Taylor,SC,OPPORTUNITY,PROSPECT,0,,"Grants + Vegas small-business programming"
National ACE,GLOBAL_GOVERNMENT_ECOSYSTEM,Jan-Ie Low,SC,BACKLOG,PROSPECT,0,,"Entrepreneur programming/community collaboration"
Gold House,GLOBAL_GOVERNMENT_ECOSYSTEM,Daniel Suh,SC,OPPORTUNITY,PROSPECT,0,,"Ecosystem/events/community collaboration"
TAAF,GLOBAL_GOVERNMENT_ECOSYSTEM,,SC,BACKLOG,CONTACTED,1,,"Community/media/programming collaboration"
USPAACC,GLOBAL_GOVERNMENT_ECOSYSTEM,Devin Liao,SC,OPPORTUNITY,PROSPECT,0,,"Business/community partnership"
California Asian Pacific Chamber of Commerce,GLOBAL_GOVERNMENT_ECOSYSTEM,Alison Rivas,SC,OPPORTUNITY,PROSPECT,0,,"Business ecosystem partnership"
APCF,GLOBAL_GOVERNMENT_ECOSYSTEM,Brandon Dugas; Rachel Benitez; Karen Fan,SC,BACKLOG,PROSPECT,0,,"Nonprofit/community programming"
Right to Start,GLOBAL_GOVERNMENT_ECOSYSTEM,Victor Hwang,SC,BACKLOG,PROSPECT,0,,"Entrepreneurship programming/advocacy ecosystem"
```

Khi seed:

- Deal `CM` có `amount_usd` thì gán tier có giá bằng số đó (Title Package $50,000).
- Deal `CM` không có số tiền thì để trống tier (giữ `askType` là `CORPORATE_MEMBERSHIP`). Constraint cho phép điều này ở các stage đầu. Muốn chuyển deal sang `PROPOSAL_SENT` thì phải chọn tier trước; form và action báo lỗi rõ ràng khi chưa chọn.
- `New York Asian Film Festival`: "NYAFF team" lưu thành một contact không có email.
