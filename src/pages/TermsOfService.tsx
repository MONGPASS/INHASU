import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { InfoLayoutDesktop } from '../components/info/InfoLayoutDesktop';
import { InfoLayoutMobile } from '../components/info/InfoLayoutMobile';
import { LegalArticle, LegalDoc } from '../components/info/LegalDoc';

// 이용약관 — legal text. Layout only: do not reword the articles below.
const TermsKo = () => (
    <>
        <LegalArticle no="01" title="제1조 (목적)">
            <p>
                본 약관은 몽골리아 은하수(이하 "회사")가 제공하는 서비스의 이용조건 및 절차, 회사와 회원 간의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.
            </p>
        </LegalArticle>

        <LegalArticle no="02" title="제2조 (약관의 효력 및 변경)">
            <p>
                1. 본 약관은 서비스를 이용하고자 하는 모든 회원에게 효력을 발생합니다.<br />
                2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 변경할 수 있으며, 변경 시 서비스 내 공지사항을 통해 공지합니다.
            </p>
        </LegalArticle>

        <LegalArticle no="03" title="제3조 (서비스의 제공)">
            <p>회사는 회원에게 다음과 같은 서비스를 제공합니다.</p>
            <ul>
                <li>여행 정보 제공 서비스</li>
                <li>여행 상품 예약 및 중개 서비스</li>
                <li>커뮤니티 서비스</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="04" title="제4조 (회원가입 및 계정관리)">
            <ul className="mw-legal__plain">
                <li>1. 회원은 Google 계정을 통해 간편하게 가입할 수 있습니다.</li>
                <li>2. 회원은 자신의 계정 정보를 안전하게 관리할 책임이 있으며, 타인에게 양도하거나 대여할 수 없습니다.</li>
                <li>3. 회원 탈퇴는 서비스 내 설정 메뉴를 통해 가능합니다.</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="05" title="제5조 (개인정보의 수집 및 이용)">
            <p>1. 회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다:</p>
            <ul className="mw-legal__plain">
                <li>- 이름, 이메일 주소, 프로필 사진 (Google 계정 기본 정보)</li>
            </ul>
            <p>2. 수집된 개인정보는 다음의 목적으로 이용됩니다:</p>
            <ul className="mw-legal__plain">
                <li>- 회원 식별 및 본인 확인</li>
                <li>- 서비스 제공 및 개선</li>
                <li>- 고객 문의 응대</li>
            </ul>
            <p>3. 자세한 내용은 개인정보처리방침을 참조하시기 바랍니다.</p>
        </LegalArticle>

        <LegalArticle no="06" title="제6조 (회원의 의무)">
            <p>회원은 다음 행위를 하여서는 안 됩니다:</p>
            <ul className="mw-legal__plain">
                <li>1. 타인의 정보 도용</li>
                <li>2. 허위 정보 등록</li>
                <li>3. 불법적이거나 부적절한 콘텐츠 게시</li>
                <li>4. 서비스 운영 방해 행위</li>
            </ul>
        </LegalArticle>

        <LegalArticle no="07" title="제7조 (서비스 이용제한)">
            <p>
                회사는 회원이 본 약관을 위반한 경우 서비스 이용을 제한하거나 회원 자격을 정지 또는 상실시킬 수 있습니다.
            </p>
        </LegalArticle>

        <LegalArticle no="08" title="제8조 (회사의 의무 및 면책)">
            <p>
                1. 회사는 관련 법령과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적이고 안정적으로 서비스를 제공하기 위하여 최선을 다하여 노력합니다.<br />
                2. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적 사유로 인한 서비스 중단에 대해서는 책임을 지지 않습니다.
            </p>
        </LegalArticle>

        <LegalArticle no="09" title="제9조 (분쟁해결)">
            <p>
                1. 회사와 회원 간 발생한 분쟁에 대해서는 상호 협의하여 해결합니다.<br />
                2. 협의가 이루어지지 않을 경우 대한민국 법률에 따르며, 회사의 본사 소재지 관할 법원을 제1심 관할 법원으로 합니다.
            </p>
        </LegalArticle>

        <div className="mw-legal__box">
            <p className="mw-legal__label">부칙</p>
            <p>본 약관은 2026년 1월 23일부터 시행됩니다.</p>
        </div>
    </>
);

export const TermsOfService = () => {
    const isDesktop = useIsDesktop();

    const seo = (
        <SEO
            title="이용약관"
            description="몽골리아 은하수의 이용약관입니다."
        />
    );

    const doc = (
        <LegalDoc
            compact={!isDesktop}
            effective="시행일: 2026년 1월 23일"
        >
            <TermsKo />
        </LegalDoc>
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <InfoLayoutDesktop page="termsDoc">{doc}</InfoLayoutDesktop>
            </>
        );
    }

    return (
        <>
            {seo}
            <InfoLayoutMobile page="termsDoc">{doc}</InfoLayoutMobile>
        </>
    );
};

export default TermsOfService;
