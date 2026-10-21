import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { InfoLayoutDesktop } from '../components/info/InfoLayoutDesktop';
import { InfoLayoutMobile } from '../components/info/InfoLayoutMobile';
import { LegalArticle, LegalDoc } from '../components/info/LegalDoc';

// 개인정보처리방침 — legal text. Layout only: do not reword the articles below.
const PrivacyKo = () => (
    <>
        <p className="mw-legal__intro">
            몽골리아 은하수(이하 "회사")는 개인정보 보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고,
            이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <LegalArticle no="01" title="제1조 (개인정보의 처리 목적)">
            <p>
                회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
                이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="mw-legal__plain">
                <li>
                    <strong>1. 회원 가입 및 관리</strong>
                    <ul className="mw-legal__plain mw-legal__sub">
                        <li>- 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증</li>
                        <li>- 회원자격 유지·관리, 서비스 부정이용 방지</li>
                    </ul>
                </li>
                <li>
                    <strong>2. 서비스 제공</strong>
                    <ul className="mw-legal__plain mw-legal__sub">
                        <li>- 여행 정보 제공, 예약 중개 서비스 제공</li>
                        <li>- 맞춤형 서비스 제공, 본인인증</li>
                    </ul>
                </li>
                <li>
                    <strong>3. 고충처리</strong>
                    <ul className="mw-legal__plain mw-legal__sub">
                        <li>- 민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지</li>
                        <li>- 처리결과 통보</li>
                    </ul>
                </li>
            </ul>
        </LegalArticle>

        <LegalArticle no="02" title="제2조 (처리하는 개인정보의 항목)">
            <p>회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
            <ul className="mw-legal__plain">
                <li>
                    <strong>1. 필수항목</strong><br />
                    - Google 계정 정보: 이름, 이메일 주소, 프로필 사진
                </li>
                <li>
                    <strong>2. 자동 수집 항목</strong><br />
                    - 서비스 이용기록, 접속 로그, 쿠키, 접속 IP 정보
                </li>
            </ul>
        </LegalArticle>

        <LegalArticle no="03" title="제3조 (개인정보의 처리 및 보유기간)">
            <p>
                1. 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <p>
                2. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:
            </p>
            <ul>
                <li>회원 가입 및 관리: 회원 탈퇴 시까지</li>
                <li>단, 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료 시까지</li>
            </ul>
            <p>3. 관계 법령에 따른 보존:</p>
            <ul>
                <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
                <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="04" title="제4조 (개인정보의 제3자 제공)">
            <p>
                회사는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며,
                이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.
            </p>
            <p>단, 다음의 경우에는 예외로 합니다:</p>
            <ol>
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ol>
        </LegalArticle>

        <LegalArticle no="05" title="제5조 (개인정보처리의 위탁)">
            <p>회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:</p>
            <ul className="mw-legal__plain">
                <li>
                    <strong>1. 클라우드 서비스 제공</strong>
                    <ul className="mw-legal__plain mw-legal__sub">
                        <li>- 수탁업체: Cloudflare, Inc.</li>
                        <li>- 위탁업무 내용: 서버 호스팅 및 데이터 저장</li>
                        <li>- 보유 및 이용기간: 회원 탈퇴 시 또는 위탁계약 종료 시까지</li>
                    </ul>
                </li>
            </ul>
        </LegalArticle>

        <LegalArticle no="06" title="제6조 (정보주체의 권리·의무 및 행사방법)">
            <p>1. 정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:</p>
            <ul>
                <li>개인정보 열람 요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제 요구</li>
                <li>처리정지 요구</li>
            </ul>
            <p>2. 권리 행사는 회사에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체없이 조치하겠습니다.</p>
            <p>3. 정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 회사는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.</p>
        </LegalArticle>

        <LegalArticle no="07" title="제7조 (개인정보의 파기)">
            <p>1. 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
            <p>2. 파기 절차 및 방법:</p>
            <ul>
                <li>파기절차: 불필요하게 된 개인정보는 별도의 DB로 옮겨져 내부 방침 및 관련 법령에 따라 일정기간 저장된 후 파기됩니다.</li>
                <li>파기방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="08" title="제8조 (개인정보의 안전성 확보조치)">
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:</p>
            <ol>
                <li><strong>관리적 조치:</strong> 내부관리계획 수립·시행, 정기적 직원 교육</li>
                <li><strong>기술적 조치:</strong> 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치</li>
                <li><strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근통제</li>
            </ol>
        </LegalArticle>

        <LegalArticle no="09" title="제9조 (개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항)">
            <p>1. 회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.</p>
            <p>2. 쿠키는 웹사이트를 운영하는데 이용되는 서버가 이용자의 컴퓨터 브라우저에게 보내는 소량의 정보이며 이용자의 PC 컴퓨터내의 하드디스크에 저장되기도 합니다.</p>
            <p>3. 쿠키 설치·운영 및 거부:</p>
            <ul>
                <li>웹브라우저 상단의 도구 &gt; 인터넷 옵션 &gt; 개인정보 메뉴의 옵션 설정을 통해 쿠키 저장을 거부할 수 있습니다.</li>
                <li>쿠키 저장을 거부할 경우 맞춤형 서비스 이용에 어려움이 발생할 수 있습니다.</li>
            </ul>
            <p>4. 웹 로그 분석 도구(Google Analytics)의 이용:</p>
            <ul>
                <li>회사는 방문자 수, 유입 경로(검색·SNS 등), 페이지 이용 현황을 파악하여 서비스를 개선하기 위해 Google LLC가 제공하는 Google Analytics를 이용합니다.</li>
                <li>수집 항목: 쿠키 식별자, 방문 일시, 방문한 페이지 주소, 유입 경로(참조 사이트·캠페인 정보), 기기·브라우저·운영체제 정보, 대략적인 접속 지역, 견적 요청 접수 여부(요청 내용은 제외)</li>
                <li>예약 조회·결제·계약서·일정표 등 고객 개인 문서 화면과 마이페이지 등 회원 전용 화면에서는 수집하지 않으며, 페이지 주소에 포함된 고객 조회용 식별값은 전송하지 않습니다. 이름·연락처·이메일 등 이용자를 직접 식별할 수 있는 정보도 전송하지 않습니다.</li>
                <li>수집 거부: 웹브라우저에서 쿠키 저장을 거부하거나, Google이 제공하는 Google Analytics 차단 브라우저 부가기능(<a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">tools.google.com/dlpage/gaoptout</a>)을 설치하여 거부할 수 있습니다. 거부하더라도 서비스 이용에는 제한이 없습니다.</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="09-2" title="제9조의2 (개인정보의 국외 이전)">
            <p>회사는 웹사이트 이용 통계 분석을 위하여 다음과 같이 개인정보를 국외로 이전하고 있습니다.</p>
            <ul className="mw-legal__plain">
                <li>- 이전받는 자: Google LLC (개인정보 문의: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>)</li>
                <li>- 이전되는 국가: 미국 등 Google 데이터센터 소재 국가</li>
                <li>- 이전 일시 및 방법: 웹사이트 방문 시 이용자의 웹브라우저에서 정보통신망을 통해 전송</li>
                <li>- 이전 항목: 제9조 제4항의 수집 항목</li>
                <li>- 이전 목적: 방문 통계 및 유입 경로 분석</li>
                <li>- 보유·이용 기간: 이벤트 데이터 2개월, 사용자 단위 데이터 14개월(재방문 시 기간 갱신). 개인을 식별할 수 없는 합산 통계는 이후에도 보관될 수 있습니다.</li>
                <li>- 거부 방법 및 효과: 제9조 제4항의 방법으로 거부할 수 있으며, 거부하더라도 서비스 이용에는 제한이 없습니다.</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="10" title="제10조 (개인정보 보호책임자)">
            <p>
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="mw-legal__box">
                <p className="mw-legal__label">▶ 개인정보 보호책임자</p>
                <ul className="mw-legal__plain">
                    <li>- 성명: 주수정</li>
                    <li>- 직책: 여행 플래너</li>
                    <li>- 연락처: <a href="mailto:bolor1@hanmail.net">bolor1@hanmail.net</a></li>
                </ul>
                <p className="mw-legal__note">※ 개인정보 보호 담당부서로 연결됩니다.</p>
            </div>
        </LegalArticle>

        <LegalArticle no="11" title="제11조 (개인정보 처리방침의 변경)">
            <p>
                이 개인정보 처리방침은 2026년 10월 21일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
        </LegalArticle>

        <LegalArticle no="12" title="제12조 (권익침해 구제방법)">
            <p>정보주체는 아래의 기관에 대해 개인정보 침해에 대한 피해구제, 상담 등을 문의하실 수 있습니다.</p>

            <div className="mw-legal__cols">
                <div className="mw-legal__box">
                    <p className="mw-legal__label">▶ 개인정보 침해신고센터 (한국인터넷진흥원 운영)</p>
                    <ul className="mw-legal__plain">
                        <li>- 소관업무: 개인정보 침해사실 신고, 상담 신청</li>
                        <li>- 홈페이지: <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer">privacy.kisa.or.kr</a></li>
                        <li>- 전화: (국번없이) 118</li>
                        <li>- 주소: (05717) 서울시 송파구 중대로 135 한국인터넷진흥원 개인정보침해신고센터</li>
                    </ul>
                </div>
                <div className="mw-legal__box">
                    <p className="mw-legal__label">▶ 개인정보 분쟁조정위원회</p>
                    <ul className="mw-legal__plain">
                        <li>- 소관업무: 개인정보 분쟁조정신청, 집단분쟁조정 (민사적 해결)</li>
                        <li>- 홈페이지: <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer">www.kopico.go.kr</a></li>
                        <li>- 전화: (국번없이) 1833-6972</li>
                        <li>- 주소: (03171) 서울특별시 종로구 세종대로 209 정부서울청사 4층</li>
                    </ul>
                </div>
            </div>
        </LegalArticle>

        <div className="mw-legal__box">
            <p className="mw-legal__label">부칙</p>
            <p>본 방침은 2026년 10월 21일부터 시행됩니다.</p>
            <p>종전 방침(2026년 1월 23일 시행)에 Google Analytics 이용(제9조 제4항)과 개인정보의 국외 이전(제9조의2)을 추가했습니다.</p>
        </div>
    </>
);

export const PrivacyPolicy = () => {
    const isDesktop = useIsDesktop();

    const seo = (
        <SEO
            title="개인정보처리방침"
            description="몽골리아 은하수의 개인정보처리방침입니다."
        />
    );

    const doc = (
        <LegalDoc
            compact={!isDesktop}
            effective="시행일: 2026년 10월 21일"
        >
            <PrivacyKo />
        </LegalDoc>
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <InfoLayoutDesktop page="privacyDoc">{doc}</InfoLayoutDesktop>
            </>
        );
    }

    return (
        <>
            {seo}
            <InfoLayoutMobile page="privacyDoc">{doc}</InfoLayoutMobile>
        </>
    );
};

export default PrivacyPolicy;
