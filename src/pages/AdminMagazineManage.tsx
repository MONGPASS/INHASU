import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { SimpleSlider } from '../components/ui/SimpleSlider';
import { isPublishedMagazine } from '../constants/seo';
import { useBlocker } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { magazineDraftFingerprint, readMagazineDraft, writeMagazineDraft, removeMagazineDraft, type MagazineDraftScope, type MagazineDraftRead, type MagazineDraftResult, type MagazineDraftForm } from '../utils/adminMagazineDraft';

interface Magazine {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    image: string;
    tag?: string;
    author?: string;
    authorImage?: string;
    isFeatured: boolean;
    isActive: boolean;
    order: number;
    createdAt?: string;
    updatedAt?: string;
}

interface MagazineCategory {
    id: string;
    name: string;
    order: number;
    isActive: boolean;
    type: string;
}
const magazineFromApi = (m: any): Magazine => ({ id: m.id, title: m.title || '', description: m.subtitle || m.description || '', content: m.content || '',
    category: m.category || '', image: m.thumbnail || m.image || '', tag: m.tag || '', author: m.author || '', authorImage: m.author_image || m.authorImage || '',
    isFeatured: !!m.is_featured, isActive: isPublishedMagazine(m), order: Number(m.order) || 0, createdAt: m.created_at, updatedAt: m.updated_at });

// Custom Blot Definitions
const BlockEmbed = ReactQuill.Quill.import('blots/block/embed') as any;

class DividerBlot extends BlockEmbed {
    static create() {
        const node = super.create();
        return node;
    }
}
// @ts-ignore
DividerBlot.blotName = 'divider';
// @ts-ignore
DividerBlot.tagName = 'hr';

class SliderBlot extends BlockEmbed {
    static create(value: string) {
        const node = super.create();
        node.setAttribute('class', 'magazine-slider');
        node.setAttribute('data-images', value);

        // Container
        const container = document.createElement('div');
        container.style.cssText = 'padding: 1rem; border: 2px dashed #cbd5e1; border-radius: 0.75rem; background-color: #f8fafc; text-align: center; margin: 1rem 0; position: relative;';

        // Remove Button
        const removeBtn = document.createElement('div');
        const removeBtnIcon = document.createElement('span');
        removeBtnIcon.className = 'material-symbols-outlined';
        removeBtnIcon.style.fontSize = '16px';
        removeBtnIcon.textContent = 'close';
        removeBtn.appendChild(removeBtnIcon);
        removeBtn.style.cssText = 'position: absolute; top: -10px; right: -10px; width: 24px; height: 24px; background-color: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10;';

        // Add click listener to remove the blot
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent editor selection
            // Find the closest ql-editor to trigger an update if needed, but removing the node is usually enough for key events.
            // However, to be safe with ReactQuill, we just remove the DOM node.
            // Quill's MutationObserver will handle the deletion.
            node.remove();
        });

        // Content
        const images = value.split(',').filter(url => /^https?:\/\//.test(url.trim()));
        const content = document.createElement('div');

        const label = document.createElement('div');
        label.style.cssText = 'font-weight: bold; color: #64748b; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;';
        const labelIcon = document.createElement('span');
        labelIcon.className = 'material-symbols-outlined';
        labelIcon.style.fontSize = '1.25rem';
        labelIcon.textContent = 'photo_library';
        const labelText = document.createElement('span');
        labelText.textContent = `이미지 슬라이더 (${images.length}장)`;
        label.appendChild(labelIcon);
        label.appendChild(labelText);

        const thumbnails = document.createElement('div');
        thumbnails.style.cssText = 'display: flex; gap: 0.5rem; justify-content: center; overflow-x: auto; padding-bottom: 0.5rem;';
        images.forEach(url => {
            const img = document.createElement('img');
            img.src = url.trim();
            img.style.cssText = 'height: 60px; width: 60px; object-fit: cover; border-radius: 0.5rem; border: 1px solid #e2e8f0;';
            thumbnails.appendChild(img);
        });

        content.appendChild(label);
        content.appendChild(thumbnails);

        container.appendChild(removeBtn);
        container.appendChild(content);
        node.appendChild(container);

        node.contentEditable = 'false';
        return node;
    }

    static value(node: HTMLElement) {
        return node.getAttribute('data-images');
    }
}
// @ts-ignore
SliderBlot.blotName = 'slider';
// @ts-ignore
SliderBlot.tagName = 'div';
// @ts-ignore
SliderBlot.className = 'magazine-slider';

// LocationBlot — inline place card embedded in magazine content.
// Stores a JSON payload (URL-encoded) so newlines / special chars in
// `hours` survive HTML attribute serialization round-trips.
class LocationBlot extends BlockEmbed {
    static create(value: string) {
        const node = super.create();
        node.setAttribute('class', 'magazine-location');
        node.setAttribute('data-payload', value);

        let parsed: any = {};
        try { parsed = JSON.parse(decodeURIComponent(value)); } catch { /* ignore */ }

        // Container
        const container = document.createElement('div');
        container.style.cssText = 'padding: 1rem 1.25rem; border: 2px dashed #14b8a6; border-radius: 0.75rem; background-color: #f0fdfa; margin: 1rem 0; position: relative;';

        // Remove button
        const removeBtn = document.createElement('div');
        const removeIcon = document.createElement('span');
        removeIcon.className = 'material-symbols-outlined';
        removeIcon.style.fontSize = '16px';
        removeIcon.textContent = 'close';
        removeBtn.appendChild(removeIcon);
        removeBtn.style.cssText = 'position: absolute; top: -10px; right: -10px; width: 24px; height: 24px; background-color: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10;';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            node.remove();
        });

        // Header row: pin icon + place name
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;';
        const pin = document.createElement('span');
        pin.className = 'material-symbols-outlined';
        pin.style.cssText = 'font-size: 20px; color: #0f766e;';
        pin.textContent = 'place';
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-weight: bold; color: #0f766e; font-size: 14px;';
        titleEl.textContent = parsed.name || '(이름 없음)';
        header.appendChild(pin);
        header.appendChild(titleEl);

        // Body: address + extras
        const body = document.createElement('div');
        body.style.cssText = 'font-size: 12px; color: #475569; line-height: 1.5;';
        if (parsed.address) {
            const addrLine = document.createElement('div');
            addrLine.textContent = `📍 ${parsed.address}`;
            body.appendChild(addrLine);
        }
        if (parsed.phone) {
            const phoneLine = document.createElement('div');
            phoneLine.textContent = `📞 ${parsed.phone}`;
            body.appendChild(phoneLine);
        }
        const extras: string[] = [];
        if (parsed.mapEmbedUrl) extras.push('🗺️ 지도');
        if (parsed.hours) extras.push('🕐 운영시간');
        if (parsed.website) extras.push('🌐 홈페이지');
        if (extras.length > 0) {
            const extraLine = document.createElement('div');
            extraLine.style.cssText = 'margin-top: 4px; color: #64748b; font-size: 11px;';
            extraLine.textContent = extras.join('  ·  ');
            body.appendChild(extraLine);
        }

        container.appendChild(removeBtn);
        container.appendChild(header);
        container.appendChild(body);
        node.appendChild(container);

        node.contentEditable = 'false';
        return node;
    }

    static value(node: HTMLElement) {
        return node.getAttribute('data-payload');
    }
}
// @ts-ignore
LocationBlot.blotName = 'location';
// @ts-ignore
LocationBlot.tagName = 'div';
// @ts-ignore
LocationBlot.className = 'magazine-location';

