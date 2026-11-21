import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconCalendar, IconDownload, IconMoreHorizontal, IconPlus, IconTrash } from '@montage-ui/icon';
import {
    AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminChip, AdminChipGroup, AdminDataTable, AdminDialog,
    AdminEmpty, AdminError, AdminField, AdminIconButton, AdminLoading, AdminMessage,
    AdminPagination, AdminSearch, AdminSegmented, AdminSelect, AdminStat, AdminStatRow, AdminTabs, AdminTextArea,
    AdminTextButton, AdminTextInput, adminConfirm, adminNotify, adminValidateRequired,
    type AdminColumn, type AdminTone,
} from '../components/admin/ui';
import {
    AdminDetailHeader, AdminFilterBar, AdminFormSection, AdminGrid, AdminSteps, DashboardPage, DetailPage, FormPage, ListPage,
} from '../components/admin/ui/AdminPage';

/**
 * 관리자 부품 미리보기(개발·확인용, 운영 메뉴에 넣지 않는다). 주소: /admin/__ui (`?frame=list|form|detail|dashboard`로 화면 틀 보기)
 * 자료는 모두 이 파일 안의 합성 예시이며 API를 부르지 않는다.
 */
type Frame = 'parts' | 'list' | 'form' | 'detail' | 'dashboard';
const FRAMES: { value: Frame; label: string }[] = [
    { value: 'parts', label: '부품' }, { value: 'list', label: '목록형' }, { value: 'form', label: '입력형' },
    { value: 'detail', label: '상세형' }, { value: 'dashboard', label: '대시보드형' },
];

interface SampleRow { id: string; customer: string; product: string; start: string; people: number; amount: number; status: string; tone: AdminTone }
const SAMPLE: SampleRow[] = [
    { id: 'R-1031', customer: '김하늘', product: '고비 사막 5박 6일', start: '2026-12-02', people: 4, amount: 5160000, status: '예약금 대기', tone: 'warn' },
    { id: 'R-1030', customer: '이서준', product: '테를지 2박 3일', start: '2026-12-05', people: 2, amount: 1580000, status: '확정', tone: 'success' },
    { id: 'R-1029', customer: '박민지', product: '홉스골 6박 7일', start: '2026-12-11', people: 6, amount: 9240000, status: '계약 동의 대기', tone: 'info' },
    { id: 'R-1028', customer: '최도윤', product: '맞춤 견적 · 중부', start: '2026-12-14', people: 3, amount: 3390000, status: '배정 필요', tone: 'danger' },
    { id: 'R-1027', customer: '정예린', product: '고비 사막 4박 5일', start: '2026-11-18', people: 2, amount: 2180000, status: '여행 완료', tone: 'neutral' },
];
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const columns: AdminColumn<SampleRow>[] = [
    { key: 'customer', header: '고객', render: (r) => <><b>{r.customer}</b><div className="adm-ui-field-hint">{r.id}</div></> },
    { key: 'product', header: '상품', render: (r) => r.product },
    { key: 'start', header: '출발일', render: (r) => r.start, nowrap: true },
    { key: 'people', header: '인원', render: (r) => `${r.people}명`, align: 'right' },
    { key: 'amount', header: '금액', render: (r) => won(r.amount), align: 'right', nowrap: true },
    { key: 'status', header: '상태', render: (r) => <AdminBadge tone={r.tone}>{r.status}</AdminBadge> },
    { key: 'actions', header: '관리', render: () => <AdminButton size="sm">열기</AdminButton>, align: 'right' },
];

const SampleTable: React.FC<{ rows?: SampleRow[] }> = ({ rows = SAMPLE }) => (
    <AdminDataTable label="예약 예시" columns={columns} rows={rows} rowKey={(r) => r.id}
        empty={<AdminEmpty title="조건에 맞는 예약이 없습니다" description="검색어나 필터를 바꿔 보세요." />} />
);

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <AdminCard title={title} description={description}><div className="adm-ui-preview-row">{children}</div></AdminCard>
);

