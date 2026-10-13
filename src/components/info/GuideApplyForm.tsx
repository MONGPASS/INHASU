import { useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { uploadImage } from '../../utils/upload';
import { MW, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { Ico } from '../mobile/mobileUi';

// 저장되는 값은 관리자 화면(AdminGuideManage / AdminTemplateManage)의 선택지와 같은 문자열로 맞춘다.
const LANGUAGES = ['한국어', '영어', '몽골어', '중국어', '일본어'];
const SPECIALTIES = ['고비사막', '홉스굴', '테를지', '승마', '문화체험', '사진촬영'];
// 화면 표시용 라벨(저장 값과 표기가 다른 것만).
const CHIP_LABELS: Record<string, string> = { '문화체험': '문화 체험', '사진촬영': '사진 촬영' };

const PERSON = 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6';
const UPLOAD = 'M12 16V4M7 9l5-5 5 5M5 20h14';
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';

type FieldKey = 'name' | 'phone' | 'years' | 'bio';

const labelText: CSSProperties = { fontSize: 13, fontWeight: 700, color: MW.ink3 };
const fieldBase: CSSProperties = {
    boxSizing: 'border-box', width: '100%', border: `1.5px solid ${MW.line2}`, borderRadius: 14, fontFamily: 'inherit', fontSize: 16, color: MW.navy,
    background: '#fff', outline: 'none', boxShadow: 'none',
};

function Chips({ id, label, options, selected, onToggle }: { id: string; label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span id={id} style={labelText}>{label}</span>
            <div role="group" aria-labelledby={id} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {options.map((o) => {
                    const on = selected.includes(o);
                    return (
                        <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onToggle(o)}
                            style={{ height: 38, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${on ? MW.mint : MW.line2}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            {CHIP_LABELS[o] ?? o}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelText}>
                {label}
                {required && <span style={{ color: MW.red }}> *</span>}
            </span>
            {children}
        </label>
    );
}

/** 가이드 등록 신청 form (POST /api/tour-guides/apply). `compact` = mobile paddings. */
export function GuideApplyForm({ compact = false }: { compact?: boolean }) {
    const [form, setForm] = useState({
        name: '',
        phone: '',
        bio: '',
        experience_years: '',
        image: '',
        languages: [] as string[],
        specialties: [] as string[],
    });
    const [imagePreview, setImagePreview] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focus, setFocus] = useState<FieldKey | null>(null);

    const toggle = (field: 'languages' | 'specialties', value: string) => {
        setForm((prev) => ({
            ...prev,
            [field]: prev[field].includes(value)
                ? prev[field].filter((v) => v !== value)
                : [...prev[field], value],
        }));
    };

    const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImagePreview(URL.createObjectURL(file));
        setImageUploading(true);
        try {
            const url = await uploadImage(file, 'guides');
            setForm((prev) => ({ ...prev, image: url }));
        } catch {
            setError('이미지 업로드에 실패했습니다. 다시 시도해 주세요.');
        } finally {
            setImageUploading(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim()) {
            setError('이름과 전화번호는 필수입니다.');
            return;
        }
        if (imageUploading) {
            setError('이미지 업로드가 끝날 때까지 기다려 주세요.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/tour-guides/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    experience_years: form.experience_years ? Number(form.experience_years) : 0,
                }),
            });
            if (!res.ok) throw new Error('전송에 실패했습니다.');
            setSubmitted(true);
        } catch (err) {
            setError((err instanceof Error && err.message) || '전송에 실패했습니다. 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const card: CSSProperties = {
        maxWidth: 640, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, padding: compact ? '22px 18px' : 28,
        border: `1px solid ${MW.line}`, borderRadius: compact ? 20 : 24, background: '#fff',
    };
    const input = (k: FieldKey): CSSProperties => ({ ...fieldBase, height: 50, padding: '0 14px', borderColor: focus === k ? MW.mint : MW.line2 });
    const bind = (k: FieldKey) => ({ onFocus: () => setFocus(k), onBlur: () => setFocus(null) });

    if (submitted) {
        return (
            <div role="status" style={{ ...card, alignItems: 'center', gap: 12, padding: '40px 24px', textAlign: 'center' }}>
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico d={CHECK} size={26} color={MW.mintDeep} width={2.2} />
                </span>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>신청이 접수되었습니다</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, color: MW.mute }}>
                    신청해 주셔서 감사합니다.<br />
                    담당자가 내용을 확인한 뒤 <strong style={{ color: MW.navy }}>2~3영업일 이내</strong>에 연락드리겠습니다.
                </p>
            </div>
        );
    }

    const busy = loading || imageUploading;

    return (
        <form onSubmit={handleSubmit} noValidate style={card}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>가이드 등록 신청</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelText}>프로필 사진</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: MW.chip, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {imagePreview
                            ? <img src={imagePreview} alt="프로필 사진 미리보기" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <Ico d={PERSON} size={30} color={MW.dot} />}
                    </span>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px', border: `1px solid ${MW.line2}`, borderRadius: 999, background: '#fff', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: imageUploading ? 'default' : 'pointer', opacity: imageUploading ? 0.6 : 1 }}>
                            <Ico d={UPLOAD} size={16} color={MW.mintDeep} />
                            {imageUploading ? '업로드 중...' : '사진 선택'}
                            <input type="file" accept="image/*" onChange={handleImageChange} disabled={imageUploading} style={{ display: 'none' }} />
                        </label>
                        <span style={{ fontSize: 12, color: MW.mute2 }}>JPG, PNG, WEBP 지원</span>
                    </div>
                </div>
            </div>

            <Field label="이름" required>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" autoComplete="name" style={input('name')} {...bind('name')} />
            </Field>

            <Field label="전화번호" required>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-1234-5678" autoComplete="tel" style={input('phone')} {...bind('phone')} />
            </Field>

            <Field label="가이드 경력">
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="number" min="0" max="50" inputMode="numeric" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} placeholder="0" style={{ ...input('years'), width: 112, textAlign: 'center' }} {...bind('years')} />
                    <span style={{ fontSize: 14, color: MW.mute }}>년</span>
                </span>
            </Field>

            <Field label="자기소개">
                <textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="가이드 경력, 자신 있는 지역, 자격증 등을 적어 주세요"
                    rows={4}
                    style={{ ...fieldBase, padding: '12px 14px', lineHeight: 1.7, resize: 'vertical', borderColor: focus === 'bio' ? MW.mint : MW.line2 }}
                    {...bind('bio')}
                />
            </Field>

            <Chips id="guide-languages" label="구사 언어" options={LANGUAGES} selected={form.languages} onToggle={(v) => toggle('languages', v)} />
            <Chips id="guide-specialties" label="전문 분야" options={SPECIALTIES} selected={form.specialties} onToggle={(v) => toggle('specialties', v)} />

            {error && (
                <p role="alert" style={{ margin: 0, padding: '12px 16px', borderRadius: 14, background: '#FDF1EF', fontSize: 13, lineHeight: 1.7, fontWeight: 700, color: MW.redDeep }}>{error}</p>
            )}

            <button
                type="submit"
                disabled={busy}
                style={{ height: 54, border: 0, borderRadius: 999, background: busy ? MW.line3 : MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: busy ? MW.mute2 : MW.navy, cursor: busy ? 'default' : 'pointer' }}
            >
                {loading ? '전송 중...' : '신청서 보내기'}
            </button>
        </form>
    );
}
