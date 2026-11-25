import React from 'react';
import {
    AdminBadge, AdminChip, AdminField, AdminFileButton, AdminIconButton, AdminTextArea, AdminTextButton, AdminTextInput,
    IconArrowDown, IconArrowUp, IconLaptop, IconMobile, IconTrash, IconUpload,
} from '../ui';
import { safeBandLink, type HomeBand } from '../../home/homeSettings';
import { BAND_PRESETS, BandPreview, BandSwatch, DEFAULT_BAND_BG, normalizeBandColor } from '../../home/bandColors';

interface Props {
    value: HomeBand[];
    onChange: (id: string, field: keyof HomeBand, value: string) => void;
    onMove: (index: number, step: number) => void;
    onDelete: (id: string) => void;
    onUpload: (file: File | undefined, id: string, field: 'image' | 'image2') => void;
}

/**
 * 홈 화면 관리 ‘혜택 배너’: 홈 가운데 옅은 민트 띠에서 넘겨 보는 배너(두 줄 제목 · 해시태그 · 동그란 사진 · 링크)를 만든다.
 * 왼쪽 미리보기는 홈의 PC 모양을 줄여 보여 준다. 저장·되돌리기·업로드 잠금은 화면(AdminBannerManage)이 맡는다.
 */
export const HomeBandsEditor: React.FC<Props> = ({ value, onChange, onMove, onDelete, onUpload }) => (
    <>
        {value.map((band, index) => {
            const name = band.title.split('\n')[0].trim();
            const badLink = !!band.link.trim() && !safeBandLink(band.link);
            const current = normalizeBandColor(band.bg) || DEFAULT_BAND_BG;
            const preset = BAND_PRESETS.find((p) => p.color === current);
            return (
                <section className="hm-card" key={band.id} aria-label={`혜택 배너 #${index + 1}`}>
                    <div className="hm-card-head">
                        <AdminBadge>#{index + 1}</AdminBadge>
                        <span className="hm-head-text hm-band-headtext">
                            <span className={`hm-name${name ? '' : ' is-empty'}`}>{name || '제목 없음'}</span>
                            <span className="hm-summary">{[band.link.trim() || '링크 없음', band.image ? '큰 사진 있음' : '큰 사진 없음', band.image2 ? '작은 사진 있음' : ''].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="hm-tools">
                            <AdminIconButton size="sm" variant="outlined" label="혜택 배너 위로" disabled={index === 0} onClick={() => onMove(index, -1)}><IconArrowUp /></AdminIconButton>
                            <AdminIconButton size="sm" variant="outlined" label="혜택 배너 아래로" disabled={index === value.length - 1} onClick={() => onMove(index, 1)}><IconArrowDown /></AdminIconButton>
                            <AdminIconButton size="sm" variant="outlined" label="혜택 배너 삭제" onClick={() => onDelete(band.id)}><IconTrash /></AdminIconButton>
                        </span>
                    </div>
                    <div className="hm-card-body">
                        <div className="hm-media">
                            <div className="hm-media-item">
                                <span className="hm-media-label">홈에 보이는 모습</span>
                                <BandPreview bg={current} title={band.title} tags={band.tags} image={band.image} image2={band.image2} />
                            </div>
                            <div className="hm-band-shots">
                                <div className="hm-media-item">
                                    <span className="hm-media-label"><IconMobile className="hm-line-icon" />큰 사진<em>PC·휴대폰</em></span>
                                    <div className="hm-band-shot">
                                        <span className="hm-band-round">{band.image && <img className="hm-cover" src={band.image} alt="" loading="lazy" />}</span>
                                        <AdminFileButton size="sm" accept="image/*" aria-label="큰 사진 변경" leading={<IconUpload />} onFiles={(files) => onUpload(files[0], band.id, 'image')}>{band.image ? '바꾸기' : '올리기'}</AdminFileButton>
                                    </div>
                                </div>
                                <div className="hm-media-item">
                                    <span className="hm-media-label"><IconLaptop className="hm-line-icon" />작은 사진<em>PC만 · 선택</em></span>
                                    <div className="hm-band-shot">
                                        <span className="hm-band-round is-small">{band.image2 && <img className="hm-cover" src={band.image2} alt="" loading="lazy" />}</span>
                                        <AdminFileButton size="sm" accept="image/*" aria-label="작은 사진 변경" leading={<IconUpload />} onFiles={(files) => onUpload(files[0], band.id, 'image2')}>{band.image2 ? '바꾸기' : '올리기'}</AdminFileButton>
                                        {band.image2 && <AdminTextButton size="sm" tone="assistive" onClick={() => onChange(band.id, 'image2', '')}>제거</AdminTextButton>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="hm-fields">
                            <AdminField label="제목" required aside="두 줄 · 줄바꿈은 Enter">{(fid) => <AdminTextArea id={fid} minRows={2} value={band.title} placeholder={'예: 맞춤 견적은 무료예요\n원하는 일정과 인원만 알려주세요'} onChange={(e) => onChange(band.id, 'title', e.target.value)} />}</AdminField>
                            <AdminField label="휴대폰용 제목" aside="비우면 제목을 그대로 써요" hint="휴대폰은 폭이 좁아 한 줄에 12자 안팎이 알맞아요.">{(fid, describedBy) => <AdminTextArea id={fid} aria-describedby={describedBy} minRows={2} value={band.titleShort} placeholder={band.title || '(제목 사용)'} onChange={(e) => onChange(band.id, 'titleShort', e.target.value)} />}</AdminField>
                            <div className="hm-band-colors">
                                <span className="hm-media-label">바탕색<em>{preset ? preset.label : '직접 입력'}</em></span>
                                <div className="hm-band-chips" role="group" aria-label="바탕색 고르기">
                                    {BAND_PRESETS.map((p) => (
                                        <AdminChip key={p.id} active={p.color === current} leading={<BandSwatch color={p.color} />} onClick={() => onChange(band.id, 'bg', p.id === 'mint' ? '' : p.color)}>{p.label}</AdminChip>
                                    ))}
                                </div>
                                <AdminField label="직접 입력" hint="# 뒤에 영문·숫자 6자리(#RRGGBB)로 적어요. 어두운 색이면 글자가 흰색으로 바뀌어요.">
                                    {(fid, describedBy) => <AdminTextInput id={fid} aria-describedby={describedBy} value={band.bg} maxLength={7} placeholder={DEFAULT_BAND_BG}
                                        invalid={!!band.bg && !normalizeBandColor(band.bg)} onChange={(e) => onChange(band.id, 'bg', e.target.value)} />}
                                </AdminField>
                            </div>
                            <div className="hm-grid">
                                <AdminField label="해시태그 문구">{(fid) => <AdminTextInput id={fid} value={band.tags} placeholder="예: #한국어 상담 #24시간 안에 답변" onChange={(e) => onChange(band.id, 'tags', e.target.value)} />}</AdminField>
                                <AdminField label="링크" error={badLink ? '/로 시작하는 사이트 안 주소나 https:// 주소를 적어 주세요.' : null} hint="비우면 눌러도 이동하지 않아요.">{(fid, describedBy) => <AdminTextInput id={fid} aria-describedby={describedBy} invalid={badLink} value={band.link} placeholder="/custom-estimate" onChange={(e) => onChange(band.id, 'link', e.target.value)} />}</AdminField>
                            </div>
                        </div>
                    </div>
                </section>
            );
        })}
    </>
);
