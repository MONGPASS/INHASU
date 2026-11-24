import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { AdminLayout } from '../components/admin/AdminLayout';
import { SimpleSlider } from '../components/ui/SimpleSlider';
import { isPublishedMagazine } from '../constants/seo';
import { useBlocker } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { magazineDraftFingerprint, readMagazineDraft, writeMagazineDraft, removeMagazineDraft, type MagazineDraftScope, type MagazineDraftRead, type MagazineDraftResult, type MagazineDraftForm } from '../utils/adminMagazineDraft';
import './AdminContentManage.css';
import './AdminMagazineManage.css';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import {
    AdminButton, AdminCard, AdminChip, AdminDialog, AdminEmpty, AdminError, AdminField, AdminFileButton, AdminIconButton, AdminLoading, AdminMessage,
    AdminSearch, AdminSelect, AdminSwitch, AdminTabs, AdminTextArea, AdminTextButton, AdminTextInput,
    IconBook, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconImage, IconPencil, IconPerson, IconTrash, IconUpload, IconWrite,
} from '../components/admin/ui';
import { adminConfirmLeave } from '../components/admin/ui/adminLeaveConfirm';

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
        container.className = 'mg-blot is-slider';

        // Remove Button
        const removeBtn = document.createElement('div');
        const removeBtnIcon = document.createElement('span');
        removeBtnIcon.className = 'material-symbols-outlined';
        removeBtnIcon.textContent = 'close';
        removeBtn.appendChild(removeBtnIcon);
        removeBtn.className = 'mg-blot-remove';

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
        label.className = 'mg-blot-label';
        const labelIcon = document.createElement('span');
        labelIcon.className = 'material-symbols-outlined';
        labelIcon.textContent = 'photo_library';
        const labelText = document.createElement('span');
        labelText.textContent = `이미지 슬라이더 (${images.length}장)`;
        label.appendChild(labelIcon);
        label.appendChild(labelText);

        const thumbnails = document.createElement('div');
        thumbnails.className = 'mg-blot-thumbs';
        images.forEach(url => {
            const img = document.createElement('img');
            img.src = url.trim();
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
        container.className = 'mg-blot is-location';

        // Remove button
        const removeBtn = document.createElement('div');
        const removeIcon = document.createElement('span');
        removeIcon.className = 'material-symbols-outlined';
        removeIcon.textContent = 'close';
        removeBtn.appendChild(removeIcon);
        removeBtn.className = 'mg-blot-remove';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            node.remove();
        });

        // Header row: pin icon + place name
        const header = document.createElement('div');
        header.className = 'mg-blot-head';
        const pin = document.createElement('span');
        pin.className = 'material-symbols-outlined';
        pin.textContent = 'place';
        const titleEl = document.createElement('div');
        titleEl.className = 'mg-blot-title';
        titleEl.textContent = parsed.name || '(이름 없음)';
        header.appendChild(pin);
        header.appendChild(titleEl);

        // Body: address + extras
        const body = document.createElement('div');
        body.className = 'mg-blot-body';
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
            extraLine.className = 'mg-blot-extra';
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
    const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [magazineCategories, setMagazineCategories] = useState<MagazineCategory[]>([]);

    // Category Management State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<{ id: string, name: string, order: number, isActive: boolean } | null>(null);
    const [categoryForm, setCategoryForm] = useState({ name: '', isActive: true });

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryBusy, setCategoryBusy] = useState(false);

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
        else adminConfirmLeave(blocker, blockedReason.current.error + '\n초안을 보관하지 못한 상태로 이동할까요?');
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
                    adminNotify('이미지 업로드 실패');
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
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
        input.onchange = () => { void handleSliderFiles(Array.from(input.files || [])); };
        input.click();
    };

    const handleSliderFiles = async (files: File[]) => {
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
                            adminNotify('이미지 업로드에 실패했습니다.');
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
                adminNotify('슬라이더 이미지 업로드 실패');
            }
            });
        }
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
            adminNotify('장소 이름 / 주소 / 지도 임베드 중 하나는 입력해주세요.');
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
                setListState('ready');
            } else setListState('error');
        } catch (error) {
            console.error('Error fetching magazines:', error);
            setListState('error');
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

    const handleImageUpload = async (files: File[]) => {
        const file = files[0];
        if (file) {
            await runUpload(async () => {
            const session = sessionRef.current;
            try {
                const url = await uploadImage(file, 'magazines');
                if (!mountedRef.current || sessionRef.current !== session || (scopeRef.current && scopeRef.current.userId !== accountRef.current)) return;
                setFormData(prev => ({ ...prev, image: url }));
            } catch (error) {
                console.error('Magazine image upload failed:', error);
                adminNotify('이미지 업로드 실패');
            }
            });
        }
    };

    const handleAuthorImageUpload = async (files: File[]) => {
        const file = files[0];
        if (!file) return;
        await runUpload(async () => {
        const session = sessionRef.current;
        try {
            const url = await uploadImage(file, 'magazine-authors');
            if (!mountedRef.current || sessionRef.current !== session || accountRef.current !== user?.id) return;
            setFormData(prev => ({ ...prev, authorImage: url }));
        } catch (error) {
            console.error('Magazine author image upload failed:', error);
            adminNotify('저자 사진 업로드 실패');
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
        if (await adminConfirm('정말 삭제하시겠습니까?')) {
            try {
                await api.magazines.delete(id);
                fetchMagazines();
            } catch (error) {
                console.error('Error deleting magazine:', error);
                adminNotify('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const handleSubmit = async () => {
        if (saveLock.current || uploadLock.current || pendingRef.current || !scopeRef.current || scopeRef.current.userId !== user?.id) return;
        if (!formRef.current.title?.trim()) { adminNotify('제목을 입력해주세요.'); return; }
        saveLock.current = true; setSaving(true);
        const session = sessionRef.current;
        const scope = { ...scopeRef.current };
        flushMagazineDraft();
        const ownedRevision = revisionRef.current;
        try {
            if (editingMagazine) {
                const latest = magazineFromApi(await api.magazines.get(editingMagazine.id));
                if (!mountedRef.current || sessionRef.current !== session || accountRef.current !== scope.userId) return;
                if (magazineDraftFingerprint(latest) !== magazineDraftFingerprint(baselineRef.current) && !await adminConfirm('편집 중 서버의 매거진 원본이 변경되었습니다. 현재 작성 내용으로 덮어쓸까요?')) return;
            }
            const content = editorContent;

            if (!formData.title?.trim()) {
                adminNotify('제목을 입력해주세요.');
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
            adminNotify(removed.ok ? '저장되었습니다!' : '저장되었습니다. 브라우저 초안 정리에는 실패했습니다.');
            fetchMagazines();
            resetForm(true);
        } catch (error: any) {
            console.error('Error saving magazine:', error);
            adminNotify(`저장 실패: ${error.message || '저장 중 오류가 발생했습니다.'}`);
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
            adminNotify('카테고리명을 입력해주세요.');
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
            adminNotify('이 카테고리에 매거진이 있어 삭제할 수 없습니다.');
            return;
        }
        if (await adminConfirm('이 카테고리를 삭제하시겠습니까?')) {
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

    // Quick add from the category tab — same request as the modal; new categories start visible.
    const handleQuickAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name || categoryBusy) return;
        if (magazineCategories.some(c => c.name === name)) {
            adminNotify('이미 같은 이름의 카테고리가 있습니다.');
            return;
        }
        setCategoryBusy(true);
        try {
            const maxOrder = magazineCategories?.length ? Math.max(...magazineCategories.map(c => c.order)) : 0;
            await api.categories.create({
                id: `mag-cat-${Date.now()}`,
                name,
                is_active: true,
                order: maxOrder + 1,
                type: 'magazine',
                icon: 'article',
                description: ''
            });
            setNewCategoryName('');
            fetchCategories();
        } catch (error) {
            adminNotify(`카테고리 추가 실패: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setCategoryBusy(false);
        }
    };

    const formatCardDate = (value?: string) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value.slice(0, 10).replace(/-/g, '.');
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    };

    const saveLabel = saving ? '저장 중…' : uploading ? '사진 업로드 중…' : formData.isActive ? (editingMagazine ? '수정 완료' : '발행하기') : '임시 저장';
    const switchTab = (tab: 'magazines' | 'categories') => { if (viewMode === 'edit' && !resetForm()) return; setActiveTab(tab); };
    const restoreRecovery = () => {
        if (recovery.kind !== 'draft' || saveLock.current || uploadLock.current) return;
        const restored = recovery.draft; pendingRef.current = false; revisionRef.current = restored.revision; storedRef.current = magazineDraftFingerprint(restored.form);
        setFormData(structuredClone(restored.form)); setEditorContent(restored.form.content || ''); setDraftSavedAt(restored.savedAt); setRecovery({ kind: 'empty' });
    };
    const categoryChips = [...categories, ...[...new Set(magazines.map(m => m.category))].filter(name => name && !categories.includes(name))];

    // Header actions differ between list and edit views
    const headerActions = viewMode === 'edit' ? (
        <>
            <AdminButton variant="secondary" size="sm" leading={<IconChevronLeft />} disabled={saving || uploading} onClick={() => resetForm()}>목록</AdminButton>
            <AdminButton variant="primary" leading={<IconCheck />} loading={saving} disabled={editorLocked} onClick={() => void handleSubmit()}>{saveLabel}</AdminButton>
        </>
    ) : (
        <AdminButton variant="primary" leading={<IconWrite />} onClick={handleCreateNew}>매거진 작성</AdminButton>
    );

    return (
        <AdminLayout activePage="magazines" title="매거진 관리" actions={headerActions}>
            <div className="cm-page mg-page">
            <AdminTabs label="매거진 관리 화면" value={activeTab} onChange={switchTab}
                items={[{ value: 'magazines', label: '매거진 목록' }, { value: 'categories', label: '카테고리 관리' }]} />
            {draftNotice && <AdminMessage tone="cautionary" role="alert">{draftNotice}</AdminMessage>}
            {viewMode === 'edit' && <AdminMessage role="status" title="이 브라우저에 관리자별 매거진 초안을 자동 보관합니다."
                actions={<>
                    {recovery.kind === 'draft' && <AdminButton size="sm" variant="primary" onClick={restoreRecovery}>초안 복원</AdminButton>}
                    {(recovery.kind !== 'empty' || dirty || draftSavedAt) && <AdminButton size="sm" variant="secondary" disabled={saving || uploading}
                        onClick={async () => { if (recovery.kind !== 'empty' || await adminConfirm('매거진 변경사항과 보관된 초안을 버릴까요?')) discardRecovery(); }}>초안 버리기</AdminButton>}
                </>}>
                자동 보관은 사이트 발행·서버 임시 저장과 별도입니다. {draftSavedAt ? `마지막 초안 보관: ${new Date(draftSavedAt).toLocaleString('ko-KR')}` : dirty ? '입력 내용을 보관하고 있습니다.' : '변경사항이 생기면 자동 보관합니다.'}
                {recovery.kind === 'draft' && <span className="mg-msg-line">{recovery.conflict ? '보관 후 서버 원본이 변경되었습니다. 초안을 복원하면 저장 시 현재 작성 내용이 원본을 대체합니다.' : '이 문서의 보관된 초안이 있습니다.'} 보관 시각: {new Date(recovery.draft.savedAt).toLocaleString('ko-KR')}</span>}
                {recovery.kind === 'error' && <span className="mg-msg-line" role="alert">{recovery.error}</span>}
            </AdminMessage>}

            {activeTab === 'categories' && (
                <AdminCard flush className="fq-cats" title="매거진 카테고리">
                    <form className="fq-cat-add" onSubmit={(e) => { e.preventDefault(); void handleQuickAddCategory(); }}>
                        <AdminTextInput className="mg-grow" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="새 카테고리 이름 (예: 사진 명소)" aria-label="새 카테고리 이름" />
                        <AdminButton type="submit" variant="primary" loading={categoryBusy} disabled={!newCategoryName.trim()}>추가</AdminButton>
                    </form>
                    {magazineCategories?.map((cat, index) => {
                        const count = magazines?.filter(m => m.category === cat.name).length || 0;
                        return (
                            <div key={cat.id} className="fq-cat-row" data-hidden={!cat.isActive || undefined}>
                                <span className="mg-move">
                                    <AdminIconButton size="sm" label="위로 옮기기" disabled={index === 0} onClick={() => void moveCategoryOrder(index, 'up')}><IconChevronUp /></AdminIconButton>
                                    <AdminIconButton size="sm" label="아래로 옮기기" disabled={index === magazineCategories.length - 1} onClick={() => void moveCategoryOrder(index, 'down')}><IconChevronDown /></AdminIconButton>
                                </span>
                                <span className="fq-cat-name">{cat.name}</span>
                                <span className="fq-cat-count">글 {count}개</span>
                                <AdminSwitch checked={cat.isActive} onChange={() => void handleToggleCategoryActive(cat)} label={cat.isActive ? '활성' : '비활성'} />
                                <AdminIconButton size="sm" label="카테고리 이름·활성 수정" onClick={() => {
                                    setEditingCategory({ id: cat.id, name: cat.name, order: cat.order, isActive: cat.isActive });
                                    setCategoryForm({ name: cat.name, isActive: cat.isActive });
                                    setIsCategoryModalOpen(true);
                                }}><IconPencil /></AdminIconButton>
                                <AdminIconButton size="sm" label={count ? '글이 있어 지울 수 없어요' : '카테고리 삭제'} disabled={count > 0} onClick={() => void handleDeleteCategory(cat)}><IconTrash /></AdminIconButton>
                            </div>
                        );
                    })}
                    {magazineCategories.length === 0 && <AdminEmpty icon={<IconBook />} title="등록된 카테고리가 없어요" />}
                    <p className="fq-cat-note">글이 들어 있는 카테고리는 지울 수 없어요. 먼저 글을 다른 카테고리로 옮겨 주세요.</p>
                </AdminCard>
            )}

            {activeTab === 'magazines' && (
                <>
                    {viewMode === 'list' && (
                        <>
                            <div className="cm-toolbar">
                                <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="매거진 제목 검색" aria-label="매거진 제목 검색" />
                                <span className="mg-chips" role="group" aria-label="카테고리">
                                    <AdminChip active={filterCategory === 'all'} count={magazines.length} onClick={() => setFilterCategory('all')}>전체</AdminChip>
                                    {categoryChips.map(cat => (
                                        <AdminChip key={cat} active={filterCategory === cat} count={magazines.filter(m => m.category === cat).length} onClick={() => setFilterCategory(cat)}>{cat}</AdminChip>
                                    ))}
                                </span>
                            </div>

                            {filteredMagazines?.length === 0 ? (
                                listState === 'loading' ? <AdminLoading />
                                    : listState === 'error' && !magazines.length ? <AdminError reason="목록을 불러오지 못했습니다." onRetry={() => { setListState('loading'); void fetchMagazines(); }} />
                                    : <AdminEmpty icon={<IconBook />} title={magazines.length ? '검색 결과가 없어요' : '작성된 매거진이 없어요'} />
                            ) : (
                                <div className="mg-grid">
                                    {filteredMagazines?.map((magazine, index) => (
                                        <article className="mg-card" key={magazine.id}>
                                            <span className="mg-cover">
                                                {magazine.image ? <img src={magazine.image} alt="" loading="lazy" /> : <IconImage aria-hidden="true" className="mg-cover-icon" />}
                                                <span className="mg-badges">
                                                    <span className="mg-status" data-published={magazine.isActive || undefined}>{magazine.isActive ? '발행' : '초안'}</span>
                                                    {!!magazine.isFeatured && <span className="mg-hot">인기</span>}
                                                </span>
                                            </span>
                                            <span className="mg-body">
                                                <span className="mg-cat">{magazine.category || '카테고리 없음'}</span>
                                                <AdminTextButton className="mg-title mg-open" onClick={() => void handleEdit(magazine)} aria-label={`${magazine.title || '제목 없음'} 편집`}>{magazine.title || '제목 없음'}</AdminTextButton>
                                                <span className="mg-sum">{magazine.description || '요약 설명이 없어요'}</span>
                                            </span>
                                            <div className="mg-foot">
                                                <span className="mg-meta">
                                                    {magazine.author && <><span>{magazine.author}</span><span aria-hidden="true">·</span></>}
                                                    <span>{formatCardDate(magazine.createdAt)}</span>
                                                </span>
                                                {isReorderable && (
                                                    <span className="mg-move" title="목록 순서">
                                                        <AdminIconButton size="sm" label="앞으로 옮기기" disabled={index === 0} onClick={() => void moveMagazine(index, 'up')}><IconChevronLeft /></AdminIconButton>
                                                        <AdminIconButton size="sm" label="뒤로 옮기기" disabled={index === filteredMagazines.length - 1} onClick={() => void moveMagazine(index, 'down')}><IconChevronRight /></AdminIconButton>
                                                    </span>
                                                )}
                                                <AdminIconButton size="sm" label="매거진 수정" onClick={() => void handleEdit(magazine)}><IconPencil /></AdminIconButton>
                                                <AdminIconButton size="sm" label="매거진 삭제" onClick={() => void handleDelete(magazine.id)}><IconTrash /></AdminIconButton>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {viewMode === 'edit' && (
                        <fieldset className="mg-edit-grid" disabled={editorLocked} inert={editorLocked}>
                            <div className="mg-side">
                                <AdminCard title="기본 설정">
                                    <div className="mg-fields">
                                        <AdminField label="카테고리">
                                            {(id) => <AdminSelect id={id} value={formData.category} onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                                                options={categories.map(cat => ({ value: cat, label: cat }))} />}
                                        </AdminField>
                                        <AdminField label="대표 이미지">
                                            <span className="mg-cover-edit">
                                                <span className="mg-cover">{formData.image ? <img src={formData.image} alt="대표 이미지 미리보기" /> : <IconImage aria-hidden="true" className="mg-cover-icon" />}</span>
                                                <span className="mg-row">
                                                    <AdminFileButton size="sm" accept="image/*" leading={<IconUpload />} loading={uploading} onFiles={(files) => void handleImageUpload(files)}>{formData.image ? '이미지 바꾸기' : '이미지 올리기'}</AdminFileButton>
                                                    {formData.image && <AdminTextButton size="sm" tone="assistive" onClick={() => setFormData(prev => ({ ...prev, image: '' }))}>이미지 빼기</AdminTextButton>}
                                                </span>
                                            </span>
                                        </AdminField>
                                        <AdminField label="요약 설명">
                                            {(id) => <AdminTextArea id={id} minRows={3} value={formData.description || ''} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />}
                                        </AdminField>
                                        <AdminField label="태그">
                                            {(id) => <AdminTextInput id={id} value={formData.tag || ''} onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))} />}
                                        </AdminField>
                                        <AdminField label="저자 / 감수자">
                                            {(id) => <AdminTextInput id={id} value={formData.author || ''} placeholder="예: Bolormaa Jambajamts" onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))} />}
                                        </AdminField>
                                        <AdminField label="저자 사진" hint="정사각형 얼굴 사진을 권장합니다.">
                                            <span className="mg-row">
                                                <span className="mg-author">{formData.authorImage ? <img src={formData.authorImage} alt="저자 사진 미리보기" /> : <IconPerson aria-hidden="true" />}</span>
                                                <AdminFileButton size="sm" accept="image/*" leading={<IconUpload />} loading={uploading} onFiles={(files) => void handleAuthorImageUpload(files)}>{formData.authorImage ? '사진 바꾸기' : '사진 올리기'}</AdminFileButton>
                                                {formData.authorImage && <AdminTextButton size="sm" tone="assistive" onClick={() => setFormData(prev => ({ ...prev, authorImage: '' }))}>사진 삭제</AdminTextButton>}
                                            </span>
                                        </AdminField>
                                        <AdminSwitch checked={!!formData.isActive} onChange={(on) => setFormData(prev => ({ ...prev, isActive: on }))} label="발행 상태" />
                                        <AdminSwitch checked={!!formData.isFeatured} onChange={(on) => setFormData(prev => ({ ...prev, isFeatured: on }))} label="인기 게시물" />
                                    </div>
                                </AdminCard>
                                <div className="mg-row is-split">
                                    <AdminButton variant="secondary" fullWidth onClick={() => resetForm()}>작성 취소</AdminButton>
                                    <AdminButton variant="primary" fullWidth loading={saving} onClick={() => void handleSubmit()}>{saveLabel}</AdminButton>
                                </div>
                            </div>

                            <AdminCard flush className="mg-editor">
                                <div className="mg-editor-title">
                                    <AdminTextInput large aria-label="제목" value={formData.title || ''} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="제목을 입력하세요" />
                                </div>
                                <div className="mg-editor-body">
                                    <ReactQuill ref={quillRef} theme="snow" value={editorContent} readOnly={editorLocked} onChange={setEditorContent} modules={modules} className="mg-quill" />
                                </div>
                            </AdminCard>
                        </fieldset>
                    )}
                </>
            )}
            </div>

            {/* Inline Location Block Modal */}
            <AdminDialog open={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} title="위치 카드 삽입" onSubmit={insertLocationBlot} submitLabel="본문에 삽입">
                <AdminField label="장소 이름">
                    {(id) => <AdminTextInput id={id} value={locationModalForm.name} onChange={(e) => setLocationModalForm(prev => ({ ...prev, name: e.target.value }))} placeholder="예: 칭기스칸 박물관" />}
                </AdminField>
                <AdminField label="주소">
                    {(id) => <AdminTextArea id={id} minRows={2} value={locationModalForm.address} onChange={(e) => setLocationModalForm(prev => ({ ...prev, address: e.target.value }))} placeholder="Sambuu St, Ulaanbaatar 15141, Mongolia" />}
                </AdminField>
                <div className="mg-two">
                    <AdminField label="전화">
                        {(id) => <AdminTextInput id={id} type="tel" value={locationModalForm.phone} onChange={(e) => setLocationModalForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+976 xxxx xxxx" />}
                    </AdminField>
                    <AdminField label="홈페이지">
                        {(id) => <AdminTextInput id={id} type="url" value={locationModalForm.website} onChange={(e) => setLocationModalForm(prev => ({ ...prev, website: e.target.value }))} placeholder="https://..." />}
                    </AdminField>
                </div>
                <AdminField label="Google 지도 임베드" hint="iframe 코드 또는 src URL">
                    {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} className="mg-mono" minRows={2} value={locationModalForm.mapEmbedUrl} onChange={(e) => setLocationModalForm(prev => ({ ...prev, mapEmbedUrl: e.target.value }))} placeholder='Google 지도 → "공유" → "지도 임베드" → HTML 복사' />}
                </AdminField>
                <AdminField label="길찾기 검색어" hint="좌표 또는 주소">
                    {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} value={locationModalForm.mapQuery} onChange={(e) => setLocationModalForm(prev => ({ ...prev, mapQuery: e.target.value }))} placeholder="47.918,106.917 or place name" />}
                </AdminField>
                <AdminField label="운영시간" hint="요일별 1줄씩">
                    {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} className="mg-mono" minRows={4} value={locationModalForm.hours} onChange={(e) => setLocationModalForm(prev => ({ ...prev, hours: e.target.value }))} placeholder={'월: 09:00 - 17:00\n화: 09:00 - 17:00\n일: 휴무'} />}
                </AdminField>
            </AdminDialog>

            <AdminDialog open={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} size="sm" title={editingCategory ? '카테고리 수정' : '카테고리 추가'} onSubmit={() => void handleSaveCategory()}>
                <AdminField label="카테고리명">
                    {(id) => <AdminTextInput id={id} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="예: 여행 팁" />}
                </AdminField>
                <AdminSwitch checked={categoryForm.isActive} onChange={(on) => setCategoryForm({ ...categoryForm, isActive: on })} label="상태" description={categoryForm.isActive ? '활성화' : '비활성'} />
            </AdminDialog>
        </AdminLayout>
    );
};
