-- 리더스투어 몽골리아 · 견적 문의 데이터베이스 (Cloudflare D1)
-- 배포 설정 때 한 번 실행합니다 (배포안내.txt 참고).

CREATE TABLE IF NOT EXISTS requests (
  id           TEXT PRIMARY KEY,   -- 고유 ID (접수시각_전화번호)
  received_at  TEXT,               -- 접수 시각 (ISO)
  name         TEXT,               -- 신청자 이름
  phone        TEXT,               -- 휴대폰
  destination  TEXT,               -- 희망 투어 (목록용)
  budget       TEXT,               -- 예산 (목록용)
  status       TEXT DEFAULT '신규', -- 신규/진행중/완료/보류
  memo         TEXT DEFAULT '',    -- 상담 메모
  data         TEXT,               -- 전체 내용 JSON
  token        TEXT                -- 고객 마이페이지 매직링크 토큰(추측 불가)
);

CREATE INDEX IF NOT EXISTS idx_received ON requests(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_token ON requests(token);
