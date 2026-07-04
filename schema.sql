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

-- 콘텐츠 라이브러리(명소·코스·일정·일정 카테고리) 서버 영구 저장
-- /api/data/:key 가 접속 시 자동으로 만들기도 하지만, 배포 때 함께 실행해 두면 좋습니다.
CREATE TABLE IF NOT EXISTS kv (
  k           TEXT PRIMARY KEY,   -- spots / spot_cats / courses / snippets / snippet_cats
  v           TEXT,               -- 값(JSON 문자열)
  updated_at  TEXT                -- 마지막 저장 시각(ISO)
);
