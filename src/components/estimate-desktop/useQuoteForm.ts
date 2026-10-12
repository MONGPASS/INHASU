import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    buildQuoteDone, canSubmitQuote, checkQuoteFile, clearQuoteDraft, loadQuoteDraft, phoneDigits, quoteMissingText, quoteSteps,
    saveQuoteDraft, scrollToQuoteStep, staysFromParam, submitQuote, uploadQuoteFile,
    type QuoteFileState, type QuoteFormValues,
} from './quoteForm';
import { latestQuoteLink, saveQuoteLink } from './quoteLinks';

/**
 * 견적 요청 폼의 상태 — PC·모바일 폼이 함께 쓴다.
 * 임시저장(sessionStorage) 복원, `?stay=` 프리필, 로그인 사용자 자동 채움, 첨부 업로드,
 * 제출(`POST /api/requests`) 후 완료 화면 이동까지 맡는다. 로그인 없이도 요청할 수 있다.
 */
export function useQuoteForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [draft] = useState(loadQuoteDraft);
    // 투어 목록의 여행 타입 카드는 ?stay=4성급 호텔,디럭스 게르 로 넘어온다(임시저장 값보다 우선).
    const [form, setForm] = useState<QuoteFormValues>(() => ({ ...draft.form, ...staysFromParam(searchParams.get('stay')) }));
    const [fileState, setFileState] = useState<QuoteFileState>(draft.fileState);
    const [fileNote, setFileNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    // 이 브라우저에서 이전에 요청한 견적(최근 1건) — 히어로 아래에 링크로 보여 준다.
    const [recent] = useState(latestQuoteLink);
    const uploadSeq = useRef(0);
    const sent = useRef(false);

    // 로그인 사용자는 이름·휴대폰·이메일을 자동으로 채운다(이미 입력한 값은 그대로 둔다).
    useEffect(() => {
        api.auth.me().then((me: { name?: string; phone?: string; email?: string } | null) => {
            if (!me) return;
            setForm((f) => ({
                ...f,
                name: f.name || (me.name || '').slice(0, 40),
                phone: f.phone || phoneDigits(me.phone),
                email: f.email || (me.email || '').slice(0, 120),
            }));
        }).catch(() => {});
    }, []);

    // 입력이 바뀔 때마다 임시저장(새로고침 복원용). 접수된 뒤에는 다시 저장하지 않는다.
    useEffect(() => {
        if (!sent.current) saveQuoteDraft(form, fileState);
    }, [form, fileState]);

    const set = (patch: Partial<QuoteFormValues>) => {
        setError('');
        setForm((f) => ({ ...f, ...patch }));
    };
    const toggleIn = (key: 'travelStyles' | 'destSpots', v: string) =>
        setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
    /** 투어(또는 '여행사에 맡기기')를 바꾸면 관심 지역을 비운다. */
    const pickDestination = (name: string) =>
        setForm((f) => (f.destination === name ? f : { ...f, destination: name, destSpots: [] }));
    /** 입국일을 귀국일 이후로 바꾸면 귀국일을 비운다. */
    const pickDepart = (v: string) =>
        setForm((f) => ({ ...f, depart: v, return_: v && f.return_ > v ? f.return_ : '' }));

    /** 첨부파일은 고르는 즉시 올린다. 실패해도 파일 이름은 요청과 함께 전달된다. */
    const pickFile = async (file: File | undefined) => {
        if (!file) return;
        const problem = checkQuoteFile(file);
        if (problem) {
            setFileNote(problem);
            return;
        }
        const seq = ++uploadSeq.current;
        setFileNote('');
        setError('');
        setFileState('uploading');
        setForm((f) => ({ ...f, fileName: file.name, fileKey: '' }));
        const key = await uploadQuoteFile(file);
        if (seq !== uploadSeq.current) return; // 그 사이 다른 파일을 골랐거나 첨부를 지웠다
        setFileNote('');
        setForm((f) => ({ ...f, fileKey: key || '' }));
        setFileState(key ? 'done' : 'error');
    };
    const removeFile = () => {
        uploadSeq.current += 1;
        setFileNote('');
        setFileState('');
        setForm((f) => ({ ...f, fileName: '', fileKey: '' }));
    };

    const steps = quoteSteps(form);
    const canSubmit = canSubmitQuote(form);

    const submit = async () => {
        if (submitting) return;
        if (!canSubmit) {
            scrollToQuoteStep(steps.indexOf(false));
            return;
        }
        if (fileState === 'uploading') {
            setFileNote('파일 업로드가 끝날 때까지 잠시만 기다려 주세요.');
            scrollToQuoteStep(steps.length - 1); // 첨부파일은 마지막 스텝에 있다
            return;
        }
        setSubmitting(true);
        setError('');
        const result = await submitQuote(form);
        if (!result.ok) {
            setSubmitting(false);
            setError(result.message);
            return;
        }
        const done = buildQuoteDone(form, result.token);
        saveQuoteLink({ token: done.token, name: done.name, createdAt: done.createdAt });
        sent.current = true;
        clearQuoteDraft();
        navigate('/estimate-complete', { state: done, replace: true });
        window.scrollTo(0, 0);
    };

    return {
        form, set, toggleIn, pickDestination, pickDepart,
        fileState, fileNote, pickFile, removeFile,
        steps, canSubmit, missingText: quoteMissingText(form),
        submitting, error, submit, recent,
    };
}
