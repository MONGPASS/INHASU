// Shared by the PC/mobile quote and the product editor. The key identifies the quote icon.
export const quoteInclusions = [
  ["stay", "전일정 숙박"],
  ["meals", "전일정 현지 맛집 식사"],
  ["special", "특식 2회"],
  ["pickup", "픽업 & 샌딩"],
  ["vehicle", "전일정 차량"],
  ["guide", "전문 가이드"],
  ["entrance", "여행지 입장료"],
  ["water", "1일 1생수 제공"],
  ["activity", "액티비티 비용"],
  ["custom", "맞춤형 투어"],
  ["coffee", "모카포트 커피"],
  ["chair", "캠핑 의자 · 테이블"],
  ["socks", "몽골 낙타양말"],
  ["poncho", "판초 제공"],
  ["galaxy", "새벽 은하수 헌팅"],
];

export const quoteIncludedLabels = quoteInclusions.map(([, label]) => label);
export const quoteExclusions = ["왕복 항공권", "개인경비", "선택관광 비용", "여행자 보험", "휴대폰 유심비"];
