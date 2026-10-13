import { KAKAO_CHANNEL_CHAT_URL } from '../constants/company';

/** Open the registered customer consultation channel from a user click. */
export function openKakaoConsultation() {
    window.open(KAKAO_CHANNEL_CHAT_URL, '_blank', 'noopener,noreferrer');
}