function PartsPreview() {
    const [name, setName] = useState('');
    const [memo, setMemo] = useState('');
    const [region, setRegion] = useState('gobi');
    const [agree, setAgree] = useState(true);
    const [q, setQ] = useState('');
    const [chip, setChip] = useState('all');
    const [seg, setSeg] = useState('card');
    const [tab, setTab] = useState('progress');
    const [page, setPage] = useState(2);
    const [dialog, setDialog] = useState<null | 'sm' | 'md'>(null);
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const save = () => {
        if (!adminValidateRequired()) return;
        setSaving(true);
        window.setTimeout(() => { setSaving(false); setDialog(null); setName(''); setMemo(''); adminNotify('저장했습니다.'); }, 800);
    };

    return (
        <>
            <AdminMessage title="미리보기 화면입니다">부품 모양 확인용이며 운영 자료를 읽거나 저장하지 않습니다. 버튼을 눌러도 바깥에 보내는 것은 없습니다.</AdminMessage>

            <Section title="버튼" description="주요는 화면당 하나(민트 채움 + 검은 글자). 줄마다 있는 행동은 보조 32px.">
                <AdminButton variant="primary" leading={<IconPlus />}>예약 추가</AdminButton>
                <AdminButton variant="secondary" leading={<IconDownload />}>Excel 내려받기</AdminButton>
                <AdminButton variant="weak">임시 보관</AdminButton>
                <AdminButton variant="danger" leading={<IconTrash />}>삭제</AdminButton>
                <AdminButton variant="primary" loading>저장 중…</AdminButton>
                <AdminButton variant="secondary" disabled>잠김</AdminButton>
            </Section>
            <Section title="버튼 크기 · 아이콘 · 글자 버튼">
                <AdminButton variant="primary" size="sm">작게 32</AdminButton>
                <AdminButton variant="primary" size="md">보통 40</AdminButton>
                <AdminButton variant="primary" size="lg">크게 48</AdminButton>
                <AdminIconButton label="더 보기"><IconMoreHorizontal /></AdminIconButton>
                <AdminIconButton label="달력" variant="outlined"><IconCalendar /></AdminIconButton>
                <AdminTextButton>전체 보기</AdminTextButton>
                <AdminTextButton tone="assistive">취소</AdminTextButton>
            </Section>

            <AdminCard title="입력 칸" description="라벨은 위 13px 600, 필수는 빨간 *, 오류는 칸 아래.">
                <div className="adm-ui-form-grid">
                    <AdminField label="고객 이름" required error={nameError} hint="여권 영문 이름이 아니라 부를 이름">
                        {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} value={name} invalid={!!nameError} placeholder="예: 김하늘"
                            onChange={(e) => { setName(e.target.value); setNameError(null); }} onBlur={() => setNameError(name.trim() ? null : '고객 이름을 입력해 주세요.')} />}
                    </AdminField>
                    <AdminField label="여행 지역">
                        {(id) => <AdminSelect id={id} value={region} onChange={setRegion} options={[{ value: 'gobi', label: '고비 사막' }, { value: 'terelj', label: '테를지' }, { value: 'khuvsgul', label: '홉스골' }]} />}
                    </AdminField>
                    <AdminField label="1인 금액" aside="원 단위">
                        {(id) => <AdminTextInput id={id} inputMode="numeric" defaultValue="1290000" trailing="원" />}
                    </AdminField>
                    <AdminField label="검색 칸">
                        {() => <AdminSearch value={q} onChange={setQ} placeholder="고객·예약번호 검색" wide />}
                    </AdminField>
                    <AdminField label="내부 메모" aside={`${memo.length}/200`}>
                        {(id) => <AdminTextArea id={id} value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} placeholder="고객에게 보이지 않습니다" />}
                    </AdminField>
                    <div className="is-full"><AdminCheckbox checked={agree} onChange={setAgree} label="출발 3일 전 안내 자동 발송" /></div>
                </div>
            </AdminCard>

            <Section title="상태 배지" description="색만으로 알리지 않도록 늘 글자와 함께.">
                <AdminBadge tone="danger">미처리</AdminBadge>
                <AdminBadge tone="warn">예약금 대기</AdminBadge>
                <AdminBadge tone="success">확정</AdminBadge>
                <AdminBadge tone="info">진행 중</AdminBadge>
                <AdminBadge tone="neutral">종료</AdminBadge>
                <AdminBadge tone="info" strong>D-3</AdminBadge>
                <AdminBadge tone="tag-blue">상품</AdminBadge>
                <AdminBadge tone="tag-violet">견적</AdminBadge>
            </Section>

            <AdminCard title="칩 · 묶음 전환 · 탭">
                <div className="adm-ui-preview-stack">
                    <AdminChipGroup label="빠른 필터" value={chip} onChange={setChip} items={[{ value: 'all', label: '전체', count: 128 }, { value: 'deposit', label: '예약금 대기', count: 6 }, { value: 'assign', label: '배정 필요', count: 3 }, { value: 'soon', label: '7일 안 출발', count: 9 }]} />
                    <AdminChip active={false} count={2}>단독 칩</AdminChip>
                    <AdminSegmented label="보기" value={seg} onChange={setSeg} items={[{ value: 'card', label: '카드' }, { value: 'list', label: '목록' }, { value: 'calendar', label: '달력' }]} />
                    <AdminTabs label="진행 상태" value={tab} onChange={setTab} items={[{ value: 'progress', label: '진행 중', count: 42, tone: 'info' }, { value: 'waiting', label: '확인 필요', count: 7, tone: 'warn' }, { value: 'done', label: '완료', count: 310, tone: 'success' }, { value: 'cancel', label: '취소', count: 12 }]} />
                </div>
            </AdminCard>

            <AdminCard title="지표">
                <AdminStatRow>
                    <AdminStat label="오늘 출발" value={3} unit="팀" hint="어제보다 1팀 많음" />
                    <AdminStat label="예약금 확인" value={6} unit="건" attention hint="입금 신고 들어옴" />
                    <AdminStat label="이번 달 매출" value="4,820" unit="만원" />
                    <AdminStat label="배정 필요" value={2} unit="팀" onClick={() => adminNotify('필터 예시입니다.', 'info')} />
                </AdminStatRow>
            </AdminCard>

            <AdminCard title="표 · 페이지" flush>
                <SampleTable />
                <div className="adm-ui-list-foot"><AdminPagination page={page} totalPages={7} onChange={setPage} summary="전체 128건" /></div>
            </AdminCard>

            <AdminGrid columns={3}>
                <AdminCard title="빈 목록"><AdminEmpty title="아직 예약이 없습니다" description="첫 예약을 추가해 보세요." action={<AdminButton variant="secondary" leading={<IconPlus />}>예약 추가</AdminButton>} /></AdminCard>
                <AdminCard title="불러오는 중"><AdminLoading /></AdminCard>
                <AdminCard title="오류"><AdminError reason="연결이 끊겼습니다. 입력한 내용은 그대로 있습니다." onRetry={() => adminNotify('다시 시도 예시입니다.', 'info')} /></AdminCard>
            </AdminGrid>

            <AdminCard title="화면 안 알림">
                <div className="adm-ui-preview-stack">
                    <AdminMessage title="초안을 찾았습니다" actions={<><AdminTextButton>복원</AdminTextButton><AdminTextButton tone="assistive">버리기</AdminTextButton></>}>마지막으로 고친 시각: 오늘 14:02</AdminMessage>
                    <AdminMessage tone="cautionary" title="일부 자료를 불러오지 못했습니다">불러온 예약만 표시합니다.</AdminMessage>
                    <AdminMessage tone="negative" title="저장하지 못했습니다">다른 화면에서 먼저 저장했습니다. 새로 불러온 뒤 다시 저장하세요.</AdminMessage>
                    <AdminMessage tone="positive" title="고객에게 공개했습니다" />
                </div>
            </AdminCard>

            <Section title="팝업 · 확인 · 알림" description="팝업은 휴대폰에서 아래 시트. 고친 내용이 있으면 닫기 전에 묻는다.">
                <AdminButton onClick={() => setDialog('md')}>입력 팝업(640)</AdminButton>
                <AdminButton onClick={() => setDialog('sm')}>짧은 팝업(440)</AdminButton>
                <AdminButton onClick={() => { void adminConfirm({ message: '‘R-1031 김하늘’ 예약을 삭제할까요? 되돌릴 수 없습니다.', danger: true }).then((ok) => adminNotify(ok ? '삭제 예시를 눌렀습니다(실제로 지우지 않음).' : '취소했습니다.', 'info')); }}>삭제 확인 창</AdminButton>
                <AdminButton onClick={() => adminNotify('저장했습니다.')}>알림(성공)</AdminButton>
                <AdminButton onClick={() => adminNotify('저장하지 못했습니다.', 'error')}>알림(오류)</AdminButton>
            </Section>

            <AdminDialog open={dialog === 'md'} onClose={() => setDialog(null)} title="예약 추가" description="상품을 고르거나 맞춤 예약으로 작성합니다."
                dirty={!!name || !!memo} onSubmit={save} submitting={saving} onDelete={() => adminNotify('삭제 예시입니다.', 'info')}>
                <AdminField label="고객 이름" required>{(id) => <AdminTextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}</AdminField>
                <AdminField label="상품">{(id) => <AdminSelect id={id} value={region} onChange={setRegion} options={[{ value: 'gobi', label: '고비 사막 5박 6일' }, { value: 'terelj', label: '테를지 2박 3일' }]} />}</AdminField>
                <AdminField label="메모">{(id) => <AdminTextArea id={id} value={memo} onChange={(e) => setMemo(e.target.value)} />}</AdminField>
            </AdminDialog>
            <AdminDialog open={dialog === 'sm'} size="sm" onClose={() => setDialog(null)} title="일정표 공개" description="공개하면 고객 링크에서 바로 볼 수 있습니다."
                onSubmit={() => { setDialog(null); adminNotify('공개 예시를 눌렀습니다(실제로 공개하지 않음).', 'info'); }} submitLabel="공개" />
        </>
    );
}