// @ts-ignore
ReactQuill.Quill.register(DividerBlot);
// @ts-ignore
ReactQuill.Quill.register(SliderBlot);
// @ts-ignore
ReactQuill.Quill.register(LocationBlot);

// Custom Toolbar Icons
const icons = ReactQuill.Quill.import('ui/icons') as any;
icons['divider'] = '<svg viewBox="0 0 18 18"> <line class="ql-stroke" x1="3" x2="15" y1="9" y2="9"></line> </svg>';
icons['slider'] = '<svg viewBox="0 0 18 18"> <rect class="ql-stroke" height="10" width="12" x="3" y="4"></rect> <circle class="ql-fill" cx="6" cy="7" r="1"></circle> <polyline class="ql-even ql-fill" points="5 12 5 11 7 9 8 10 9.4 8 13.4 12 5 12"></polyline> </svg>';
icons['location'] = '<svg viewBox="0 0 18 18"> <path class="ql-stroke" d="M9,1 C5.5,1 3,3.5 3,7 C3,11 9,17 9,17 C9,17 15,11 15,7 C15,3.5 12.5,1 9,1 Z" fill="none"></path> <circle class="ql-fill" cx="9" cy="7" r="2"></circle> </svg>';


export const AdminMagazineManage: React.FC = () => {
    const { user } = useUser();
    const accountRef = useRef(user?.id); accountRef.current = user?.id;
    const [editorContent, setEditorContent] = useState('');

    const quillRef = useRef<ReactQuill>(null);
    const sliderInputRef = useRef<HTMLInputElement>(null);
    const savedRange = useRef<ReactQuill.Range | null>(null);

    // Inline location modal state (for embedded LocationBlot)
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [locationModalForm, setLocationModalForm] = useState({
        name: '',
        address: '',
        phone: '',
        website: '',
        mapEmbedUrl: '',
        mapQuery: '',
        hours: '',
    });

    // View Mode: 'list' | 'edit'
    const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
    const [editingMagazine, setEditingMagazine] = useState<Magazine | null>(null);

    // Tab: 'magazines' | 'categories'
    const [activeTab, setActiveTab] = useState<'magazines' | 'categories'>('magazines');

    // Data State
    const [magazines, setMagazines] = useState<Magazine[]>([]);
    const [magazineCategories, setMagazineCategories] = useState<MagazineCategory[]>([]);

    // Category Management State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<{ id: string, name: string, order: number, isActive: boolean } | null>(null);
    const [categoryForm, setCategoryForm] = useState({ name: '', isActive: true });

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    // Form State
    const [formData, setFormData] = useState<Partial<Magazine>>({
        title: '',
        description: '',
        content: '',
        category: '여행 팁',
        image: '',
        tag: '',
        author: '',
        authorImage: '',
        isFeatured: false,
        isActive: false,
        order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [recovery, setRecovery] = useState<MagazineDraftRead>({ kind: 'empty' });
    const [draftNotice, setDraftNotice] = useState('');
    const [draftSavedAt, setDraftSavedAt] = useState('');
    const activeRef = useRef(false), mountedRef = useRef(true), savedRef = useRef(false);
    const saveLock = useRef(false), uploadLock = useRef(false), sessionRef = useRef(0);
    const pendingRef = useRef(false), scopeRef = useRef<MagazineDraftScope | null>(null);
    const baselineRef = useRef<MagazineDraftForm>({});
    const revisionRef = useRef<string | undefined>(undefined), storedRef = useRef('');
    const formRef = useRef<MagazineDraftForm>({});
    formRef.current = { ...formData, content: editorContent };
    activeRef.current = viewMode === 'edit';
    const dirty = activeRef.current && magazineDraftFingerprint(formRef.current) !== magazineDraftFingerprint(baselineRef.current);
    const editorLocked = saving || uploading || pendingRef.current || !scopeRef.current || scopeRef.current.userId !== user?.id;
    const flushMagazineDraft = React.useCallback((notify = true): MagazineDraftResult => {
        if (!activeRef.current || savedRef.current || pendingRef.current) return { ok: true };
        const fingerprint = magazineDraftFingerprint(formRef.current), base = magazineDraftFingerprint(baselineRef.current);
        if (fingerprint === base) {
            if (scopeRef.current && revisionRef.current) {
                let removed: MagazineDraftResult;
                try { removed = removeMagazineDraft(window.localStorage, scopeRef.current, revisionRef.current); } catch { removed = { ok: false, error: '이전 매거진 초안을 정리하지 못했습니다.' }; }
                if (!removed.ok) { if (notify && mountedRef.current) setDraftNotice(removed.error); return removed; }
                revisionRef.current = undefined; storedRef.current = '';
                if (notify && mountedRef.current) setDraftSavedAt('');
            }
            return { ok: true };
        }
        if (fingerprint === storedRef.current) return { ok: true };
        if (!scopeRef.current) return { ok: false, error: '관리자 계정 확인 후 매거진 초안을 보관할 수 있습니다.' };
        let result: MagazineDraftResult;
        try { result = writeMagazineDraft(window.localStorage, scopeRef.current, formRef.current, base); }
        catch { result = { ok: false, error: '브라우저 저장소를 사용할 수 없어 매거진 초안을 보관하지 못했습니다.' }; }
        if (result.ok) {
            storedRef.current = fingerprint; revisionRef.current = result.revision || revisionRef.current;
            if (notify && mountedRef.current && result.savedAt) { setDraftSavedAt(result.savedAt); setDraftNotice(''); }
        } else if (notify && mountedRef.current) setDraftNotice(result.error);
        return result;
    }, []);
    const canLeaveEditor = () => {
        if (saveLock.current || uploadLock.current) { setDraftNotice('저장·사진 업로드가 끝난 뒤 이동해 주세요.'); return false; }
        const result = flushMagazineDraft();
        return result.ok || window.confirm(result.error + '\n초안을 보관하지 못한 상태로 이동할까요?');
    };
    const blockedReason = useRef({ busy: false, error: '' });
    const handledNavigation = useRef('');
    const blocker = useBlocker(React.useCallback(({ currentLocation, nextLocation }) => {
        if (!activeRef.current || (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search)) return false;
        const result = flushMagazineDraft();
        blockedReason.current = { busy: saveLock.current || uploadLock.current, error: result.ok ? '' : result.error };
        return blockedReason.current.busy || !result.ok;
    }, [flushMagazineDraft]));
    useEffect(() => {
        if (blocker.state === 'unblocked') { handledNavigation.current = ''; return; }
        if (blocker.state !== 'blocked' || handledNavigation.current === blocker.location.key) return;
        handledNavigation.current = blocker.location.key;
        if (blockedReason.current.busy) { setDraftNotice('저장·사진 업로드가 끝난 뒤 이동해 주세요.'); blocker.reset(); }
        else if (window.confirm(blockedReason.current.error + '\n초안을 보관하지 못한 상태로 이동할까요?')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        mountedRef.current = true;
        const unload = (event: BeforeUnloadEvent) => { const result = flushMagazineDraft(false); if (activeRef.current && (saveLock.current || uploadLock.current || !result.ok)) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', unload);
        const pageHide = () => { flushMagazineDraft(false); }; window.addEventListener('pagehide', pageHide);
        return () => { flushMagazineDraft(false); mountedRef.current = false; sessionRef.current++; window.removeEventListener('beforeunload', unload); window.removeEventListener('pagehide', pageHide); };
    }, [flushMagazineDraft]);
    const formFingerprint = magazineDraftFingerprint(formRef.current);
    useEffect(() => { if (viewMode !== 'edit') return; const timer = window.setTimeout(() => flushMagazineDraft(), 650); return () => window.clearTimeout(timer); }, [viewMode, formFingerprint, flushMagazineDraft]);
    const beginEditor = (form: MagazineDraftForm, magazineId: string | null) => {
        if (!user?.id || user.role !== 'admin') { setDraftNotice('관리자 로그인 상태를 확인해 주세요.'); return; }
        sessionRef.current++; savedRef.current = false; storedRef.current = ''; revisionRef.current = undefined;
        baselineRef.current = structuredClone(form); scopeRef.current = { userId: user.id, magazineId };
        let loaded: MagazineDraftRead;
        try { loaded = readMagazineDraft(window.localStorage, scopeRef.current, form); }
        catch { loaded = { kind: 'error', error: '브라우저 저장소에서 매거진 초안을 확인하지 못했습니다.' }; }
        pendingRef.current = loaded.kind !== 'empty'; setRecovery(loaded); setDraftSavedAt(''); setDraftNotice('');
        setFormData(structuredClone(form)); setEditorContent(form.content || ''); setViewMode('edit');
    };
    const discardRecovery = () => {
        if (saveLock.current || uploadLock.current || !scopeRef.current) return;
        let result: MagazineDraftResult;
        try { result = removeMagazineDraft(window.localStorage, scopeRef.current); } catch { result = { ok: false, error: '초안을 삭제하지 못했습니다.' }; }
        if (!result.ok) { setDraftNotice(result.error); return; }
        pendingRef.current = false; storedRef.current = ''; revisionRef.current = undefined; setRecovery({ kind: 'empty' }); setDraftSavedAt(''); setDraftNotice('');
        setFormData(structuredClone(baselineRef.current)); setEditorContent(baselineRef.current.content || '');
    };
    const runUpload = async (work: () => Promise<void>) => {
        if (saveLock.current || uploadLock.current || pendingRef.current || !activeRef.current || scopeRef.current?.userId !== accountRef.current) return;
        uploadLock.current = true; setUploading(true);
        try { await work(); } finally { uploadLock.current = false; if (mountedRef.current) setUploading(false); }
    };

    // Editor Handlers
    const handleImageHandler = React.useCallback(() => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files?.[0];
            if (file) {
                await runUpload(async () => {
                const session = sessionRef.current;
                try {
                    const url = await uploadImage(file, 'magazine-content');
                    if (!mountedRef.current || sessionRef.current !== session || (scopeRef.current && scopeRef.current.userId !== accountRef.current)) return;
                    const quill = quillRef.current?.getEditor();
                    if (quill) {
                        const range = quill.getSelection();
                        quill.insertEmbed(range?.index || 0, 'image', url);
                    }
                } catch (error) {
                    console.error('Image upload failed:', error);
                    alert('이미지 업로드 실패');
                }
                });
            }
        };
    }, []);

    const handleDivider = () => {
        if (saveLock.current || uploadLock.current || pendingRef.current) return;
        const quill = quillRef.current?.getEditor();
        if (quill) {
            const range = quill.getSelection();
            if (range) {
                quill.insertEmbed(range.index, 'divider', true);
                quill.setSelection(range.index + 1, 0);
            }
        }
    };

    const handleSlider = () => {
        if (saveLock.current || uploadLock.current || pendingRef.current) return;
        const quill = quillRef.current?.getEditor();
        if (quill) {
            // Save current selection before losing focus to file input
            savedRange.current = quill.getSelection();
        }
        sliderInputRef.current?.click();
    };

    const handleSliderFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            await runUpload(async () => {
            const session = sessionRef.current;
            try {
                const uploadedUrls: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const url = await uploadImage(files[i], 'magazine-slider');
                    uploadedUrls.push(url);
                }

                const quill = quillRef.current?.getEditor();
                if (!mountedRef.current || sessionRef.current !== session || (scopeRef.current && scopeRef.current.userId !== accountRef.current)) return;
                if (quill) {
                    // Use saved selection or fall back to end of document
                    const range = savedRange.current || { index: quill.getLength(), length: 0 };

                    if (range) {
                        if (uploadedUrls.length === 0) {
                            alert('이미지 업로드에 실패했습니다.');
                            return;
                        }

                        const index = range.index;

                        // 1. Insert Custom Slider Blot
                        quill.insertEmbed(index, 'slider', uploadedUrls.join(','));

                        // 2. Insert TWO newlines after the slider to guarantee a new editable paragraph
                        //    First newline closes the embed's block, second creates a fresh <p>
                        quill.insertText(index + 1, '\n\n');

                        // 3. Force focus and move cursor to the new paragraph
                        quill.focus();
                        quill.setSelection(index + 2, 0);
                    }
                }
            } catch (error) {
                console.error('Slider images upload failed:', error);
                alert('슬라이더 이미지 업로드 실패');
            }
            });
        }
        // Reset input
        if (sliderInputRef.current) sliderInputRef.current.value = '';
    };

    // Open location modal — saves cursor position so we can insert at the right spot
    const handleLocation = () => {
        if (saveLock.current || uploadLock.current || pendingRef.current) return;
        const quill = quillRef.current?.getEditor();
        if (quill) {
            savedRange.current = quill.getSelection();
        }
        setLocationModalForm({
            name: '',
            address: '',
            phone: '',
            website: '',
            mapEmbedUrl: '',
            mapQuery: '',
            hours: '',
        });
        setIsLocationModalOpen(true);
    };

    const insertLocationBlot = () => {
        if (saveLock.current || uploadLock.current || pendingRef.current) return;
        if (!locationModalForm.name && !locationModalForm.address && !locationModalForm.mapEmbedUrl) {
            alert('장소 이름 / 주소 / 지도 임베드 중 하나는 입력해주세요.');
            return;
        }
        const quill = quillRef.current?.getEditor();
        if (!quill) return;

        const range = savedRange.current || { index: quill.getLength(), length: 0 };
        const payload = encodeURIComponent(JSON.stringify(locationModalForm));
        const index = range.index;

        quill.insertEmbed(index, 'location', payload);
        // Insert two newlines so the cursor lands on a fresh paragraph below the block
        quill.insertText(index + 1, '\n\n');
        quill.focus();
        quill.setSelection(index + 2, 0);

        setIsLocationModalOpen(false);
    };

    // Custom Toolbar Options with registered blot names
    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ color: [] }, { background: [] }],
                [{ align: [] }],
                ['link', 'image', 'video'],
                ['divider', 'slider', 'location'], // Custom buttons
                ['clean']
            ],
            handlers: {
                image: handleImageHandler,
                divider: handleDivider,
                slider: handleSlider,
                location: handleLocation
            }
        }
    }), [handleImageHandler]);


    // Fetch data from API
    const fetchMagazines = async () => {
        try {
            const data = await api.magazines.list();
            if (Array.isArray(data)) {
                setMagazines(data.map((m: any) => ({
                    id: m.id,
                    title: m.title,
                    description: m.subtitle || m.description || '', // Map subtitle
                    content: m.content,
                    category: m.category,
                    image: m.thumbnail || m.image || '', // Map thumbnail
                    tag: m.tag,
                    author: m.author || '',
                    authorImage: m.author_image || m.authorImage || '',
                    isFeatured: m.is_featured,
                    isActive: isPublishedMagazine(m),
                    order: m.order,
                    createdAt: m.created_at,
                    updatedAt: m.updated_at,
                })));
            }
        } catch (error) {
            console.error('Error fetching magazines:', error);
        }
    };

    const fetchCategories = async () => {
        try {
            const data = await api.categories.list('magazine');
            if (Array.isArray(data)) {
                const magazineCats = data.filter((c: any) => c.type === 'magazine');
                setMagazineCategories(magazineCats.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    order: c.order,
                    isActive: c.is_active,
                    type: c.type
                })));
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    useEffect(() => {
        fetchMagazines();
        fetchCategories();
    }, []);

    const categories = magazineCategories?.map(c => c.name) || [];

    // Sync default category
    useEffect(() => {
        if (viewMode !== 'edit' && categories.length > 0 && !categories.includes(formData.category || '')) {
            setFormData(prev => ({ ...prev, category: categories[0] }));
        }
    }, [categories, formData.category, viewMode]);

    // Filter Logic
    const filteredMagazines = magazines?.filter(magazine => {
        const matchesSearch = magazine.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || magazine.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const isReorderable = searchQuery === '' && filterCategory === 'all';

    const moveMagazine = async (index: number, direction: 'up' | 'down') => {
        if (!filteredMagazines) return;
        const currentMagazine = filteredMagazines[index];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const targetMagazine = filteredMagazines[targetIndex];
        if (!targetMagazine) return;

        const currentOrder = currentMagazine.order;
        const targetOrder = targetMagazine.order;

        await api.magazines.update(currentMagazine.id, { order: targetOrder });
        await api.magazines.update(targetMagazine.id, { order: currentOrder });
        fetchMagazines();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await runUpload(async () => {
            const session = sessionRef.current;
            try {
                const url = await uploadImage(file, 'magazines');
                if (!mountedRef.current || sessionRef.current !== session || (scopeRef.current && scopeRef.current.userId !== accountRef.current)) return;
                setFormData(prev => ({ ...prev, image: url }));
            } catch (error) {
                console.error('Magazine image upload failed:', error);
                alert('이미지 업로드 실패');
            }
            });
        }
    };

    const handleAuthorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await runUpload(async () => {
        const session = sessionRef.current;
        try {
            const url = await uploadImage(file, 'magazine-authors');
            if (!mountedRef.current || sessionRef.current !== session || accountRef.current !== user?.id) return;
            setFormData(prev => ({ ...prev, authorImage: url }));
        } catch (error) {
            console.error('Magazine author image upload failed:', error);
            alert('저자 사진 업로드 실패');
        }
        });
    };

    const resetForm = (saved = false) => {
        if (!saved && !canLeaveEditor()) return false;
        sessionRef.current++; activeRef.current = false; scopeRef.current = null; pendingRef.current = false;
        setRecovery({ kind: 'empty' }); setDraftNotice(''); setDraftSavedAt('');
        setFormData({
            title: '',
            description: '',
            content: '',
            category: categories[0] || '여행 팁',
            image: '',
            tag: '',
            author: '',
            authorImage: '',
            isFeatured: false,
            isActive: false,
            order: 0
        });
        setEditorContent('');
        setEditingMagazine(null);
        setViewMode('list');
        return true;
    };

    const handleCreateNew = () => {
        if (!canLeaveEditor()) return;
        setEditingMagazine(null);
        beginEditor({ title: '', description: '', content: '', category: categories[0] || '여행 팁', image: '', tag: '', author: '', authorImage: '', isFeatured: false, isActive: false, order: 0 }, null);
    };

    const handleEdit = async (magazine: Magazine) => {
        if (!canLeaveEditor()) return;
        const session = ++sessionRef.current;
        try {
            const fresh = magazineFromApi(await api.magazines.get(magazine.id));
            if (accountRef.current !== user?.id) return;
            if (!mountedRef.current || sessionRef.current !== session || (scopeRef.current && scopeRef.current.userId !== accountRef.current)) return;
            setEditingMagazine(fresh); beginEditor(fresh, fresh.id);
        } catch { if (mountedRef.current) setDraftNotice('매거진 원본을 불러오지 못했습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.'); }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            try {
                await api.magazines.delete(id);
                fetchMagazines();
            } catch (error) {
                console.error('Error deleting magazine:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const handleSubmit = async () => {
        if (saveLock.current || uploadLock.current || pendingRef.current || !scopeRef.current || scopeRef.current.userId !== user?.id) return;
        if (!formRef.current.title?.trim()) { alert('제목을 입력해주세요.'); return; }
        saveLock.current = true; setSaving(true);
        const session = sessionRef.current;
        const scope = { ...scopeRef.current };
        flushMagazineDraft();
        const ownedRevision = revisionRef.current;
        try {
            if (editingMagazine) {
                const latest = magazineFromApi(await api.magazines.get(editingMagazine.id));
                if (!mountedRef.current || sessionRef.current !== session || accountRef.current !== scope.userId) return;
                if (magazineDraftFingerprint(latest) !== magazineDraftFingerprint(baselineRef.current) && !window.confirm('편집 중 서버의 매거진 원본이 변경되었습니다. 현재 작성 내용으로 덮어쓸까요?')) return;
            }
            const content = editorContent;

            if (!formData.title?.trim()) {
                alert('제목을 입력해주세요.');
                return;
            }

            const maxOrder = magazines.length > 0 ? Math.max(...magazines.map(m => m.order)) : 0;

            const magazineData = {
                title: formData.title || '',
                subtitle: formData.description || '', // Map description to subtitle
                content: content,
                category: formData.category || '여행 팁',
                thumbnail: formData.image || '', // Map image to thumbnail
                tag: formData.tag,
                author: formData.author || '',
                author_image: formData.authorImage || '',
                is_featured: formData.isFeatured || false,
                is_published: formData.isActive === true,
                order: editingMagazine ? formData.order! : maxOrder + 1,
                updated_at: new Date().toISOString()
            };

            if (editingMagazine) {
                await api.magazines.update(editingMagazine.id, magazineData);
            } else {
                await api.magazines.create({
                    ...magazineData,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString()
                });
            }

            if (!mountedRef.current || sessionRef.current !== session || (scopeRef.current && scopeRef.current.userId !== accountRef.current)) return;
            savedRef.current = true;
            const removed = ownedRevision ? removeMagazineDraft(window.localStorage, scope, ownedRevision) : { ok: true as const };
            if (!removed.ok) setDraftNotice(removed.error);
            alert(removed.ok ? '저장되었습니다!' : '저장되었습니다. 브라우저 초안 정리에는 실패했습니다.');
            fetchMagazines();
            resetForm(true);
        } catch (error: any) {
            console.error('Error saving magazine:', error);
            alert(`저장 실패: ${error.message || '저장 중 오류가 발생했습니다.'}`);
            flushMagazineDraft();
        } finally { saveLock.current = false; if (mountedRef.current && sessionRef.current === session) setSaving(false); else if (mountedRef.current) setSaving(false); }
    };

    // Update editor content when formData loaded
    useEffect(() => {
        if (viewMode === 'edit' && formData.content) {
            setEditorContent(formData.content);
        }
    }, [viewMode, formData.content]);

    // Category CRUD logic
    const handleSaveCategory = async () => {
        if (!categoryForm.name) {
            alert('카테고리명을 입력해주세요.');
            return;
        }
        if (editingCategory) {
            await api.categories.update(editingCategory.id, {
                name: categoryForm.name,
                is_active: categoryForm.isActive
            });
        } else {
            const maxOrder = magazineCategories?.length ? Math.max(...magazineCategories.map(c => c.order)) : 0;
            await api.categories.create({
                id: `mag-cat-${Date.now()}`,
                name: categoryForm.name,
                is_active: categoryForm.isActive,
                order: maxOrder + 1,
                type: 'magazine',
                icon: 'article',
                description: ''
            });
        }
        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        setCategoryForm({ name: '', isActive: true });
        fetchCategories();
    };

    const handleDeleteCategory = async (cat: MagazineCategory) => {
        const count = magazines?.filter(m => m.category === cat.name).length || 0;
        if (count > 0) {
            alert('이 카테고리에 매거진이 있어 삭제할 수 없습니다.');
            return;
        }
        if (confirm('이 카테고리를 삭제하시겠습니까?')) {
            await api.categories.delete(cat.id);
            fetchCategories();
        }
    };

    const handleToggleCategoryActive = async (cat: MagazineCategory) => {
        await api.categories.update(cat.id, { is_active: !cat.isActive });
        fetchCategories();
    };

    const moveCategoryOrder = async (index: number, direction: 'up' | 'down') => {
        if (!magazineCategories) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= magazineCategories.length) return;

        const current = magazineCategories[index];
        const target = magazineCategories[targetIndex];

        await api.categories.update(current.id, { order: target.order });
        await api.categories.update(target.id, { order: current.order });
        fetchCategories();
    };

    // Header actions differ between list and edit views
    const headerActions = viewMode === 'edit' ? (
        <>
            <button className="btn btn-ghost btn-sm" onClick={() => resetForm()} disabled={saving || uploading}>
                <Icon name="arrow_back" />목록
            </button>
            <button className="btn btn-ink" onClick={handleSubmit} disabled={editorLocked}>
                <Icon name="check" />{saving ? '저장 중…' : uploading ? '사진 업로드 중…' : formData.isActive ? (editingMagazine ? '수정 완료' : '발행하기') : '임시 저장'}
            </button>
        </>
    ) : (
        <button className="btn btn-ink" onClick={handleCreateNew}>
            <Icon name="edit_document" />매거진 작성
        </button>
    );

    return (
        <AdminLayout activePage="magazines" title="매거진 관리" actions={headerActions}>
            {/* Custom Quill Styles for Sticky Toolbar */}
            <style>{`
                .quill { display: flex; flex-direction: column; overflow: hidden; }
                .ql-toolbar { flex-shrink: 0; background: white; z-index: 10; border-color: var(--border-default) !important; border-top-left-radius: var(--r-md); border-top-right-radius: var(--r-md); }
                .ql-container { flex: 1; overflow: hidden !important; display: flex; flex-direction: column; border-color: var(--border-default) !important; border-bottom-left-radius: var(--r-md); border-bottom-right-radius: var(--r-md); font-family: inherit; font-size: 1rem; }
                .ql-editor { flex: 1; overflow-y: auto; padding: 1.5rem; min-height: 360px; }
            `}</style>

            {/* Tabs */}
            <div className="seg" style={{ marginBottom: 22 }}>
                <button className={activeTab === 'magazines' ? 'active' : ''} onClick={() => { if (viewMode === 'edit' && !resetForm()) return; setActiveTab('magazines'); }}>매거진 목록</button>
                <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => { if (viewMode === 'edit' && !resetForm()) return; setActiveTab('categories'); }}>카테고리 관리</button>
            </div>
            {draftNotice && <p role="alert" style={{ padding: '12px 16px', background: '#fff5e8', color: '#8f4c13', borderRadius: 12 }}>{draftNotice}</p>}
            {viewMode === 'edit' && <div role="status" style={{ padding: '14px 18px', marginBottom: 16, borderRadius: 14, background: '#edfaf6', color: '#145c4c' }}>
                <strong>이 브라우저에 관리자별 매거진 초안을 자동 보관합니다.</strong><p style={{ margin: '4px 0', fontSize: 13 }}>자동 보관은 사이트 발행·서버 임시 저장과 별도입니다. {draftSavedAt ? `마지막 초안 보관: ${new Date(draftSavedAt).toLocaleString('ko-KR')}` : dirty ? '입력 내용을 보관하고 있습니다.' : '변경사항이 생기면 자동 보관합니다.'}</p>
                {recovery.kind === 'draft' && <><p>{recovery.conflict ? '보관 후 서버 원본이 변경되었습니다. 초안을 복원하면 저장 시 현재 작성 내용이 원본을 대체합니다.' : '이 문서의 보관된 초안이 있습니다.'} 보관 시각: {new Date(recovery.draft.savedAt).toLocaleString('ko-KR')}</p><button type="button" className="btn btn-ink btn-sm" onClick={() => { if (saveLock.current || uploadLock.current) return; const restored = recovery.draft; pendingRef.current = false; revisionRef.current = restored.revision; storedRef.current = magazineDraftFingerprint(restored.form); setFormData(structuredClone(restored.form)); setEditorContent(restored.form.content || ''); setDraftSavedAt(restored.savedAt); setRecovery({ kind: 'empty' }); }}>초안 복원</button>{' '}</>}
                {recovery.kind === 'error' && <p role="alert">{recovery.error}</p>}
                {(recovery.kind !== 'empty' || dirty || draftSavedAt) && <button type="button" className="btn btn-ghost btn-sm" disabled={saving || uploading} onClick={() => { if (recovery.kind !== 'empty' || window.confirm('매거진 변경사항과 보관된 초안을 버릴까요?')) discardRecovery(); }}>초안 버리기</button>}
            </div>}

            {activeTab === 'categories' && (
                <div className="card">
                    <div className="card-head">
                        <h2>매거진 카테고리</h2>
                        <div className="spacer" />
                        <button
                            className="btn btn-ink btn-sm"
                            onClick={() => {
                                setEditingCategory(null);
                                setCategoryForm({ name: '', isActive: true });
                                setIsCategoryModalOpen(true);
                            }}
                        >
                            <Icon name="add" />카테고리 추가
                        </button>
                    </div>
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>순서</th>
                                    <th>카테고리명</th>
                                    <th className="c">매거진 수</th>
                                    <th className="c">상태</th>
                                    <th className="c">액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {magazineCategories?.map((cat, index) => (
                                    <tr key={cat.id}>
                                        <td>
                                            <div className="edit-move">
                                                <button onClick={() => moveCategoryOrder(index, 'up')} disabled={index === 0}>
                                                    <Icon name="arrow_upward" />
                                                </button>
                                                <button onClick={() => moveCategoryOrder(index, 'down')} disabled={index === magazineCategories.length - 1}>
                                                    <Icon name="arrow_downward" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="cell-strong">{cat.name}</td>
                                        <td className="c cell-muted">{magazines?.filter(m => m.category === cat.name).length || 0}개</td>
                                        <td className="c">
                                            <button
                                                onClick={() => handleToggleCategoryActive(cat)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                            >
                                                <span className={`badge ${cat.isActive ? 'b-green' : 'b-gray'}`}>
                                                    {cat.isActive ? '활성' : '비활성'}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="c">
                                            <span className="row-actions">
                                                <button className="act-btn" onClick={() => {
                                                    setEditingCategory({ id: cat.id, name: cat.name, order: cat.order, isActive: cat.isActive });
                                                    setCategoryForm({ name: cat.name, isActive: cat.isActive });
                                                    setIsCategoryModalOpen(true);
                                                }}>
                                                    <Icon name="edit" />
                                                </button>
                                                <button className="act-btn danger" onClick={() => handleDeleteCategory(cat)}>
                                                    <Icon name="delete" />
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'magazines' && (
                <>
                    {viewMode === 'list' && (
                        <>
                            <div className="toolbar">
                                <label className="tb-search">
                                    <Icon name="search" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="매거진 제목 검색"
                                    />
                                </label>
                                <select
                                    className="select"
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                >
                                    <option value="all">전체 카테고리</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <div className="spacer" />
                                <button className="btn btn-ink" onClick={handleCreateNew}>
                                    <Icon name="add" />매거진 작성
                                </button>
                            </div>

                            {filteredMagazines?.length === 0 ? (
                                <div className="empty">
                                    <Icon name="menu_book" />
                                    <p>검색 결과가 없습니다.</p>
                                </div>
                            ) : (
                                <div className="mag-grid">
                                    {filteredMagazines?.map((magazine, index) => (
                                        <div className="mag-card" key={magazine.id} onClick={() => handleEdit(magazine)}>
                                            <div className="mag-cover">
                                                {magazine.image && (
                                                    <img src={magazine.image} alt={magazine.title} loading="lazy" />
                                                )}
                                                <span className={`badge ${magazine.isActive ? 'b-green' : 'b-amber'}`}>
                                                    {magazine.isActive ? '게시중' : '임시저장'}
                                                </span>
                                            </div>
                                            <div className="mag-body">
                                                <h4>{magazine.title}</h4>
                                                <div className="mag-meta">
                                                    <span className="badge b-blue">{magazine.category}</span>
                                                    {magazine.isFeatured && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="badge b-amber">인기</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                                                    {isReorderable ? (
                                                        <span className="edit-move" style={{ flexDirection: 'row' }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); moveMagazine(index, 'up'); }}
                                                                disabled={index === 0}
                                                            >
                                                                <Icon name="arrow_back" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); moveMagazine(index, 'down'); }}
                                                                disabled={index === filteredMagazines.length - 1}
                                                            >
                                                                <Icon name="arrow_forward" />
                                                            </button>
                                                        </span>
                                                    ) : (
                                                        <span className="row" style={{ gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                            <Icon name="calendar_today" style={{ fontSize: 14 }} />
                                                            {magazine.createdAt ? new Date(magazine.createdAt).toLocaleDateString() : ''}
                                                        </span>
                                                    )}
                                                    <div className="spacer" style={{ flex: 1 }} />
                                                    <span className="row-actions">
                                                        <button className="act-btn" onClick={(e) => { e.stopPropagation(); handleEdit(magazine); }}>
                                                            <Icon name="edit" />
                                                        </button>
                                                        <button className="act-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(magazine.id); }}>
                                                            <Icon name="delete" />
                                                        </button>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {viewMode === 'edit' && (
                        <fieldset className="grid-2" disabled={editorLocked} inert={editorLocked} style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                            <div className="stack" style={{ gap: 16 }}>
                                <div className="card card-pad">
                                    <h3 className="sec-head" style={{ marginBottom: 16 }}>기본 설정</h3>

                                    <div className="field">
                                        <label>카테고리</label>
                                        <select
                                            className="inp"
                                            value={formData.category}
                                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label>대표 이미지</label>
                                        <div
                                            className="block-img"
                                            style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer' }}
                                        >
                                            {formData.image ? (
                                                <>
                                                    <img src={formData.image} alt="Preview" />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFormData(prev => ({ ...prev, image: '' }));
                                                        }}
                                                        style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                                    >
                                                        <Icon name="close" style={{ fontSize: 16 }} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="block-img-empty">
                                                    <Icon name="add_photo_alternate" />
                                                    클릭하여 업로드
                                                </div>
                                            )}
                                            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                        </div>
                                    </div>

                                    <div className="field">
                                        <label>요약 설명</label>
                                        <textarea
                                            className="inp"
                                            value={formData.description}
                                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                            style={{ height: 96 }}
                                        />
                                    </div>

                                    <div className="field">
                                        <label>태그</label>
                                        <input
                                            className="inp"
                                            type="text"
                                            value={formData.tag}
                                            onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                                        />
                                    </div>

                                    <div className="field">
                                        <label>저자 / 감수자</label>
                                        <input
                                            className="inp"
                                            type="text"
                                            value={formData.author || ''}
                                            placeholder="예: Bolormaa Jambajamts"
                                            onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                                        />
                                    </div>

                                    <div className="field">
                                        <label>저자 사진</label>
                                        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                                            <div
                                                style={{
                                                    position: 'relative',
                                                    width: 64,
                                                    height: 64,
                                                    flex: '0 0 64px',
                                                    overflow: 'hidden',
                                                    borderRadius: '50%',
                                                    border: '1px solid var(--border)',
                                                    background: 'var(--surface-subtle)',
                                                }}
                                            >
                                                {formData.authorImage ? (
                                                    <img
                                                        src={formData.authorImage}
                                                        alt="저자 사진 미리보기"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <Icon
                                                        name="person"
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: 'var(--text-tertiary)',
                                                        }}
                                                    />
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleAuthorImageUpload}
                                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                                />
                                            </div>
                                            <div className="stack" style={{ gap: 6 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    정사각형 얼굴 사진을 권장합니다.
                                                </span>
                                                {formData.authorImage && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        onClick={() => setFormData(prev => ({ ...prev, authorImage: '' }))}
                                                        style={{ alignSelf: 'flex-start', minHeight: 30, padding: '4px 10px' }}
                                                    >
                                                        사진 삭제
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="stack" style={{ gap: 10 }}>
                                        <label className="toggle-row" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>발행 상태</span>
                                            <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))} style={{ width: 16, height: 16 }} />
                                        </label>
                                        <label className="toggle-row" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>인기 게시물</span>
                                            <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))} style={{ width: 16, height: 16 }} />
                                        </label>
                                    </div>
                                </div>

                                <div className="row" style={{ gap: 10 }}>
                                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => resetForm()}>작성 취소</button>
                                    <button className="btn btn-ink" style={{ flex: 1 }} onClick={handleSubmit}>{saving ? '저장 중…' : formData.isActive ? (editingMagazine ? '수정 완료' : '발행하기') : '임시 저장'}</button>
                                </div>
                            </div>

                            <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        style={{ width: '100%', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-strong)', border: 'none', outline: 'none', background: 'transparent' }}
                                        placeholder="제목을 입력하세요"
                                    />
                                </div>
                                <div style={{ padding: 16 }}>
                                    <ReactQuill
                                        ref={quillRef}
                                        theme="snow"
                                        value={editorContent}
                                        readOnly={editorLocked}
                                        onChange={setEditorContent}
                                        modules={modules}
                                        className="bg-white rounded-xl overflow-hidden flex flex-col"
                                    />
                                    <input type="file" ref={sliderInputRef} onChange={handleSliderFiles} multiple accept="image/*" className="hidden" style={{ display: 'none' }} />
                                </div>
                            </div>
                        </fieldset>
                    )}
                </>
            )}

            {/* Inline Location Block Modal */}
            {isLocationModalOpen && (
                <div className="picker-scrim" onClick={() => setIsLocationModalOpen(false)}>
                    <div className="picker" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
                        <div className="card-head">
                            <Icon name="add_location" style={{ color: 'var(--mrt-blue)' }} />
                            <h2>위치 카드 삽입</h2>
                            <div className="spacer" />
                            <button className="act-btn" onClick={() => setIsLocationModalOpen(false)}>
                                <Icon name="close" />
                            </button>
                        </div>
                        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
                            <div className="field">
                                <label>장소 이름</label>
                                <input
                                    className="inp"
                                    type="text"
                                    value={locationModalForm.name}
                                    onChange={(e) => setLocationModalForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="예: 칭기스칸 박물관"
                                />
                            </div>
                            <div className="field">
                                <label>주소</label>
                                <textarea
                                    className="inp"
                                    value={locationModalForm.address}
                                    onChange={(e) => setLocationModalForm(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="Sambuu St, Ulaanbaatar 15141, Mongolia"
                                    style={{ height: 64 }}
                                />
                            </div>
                            <div className="field-row">
                                <div className="field">
                                    <label>전화</label>
                                    <input
                                        className="inp"
                                        type="tel"
                                        value={locationModalForm.phone}
                                        onChange={(e) => setLocationModalForm(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="+976 xxxx xxxx"
                                    />
                                </div>
                                <div className="field">
                                    <label>홈페이지</label>
                                    <input
                                        className="inp"
                                        type="url"
                                        value={locationModalForm.website}
                                        onChange={(e) => setLocationModalForm(prev => ({ ...prev, website: e.target.value }))}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                            <div className="field">
                                <label>Google 지도 임베드 <span className="muted" style={{ fontWeight: 600, fontSize: 11 }}>— iframe 코드 또는 src URL</span></label>
                                <textarea
                                    className="inp"
                                    value={locationModalForm.mapEmbedUrl}
                                    onChange={(e) => setLocationModalForm(prev => ({ ...prev, mapEmbedUrl: e.target.value }))}
                                    placeholder='Google 지도 → "공유" → "지도 임베드" → HTML 복사'
                                    style={{ height: 64, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                                />
                            </div>
                            <div className="field">
                                <label>길찾기 검색어 <span className="muted" style={{ fontWeight: 600, fontSize: 11 }}>— 좌표 또는 주소</span></label>
                                <input
                                    className="inp"
                                    type="text"
                                    value={locationModalForm.mapQuery}
                                    onChange={(e) => setLocationModalForm(prev => ({ ...prev, mapQuery: e.target.value }))}
                                    placeholder="47.918,106.917 or place name"
                                />
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>운영시간 <span className="muted" style={{ fontWeight: 600, fontSize: 11 }}>— 요일별 1줄씩</span></label>
                                <textarea
                                    className="inp"
                                    value={locationModalForm.hours}
                                    onChange={(e) => setLocationModalForm(prev => ({ ...prev, hours: e.target.value }))}
                                    placeholder={'월: 09:00 - 17:00\n화: 09:00 - 17:00\n일: 휴무'}
                                    style={{ height: 112, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                                />
                            </div>
                        </div>
                        <div className="drawer-foot">
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsLocationModalOpen(false)}>취소</button>
                            <button className="btn btn-ink" style={{ flex: 1 }} onClick={insertLocationBlot}>본문에 삽입</button>
                        </div>
                    </div>
                </div>
            )}

            {isCategoryModalOpen && (
                <div className="picker-scrim" onClick={() => setIsCategoryModalOpen(false)}>
                    <div className="picker" onClick={(e) => e.stopPropagation()}>
                        <div className="card-head">
                            <h2>{editingCategory ? '카테고리 수정' : '카테고리 추가'}</h2>
                            <div className="spacer" />
                            <button className="act-btn" onClick={() => setIsCategoryModalOpen(false)}>
                                <Icon name="close" />
                            </button>
                        </div>
                        <div style={{ padding: '18px 22px' }}>
                            <div className="field">
                                <label>카테고리명</label>
                                <input
                                    className="inp"
                                    type="text"
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="예: 여행 팁"
                                />
                            </div>
                            <label className="toggle-row" style={{ cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    id="catActive"
                                    checked={categoryForm.isActive}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                                    style={{ width: 16, height: 16 }}
                                />
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>활성화</span>
                            </label>
                        </div>
                        <div className="drawer-foot" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setIsCategoryModalOpen(false)}>취소</button>
                            <button className="btn btn-ink" onClick={handleSaveCategory}>저장</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
