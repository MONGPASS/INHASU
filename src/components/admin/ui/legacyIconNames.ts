/**
 * 옛 아이콘 이름 → 당근 Seed 아이콘(2026-11-24).
 *
 * 관리자 화면에는 예전 이름으로 아이콘을 부르는 곳이 많다 — Lucide 이름(`DashboardIcon name="lc-…"`)과
 * Material Symbols 이름(`console/Icon name="…"`). 두 부품이 이 표로 Seed 모양을 그리므로 화면 코드를 고치지 않아도
 * 관리자 아이콘이 모두 Seed가 된다. 새 코드는 이 표를 거치지 말고 `Icon*`(./AdminIcons)를 바로 쓴다.
 *
 * Seed에 같은 뜻의 모양이 없으면 가장 가까운 모양을 쓴다(호텔·침대 → 집, 비행기 → 보내기 화살표 등).
 * Material 표에 없는 이름은 `console/Icon`이 예전처럼 Material 글꼴로 그린다(관리자가 고른 카테고리·배너 아이콘처럼 자료에 저장된 이름).
 * Lucide 쪽 키에 `lc-`를 붙이는 것은 scripts/check-icon-subset.mjs가 Material 이름으로 읽지 않게 하려는 것이다.
 */
import {
    IconApps, IconArrowDown, IconArrowRight, IconArrowUp, IconBadge, IconBell, IconBlock, IconBook, IconCalendar, IconCall, IconCamera,
    IconCar, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconCircleQuestion, IconClock, IconClose,
    IconCoins, IconCopy, IconDocument, IconDocumentText, IconDownload, IconExternal, IconEye, IconFilter, IconFlag, IconFlight, IconFolder,
    IconGrip, IconHeart, IconHome, IconHotel, IconImage, IconImages, IconInbox, IconInfo, IconLayers, IconListCategory, IconLocation,
    IconLock, IconLogout, IconMail, IconMap, IconMegaphone, IconMobile, IconMenu, IconMinus, IconMoreHorizontal, IconMoreVertical, IconNote, IconPencil,
    IconPerson, IconPersons, IconPlus, IconRefresh, IconRestaurant, IconSearch, IconSend, IconSettings, IconSparkle, IconStar, IconSwap,
    IconTag, IconTicket, IconTranslate, IconTrash, IconUpload, IconWalk, IconWarning, IconWrite,
} from './AdminIcons';

export type SeedIconComponent = typeof IconApps;

/** Lucide 이름(DashboardIcon) → Seed. DashboardIconName은 이 표의 키다 — 모든 이름에 Seed 모양이 있다. */
export const SEED_FOR_LUCIDE = {
    'lc-archive': IconFolder, 'lc-arrow-left-right': IconSwap, 'lc-arrow-right': IconArrowRight, 'lc-arrow-up': IconArrowUp,
    'lc-arrow-up-down': IconSwap, 'lc-badge-check': IconBadge, 'lc-banknote': IconCoins, 'lc-bed': IconHotel, 'lc-bed-double': IconHotel,
    'lc-bell': IconBell, 'lc-book-open': IconBook, 'lc-calendar': IconCalendar, 'lc-calendar-check': IconCalendar, 'lc-car': IconCar,
    'lc-check': IconCheck, 'lc-chevron-down': IconChevronDown, 'lc-chevron-left': IconChevronLeft, 'lc-chevron-right': IconChevronRight,
    'lc-circle-alert': IconWarning, 'lc-circle-check': IconCheck, 'lc-circle-help': IconCircleQuestion, 'lc-circle-plus': IconPlus,
    'lc-circle-x': IconClose, 'lc-clipboard-check': IconDocument, 'lc-clipboard-list': IconListCategory, 'lc-copy': IconCopy,
    'lc-download': IconDownload, 'lc-external-link': IconExternal, 'lc-eye': IconEye, 'lc-eye-off': IconBlock, 'lc-file-check': IconDocument,
    'lc-file-text': IconDocument, 'lc-folder': IconFolder, 'lc-folder-plus': IconFolder, 'lc-grip-vertical': IconGrip, 'lc-heart': IconHeart,
    'lc-history': IconClock, 'lc-hourglass': IconClock, 'lc-house': IconHome, 'lc-image-plus': IconCamera, 'lc-info': IconInfo,
    'lc-layers': IconLayers, 'lc-layout-dashboard': IconApps, 'lc-link': IconExternal, 'lc-list': IconListCategory, 'lc-loader': IconRefresh,
    'lc-lock': IconLock, 'lc-log-out': IconLogout, 'lc-mail': IconMail, 'lc-map-pin': IconLocation, 'lc-megaphone': IconMegaphone,
    'lc-message-circle': IconMail, 'lc-message-square-quote': IconStar, 'lc-minus': IconMinus, 'lc-mouse-pointer-click': IconArrowRight,
    'lc-panel-top': IconImage, 'lc-panels-top-left': IconApps, 'lc-pencil': IconPencil, 'lc-phone': IconCall, 'lc-plane': IconFlight,
    'lc-plane-landing': IconFlight, 'lc-plane-takeoff': IconFlight, 'lc-plus': IconPlus, 'lc-refresh-cw': IconRefresh,
    'lc-rotate-ccw': IconRefresh, 'lc-route': IconMap, 'lc-search': IconSearch, 'lc-send': IconSend, 'lc-shapes': IconTag,
    'lc-shopping-cart': IconTicket, 'lc-sliders': IconFilter, 'lc-star': IconStar, 'lc-tags': IconTag, 'lc-trash': IconTrash,
    'lc-trending-up': IconApps, 'lc-user': IconPerson, 'lc-user-round': IconPerson, 'lc-users': IconPersons, 'lc-utensils': IconRestaurant,
    'lc-wallet': IconCoins, 'lc-x': IconClose,
} satisfies Record<string, SeedIconComponent>;