const frameSwitch = (value: Frame, onChange: (v: Frame) => void) => <AdminSegmented label="미리보기 종류" value={value} onChange={onChange} items={FRAMES} />;

export const AdminUiPreview: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const frame = (FRAMES.some((f) => f.value === params.get('frame')) ? params.get('frame') : 'parts') as Frame;
    const go = (next: Frame) => setParams(next === 'parts' ? {} : { frame: next }, { replace: true });
    const [q, setQ] = useState('');
    const [chip, setChip] = useState('all');
    const [tab, setTab] = useState('progress');
    const [sort, setSort] = useState('pri');
    const [page, setPage] = useState(1);
    const rows = useMemo(() => SAMPLE.filter((r) => !q || `${r.customer}${r.id}${r.product}`.includes(q)).filter((r) => chip === 'all' || (chip === 'warn' ? r.tone === 'warn' : r.tone === 'danger')), [q, chip]);
    const common = { activePage: 'ui-preview', showSearch: false } as const;

    if (frame === 'list') return (
        <ListPage {...common} title="통합 예약 (예시)" description="목록형 틀: 제목 + 추가 → 요약 → 탭 → 검색 줄 → 표 → 페이지"
            actions={<>{frameSwitch(frame, go)}<AdminButton variant="primary" leading={<IconPlus />}>예약 추가</AdminButton></>}
            summary={<AdminStatRow><AdminStat label="진행 중" value={42} unit="건" /><AdminStat label="확인 필요" value={7} unit="건" attention /><AdminStat label="7일 안 출발" value={9} unit="팀" /><AdminStat label="이번 달 매출" value="4,820" unit="만원" /></AdminStatRow>}
            tabs={<AdminTabs label="진행 상태" value={tab} onChange={setTab} items={[{ value: 'progress', label: '진행 중', count: 42 }, { value: 'waiting', label: '확인 필요', count: 7 }, { value: 'done', label: '완료', count: 310 }]} />}
            filters={<AdminFilterBar search={<AdminSearch value={q} onChange={setQ} placeholder="고객·예약번호·상품" />}
                filters={<AdminChipGroup label="빠른 필터" value={chip} onChange={setChip} items={[{ value: 'all', label: '전체', count: SAMPLE.length }, { value: 'warn', label: '예약금 대기', count: 1 }, { value: 'danger', label: '배정 필요', count: 1 }]} />}
                end={<AdminSegmented label="정렬" value={sort} onChange={setSort} items={[{ value: 'pri', label: '우선순위' }, { value: 'dep', label: '출발일순' }, { value: 'bk', label: '최근 예약순' }]} />} />}
            pagination={<AdminPagination page={page} totalPages={5} onChange={setPage} summary={`전체 ${rows.length}건`} />}>
            <SampleTable rows={rows} />
        </ListPage>
    );

    if (frame === 'form') return (
        <FormPage {...common} title="상품 수정 (예시)" description="입력형 틀: 목록으로 → 구역 카드 → 아래 고정 막대" actions={frameSwitch(frame, go)}
            backTo="/admin/__ui?frame=list" status="고친 내용 있음 · 이 브라우저에 자동 보관됨"
            onCancel={() => adminNotify('취소 예시입니다.', 'info')} onSubmit={() => { if (adminValidateRequired()) adminNotify('저장 예시를 눌렀습니다(실제로 저장하지 않음).', 'info'); }}>
            <AdminFormSection title="기본 정보" description="고객 화면 상단에 보입니다.">
                <AdminField label="상품 이름" required>{(id) => <AdminTextInput id={id} defaultValue="고비 사막 5박 6일" />}</AdminField>
                <AdminField label="지역">{(id) => <AdminSelect id={id} value="gobi" options={[{ value: 'gobi', label: '고비 사막' }, { value: 'terelj', label: '테를지' }]} />}</AdminField>
                <AdminField label="소개">{(id) => <AdminTextArea id={id} defaultValue="은하수와 모래 언덕을 함께 보는 대표 일정" />}</AdminField>
            </AdminFormSection>
            <AdminFormSection title="가격">
                <AdminField label="1인 금액" required>{(id) => <AdminTextInput id={id} inputMode="numeric" defaultValue="1290000" trailing="원" />}</AdminField>
                <AdminField label="예약금" hint="출발 30일 전까지">{(id, d) => <AdminTextInput id={id} aria-describedby={d} inputMode="numeric" defaultValue="300000" trailing="원" />}</AdminField>
            </AdminFormSection>
        </FormPage>
    );

    if (frame === 'detail') return (
        <DetailPage {...common} title="고객 예약 관리 (예시)" description="상세형 틀: 머리 카드 → 진행 단계 → 왼쪽 업무 / 오른쪽 고정 정보 → 이력" actions={frameSwitch(frame, go)}
            backTo="/admin/__ui?frame=list"
            header={<AdminDetailHeader title="김하늘 님 · 고비 사막 5박 6일" badges={<><AdminBadge tone="tag-blue">상품</AdminBadge><AdminBadge tone="warn">예약금 대기</AdminBadge></>}
                meta={<><span>2026-12-02 ~ 12-07</span><span>4명</span><span>{won(5160000)}</span></>}
                actions={<><AdminButton>고객에게 전달</AdminButton><AdminButton variant="primary">일정표 편집</AdminButton></>} />}
            steps={<AdminSteps steps={[{ key: 'a', label: '예약 접수', state: 'done' }, { key: 'b', label: '예약금 확인', state: 'current', hint: '입금 신고 들어옴' }, { key: 'c', label: '계약 동의', state: 'todo' }, { key: 'd', label: '일정 준비', state: 'todo' }, { key: 'e', label: '일정표 공개', state: 'todo' }]} />}
            aside={<><AdminCard title="결제"><AdminStat label="잔금" value="4,860,000" unit="원" /></AdminCard><AdminCard title="배정"><AdminMessage tone="cautionary" title="가이드 미배정">출발 11일 전입니다.</AdminMessage></AdminCard></>}
            history={<AdminCard title="이력"><AdminEmpty title="아직 이력이 없습니다" /></AdminCard>}>
            <AdminCard title="예약금 확인" actions={<AdminButton size="sm">입금 확인</AdminButton>}>
                <p className="adm-ui-state-text">입금자명 ‘김하늘’ · 300,000원 · 오늘 10:12 신고</p>
            </AdminCard>
            <AdminCard title="일자별 일정" flush><SampleTable rows={SAMPLE.slice(0, 2)} /></AdminCard>
        </DetailPage>
    );

    if (frame === 'dashboard') return (
        <DashboardPage {...common} title="대시보드 (예시)" description="대시보드형 틀: 제목 + 기간 → 요약 줄 → 카드 격자"
            actions={<>{frameSwitch(frame, go)}<AdminSegmented label="기간" value="week" onChange={() => undefined} items={[{ value: 'today', label: '오늘' }, { value: 'week', label: '이번 주' }, { value: 'month', label: '이번 달' }]} /></>}
            summary={<AdminStatRow><AdminStat label="오늘 업무" value={5} unit="건" attention /><AdminStat label="새 견적 요청" value={3} unit="건" /><AdminStat label="이번 주 출발" value={4} unit="팀" /><AdminStat label="이번 달 매출" value="4,820" unit="만원" /></AdminStatRow>}>
            <AdminGrid columns={2}>
                <AdminCard title="오늘 업무" actions={<AdminTextButton size="sm">전체 보기</AdminTextButton>} flush><SampleTable rows={SAMPLE.slice(0, 3)} /></AdminCard>
                <AdminCard title="최근 견적 요청"><AdminEmpty title="새 견적 요청이 없습니다" /></AdminCard>
            </AdminGrid>
        </DashboardPage>
    );

    return (
        <DashboardPage {...common} title="관리자 부품 미리보기" description="components/admin/ui — 화면은 이 부품만 씁니다(Montage는 부품 안에서만)." actions={frameSwitch(frame, go)}>
            <PartsPreview />
        </DashboardPage>
    );
};
