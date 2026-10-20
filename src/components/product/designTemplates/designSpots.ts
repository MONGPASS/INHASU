import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useUser } from '../../../contexts/UserContext';

/** Only the title and representative photograph are copied into a product design card. */
export interface DesignSpot {
    id: string;
    name: string;
    image: string;
}

/** The former settings.design_spots library is retained in storage, but new selections use 여행지 관리. */
export function designSpotOptionsFromLibrary(value: unknown): DesignSpot[] {
    if (!Array.isArray(value) || value.some(spot => !spot || typeof spot.id !== 'string' || typeof spot.name_kr !== 'string'
        || (spot.images !== undefined && (!Array.isArray(spot.images) || spot.images.some((image: unknown) => typeof image !== 'string'))))) {
        throw new Error('여행지 자료 형식을 확인할 수 없습니다.');
    }
    return value.map(spot => ({ id: spot.id, name: spot.name_kr, image: spot.images?.[0] || '' }));
}

interface LibraryState { accountId: string; spots: DesignSpot[]; loading: boolean; error: string }

/** Each mounted editor reads the shared library afresh; a failed read never modifies saved product cards. */
export function useDesignSpots(): { spots: DesignSpot[]; loading: boolean; error: string; retry: () => void } {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const [library, setLibrary] = useState<LibraryState>({ accountId: '', spots: [], loading: false, error: '' });
    const [attempt, setAttempt] = useState(0);
    const current = library.accountId === accountId ? library : { spots: [], loading: Boolean(accountId), error: '' };

    useEffect(() => {
        const controller = new AbortController();
        setLibrary({ accountId, spots: [], loading: Boolean(accountId), error: '' });
        if (!accountId) {
            setLibrary({ accountId, spots: [], loading: false, error: '관리자 계정으로 로그인한 뒤 여행지를 선택해 주세요.' });
            return () => controller.abort();
        }
        api.touristSpots.list({ active: true }, { signal: controller.signal, cache: 'no-store' })
            .then(data => {
                if (controller.signal.aborted) return;
                const spots = designSpotOptionsFromLibrary(data);
                setLibrary({ accountId, spots, loading: false, error: '' });
            })
            .catch(() => {
                if (!controller.signal.aborted) setLibrary({ accountId, spots: [], loading: false, error: '여행지를 불러오지 못했습니다. 다시 시도해 주세요.' });
            });
        return () => controller.abort();
    }, [accountId, attempt]);

    return { spots: current.spots, loading: current.loading, error: current.error, retry: () => setAttempt(value => value + 1) };
}