/** Material Symbols 이름(console/Icon) → Seed. 없는 이름은 Material 글꼴 그대로(자료에 저장된 아이콘). */
export const SEED_FOR_MATERIAL: Record<string, SeedIconComponent> = {
    // 추가·삭제·닫기·확인
    add: IconPlus, add_circle: IconPlus, close: IconClose, clear: IconClose, cancel: IconClose, delete: IconTrash, delete_outline: IconTrash,
    remove: IconMinus, remove_circle_outline: IconMinus, horizontal_rule: IconMinus, check: IconCheck, check_circle: IconCheck, done: IconCheck,
    done_all: IconCheck, task_alt: IconCheck, check_box: IconCheck, radio_button_checked: IconCheck, save: IconCheck, verified: IconBadge,
    verified_user: IconBadge, workspace_premium: IconBadge, badge: IconBadge, block: IconBlock, do_not_disturb_on: IconBlock, person_off: IconBlock,
    // 방향·펼치기
    expand_more: IconChevronDown, expand_less: IconChevronUp, chevron_left: IconChevronLeft, chevron_right: IconChevronRight,
    arrow_back: IconChevronLeft, arrow_back_ios: IconChevronLeft, arrow_back_ios_new: IconChevronLeft, arrow_forward: IconArrowRight,
    arrow_outward: IconExternal, arrow_upward: IconArrowUp, arrow_downward: IconArrowDown, swap_horiz: IconSwap, sync_alt: IconSwap, move: IconSwap,
    sort: IconFilter, tune: IconFilter, drag_indicator: IconGrip, more_horiz: IconMoreHorizontal, more_vert: IconMoreVertical, menu: IconMenu,
    open_in_new: IconExternal, link: IconExternal, share: IconUpload, upload: IconUpload, publish: IconUpload, cloud_upload: IconUpload,
    download: IconDownload, input: IconDownload,
    // 진행·새로고침·시간
    refresh: IconRefresh, restart_alt: IconRefresh, sync: IconRefresh, update: IconRefresh, progress_activity: IconRefresh,
    hourglass_top: IconClock, hourglass_empty: IconClock, schedule: IconClock, history: IconClock, pending: IconClock, pending_actions: IconClock,
    // 안내·주의
    info: IconInfo, help: IconCircleQuestion, help_outline: IconCircleQuestion, warning: IconWarning, error: IconWarning, report: IconWarning,
    priority_high: IconWarning, emergency: IconWarning, notification_important: IconWarning, lock: IconLock, key: IconLock, password: IconLock,
    // 편집·문서
    edit: IconPencil, edit_square: IconPencil, edit_note: IconWrite, edit_document: IconWrite, edit_calendar: IconCalendar, draft: IconWrite,
    content_copy: IconCopy, content_paste: IconCopy, article: IconDocument, description: IconDocument, docs: IconDocument, contract: IconDocument,
    assignment: IconDocument, assignment_turned_in: IconDocument, fact_check: IconDocument, picture_as_pdf: IconDocument, print: IconDocument,
    receipt: IconDocument, receipt_long: IconDocument, request_quote: IconDocumentText, manage_search: IconDocumentText, pageview: IconDocumentText,
    preview: IconEye, visibility: IconEye, sticky_note_2: IconNote, notes: IconNote, list: IconListCategory, list_alt: IconListCategory,
    checklist: IconListCategory, format_list_bulleted: IconListCategory, format_list_numbered: IconListCategory, view_list: IconListCategory,
    table_view: IconListCategory, grid_view: IconApps, dashboard: IconApps, view_carousel: IconLayers, stack: IconLayers, tabs: IconLayers,
    category: IconTag, label: IconTag, local_offer: IconTag, style: IconTag, tag: IconTag, folder: IconFolder, folder_special: IconFolder,
    folder_managed: IconFolder, inventory_2: IconFolder, translate: IconTranslate, g_translate: IconTranslate, settings: IconSettings,
    search: IconSearch, travel_explore: IconSearch, search_off: IconSearch, inbox: IconInbox, auto_awesome: IconSparkle, lightbulb: IconSparkle,
    tips_and_updates: IconSparkle, timeline: IconWalk,
    // 사진
    image: IconImage, photo: IconImage, photo_library: IconImages, add_photo_alternate: IconCamera, add_a_photo: IconCamera, photo_camera: IconCamera,
    // 사람·연락
    person: IconPerson, assignment_ind: IconPerson, login: IconPerson, shield_person: IconPerson, support_agent: IconPerson, person_add: IconPersons,
    group: IconPersons, groups: IconPersons, group_add: IconPersons, people: IconPersons, diversity_3: IconPersons, logout: IconLogout,
    mail: IconMail, email: IconMail, chat: IconMail, chat_bubble: IconMail, chat_bubble_outline: IconMail, comment: IconMail, forum: IconMail,
    message: IconMail, sms: IconMail, send: IconSend, outgoing_mail: IconSend, forward_to_inbox: IconSend, mark_email_read: IconCheck,
    mark_email_unread: IconMail, phone: IconCall, call: IconCall, smartphone: IconMobile, campaign: IconMegaphone, notifications: IconBell,
    rate_review: IconStar, reviews: IconStar, star: IconStar, grade: IconStar, stars: IconStar, favorite: IconHeart, favorite_border: IconHeart,
    // 일정·여행
    event: IconCalendar, event_note: IconCalendar, event_available: IconCalendar, event_busy: IconCalendar, event_upcoming: IconCalendar,
    calendar_today: IconCalendar, calendar_month: IconCalendar, calendar_add_on: IconCalendar, calendar_view_day: IconCalendar, today: IconCalendar,
    upcoming: IconCalendar, flight: IconFlight, flight_takeoff: IconFlight, flight_land: IconFlight, luggage: IconFlight, tour: IconFlag,
    flag: IconFlag, route: IconMap, map: IconMap, directions: IconMap, explore: IconMap, hiking: IconWalk, location_on: IconLocation,
    place: IconLocation, add_location: IconLocation, add_location_alt: IconLocation, hotel: IconHotel, bed: IconHotel, night_shelter: IconHotel,
    nights_stay: IconHotel, cabin: IconHotel, cottage: IconHotel, bungalow: IconHotel, holiday_village: IconHotel, apartment: IconHotel,
    home: IconHome, directions_car: IconCar, airport_shuttle: IconCar, directions_bus: IconCar, local_taxi: IconCar, local_shipping: IconCar,
    restaurant: IconRestaurant, restaurant_menu: IconRestaurant, ramen_dining: IconRestaurant,
    // 돈·예약
    payments: IconCoins, payment: IconCoins, paid: IconCoins, attach_money: IconCoins, money: IconCoins, credit_card: IconCoins,
    credit_score: IconCoins, account_balance: IconCoins, account_balance_wallet: IconCoins, confirmation_number: IconTicket, redeem: IconTicket,
    fiber_new: IconSparkle, play_arrow: IconArrowRight, start: IconArrowRight,
};
