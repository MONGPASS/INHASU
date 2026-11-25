import React from 'react';
import {
    AdminBadge, AdminField, AdminFileButton, AdminIconButton, AdminTextButton, AdminTextInput,
    IconArrowDown, IconArrowUp, IconTrash, IconUpload,
} from '../ui';
import { safeVideoLink, videoThumb, youtubeId, type HomeVideo } from '../../home/homeSettings';

interface Props {
    value: HomeVideo[];
    onChange: (id: string, field: keyof HomeVideo, value: string) => void;
    onMove: (index: number, step: number) => void;
    onDelete: (id: string) => void;
    onUpload: (file: File | undefined, id: string) => void;
}

/**
 * 홈 화면 관리 ‘영상 PLAY LIST’: 영상마다 유튜브 링크 · 제목 · 해시태그를 적는다.
 * 썸네일은 유튜브 링크에서 자동으로 가져오고(직접 올린 사진이 있으면 그 사진), 링크가 없으면 홈에 ‘준비 중’으로 보인다.
 */
export const HomeVideosEditor: React.FC<Props> = ({ value, onChange, onMove, onDelete, onUpload }) => (
    <>
        {value.map((video, index) => {
            const link = video.url.trim();
            const bad = !!link && !safeVideoLink(link);
            const yt = youtubeId(link);
            const status = !link ? { tone: 'neutral' as const, text: '링크 없음 · 홈에 ‘준비 중’으로 보여요' }
                : bad ? { tone: 'danger' as const, text: 'https:// 로 시작하는 주소를 적어 주세요' }
                : yt ? { tone: 'info' as const, text: '유튜브 영상 연결됨' }
                : { tone: 'warn' as const, text: '유튜브 주소가 아니라 썸네일은 기본 사진이에요' };
            return (
                <section className="hm-card" key={video.id} aria-label={`영상 #${index + 1}`}>
                    <div className="hm-card-head">
                        <AdminBadge>#{index + 1}</AdminBadge>
                        <span className="hm-head-text hm-band-headtext">
                            <span className={`hm-name${video.title.trim() ? '' : ' is-empty'}`}>{video.title.trim() || '제목 없음'}</span>
                            <span className="hm-summary">{status.text}</span>
                        </span>
                        <span className="hm-tools">
                            <AdminIconButton size="sm" variant="outlined" label="영상 위로" disabled={index === 0} onClick={() => onMove(index, -1)}><IconArrowUp /></AdminIconButton>
                            <AdminIconButton size="sm" variant="outlined" label="영상 아래로" disabled={index === value.length - 1} onClick={() => onMove(index, 1)}><IconArrowDown /></AdminIconButton>
                            <AdminIconButton size="sm" variant="outlined" label="영상 삭제" onClick={() => onDelete(video.id)}><IconTrash /></AdminIconButton>
                        </span>
                    </div>
                    <div className="hm-card-body">
                        <div className="hm-media">
                            <div className="hm-media-item">
                                <span className="hm-media-label">썸네일<em>{video.image ? '직접 올린 사진' : yt ? '유튜브에서 자동' : '기본 사진'}</em></span>
                                <div className="hm-video-thumb">
                                    <img className="hm-cover" src={videoThumb(video, index)} alt="" loading="lazy" />
                                    <AdminFileButton size="sm" accept="image/*" className="hm-upload-btn" aria-label={`영상 #${index + 1} 썸네일 변경`} leading={<IconUpload />} onFiles={(files) => onUpload(files[0], video.id)}>바꾸기</AdminFileButton>
                                </div>
                                {video.image && <AdminTextButton size="sm" tone="assistive" onClick={() => onChange(video.id, 'image', '')}>{yt ? '유튜브 썸네일로 되돌리기' : '올린 사진 지우기'}</AdminTextButton>}
                            </div>
                        </div>
                        <div className="hm-fields">
                            <AdminField label="영상 링크" error={bad ? status.text : null} hint="유튜브 주소를 붙여 넣으면 썸네일이 자동으로 바뀌어요. 비우면 ‘준비 중’으로 보여요.">
                                {(fid, describedBy) => <AdminTextInput id={fid} aria-describedby={describedBy} invalid={bad} value={video.url} placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => onChange(video.id, 'url', e.target.value)} />}
                            </AdminField>
                            <AdminField label="제목" required>{(fid) => <AdminTextInput id={fid} value={video.title} maxLength={80} placeholder="예: 초원을 달리는 몽골 승마 투어" onChange={(e) => onChange(video.id, 'title', e.target.value)} />}</AdminField>
                            <AdminField label="해시태그 문구">{(fid) => <AdminTextInput id={fid} value={video.tags} maxLength={80} placeholder="예: #초원질주 #승마" onChange={(e) => onChange(video.id, 'tags', e.target.value)} />}</AdminField>
                        </div>
                    </div>
                </section>
            );
        })}
    </>
);
