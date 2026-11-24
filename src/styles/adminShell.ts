/*
 * 관리자 틀 CSS 네 장을 정해진 순서로 한 번에 가져온다: 기본(admin-console) → 상단 바·사이드바(admin-shell-v3)
 * → Seed 모양(admin-montage) → 휴대폰 앱 틀(admin-mobile). 뒤 파일이 같은 세기의 앞 규칙을 덮는 것을 전제로 짜여 있다.
 *
 * AdminLayout과 관리자 로그인이 모두 이 모듈 하나만 가져온다. 두 곳이 CSS 파일을 따로 가져오면 빌드가 admin-console.css를
 * 따로 떼어 내 어떤 모듈과 묶느냐에 따라 읽는 순서가 바뀐다(2026-11-24: 상단 바 도구가 console/Icon을 그만 쓰자
 * admin-console.css가 맨 뒤에 읽혀 머리 격자가 풀렸다). 이 모듈로 네 장이 항상 한 파일에 이 순서로 들어간다.
 */
import './admin-console.css';
import './admin-shell-v3.css';
import './admin-montage.css';
import './admin-mobile.css';
