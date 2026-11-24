import { Routes, Route, Navigate, matchPath, useLocation } from 'react-router-dom'
import { useEffect, Suspense, lazy } from 'react'
import { Layout } from './components/layout/Layout'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
const TourProducts = lazy(() => import('./pages/TourProducts').then(module => ({ default: module.TourProducts })))
const ProductDetail = lazy(() => import('./pages/ProductDetail').then(module => ({ default: module.ProductDetail })))
const DocumentItinerary = lazy(() => import('./pages/DocumentItinerary').then(module => ({ default: module.DocumentItinerary })))
const DocumentContract = lazy(() => import('./pages/DocumentContract').then(module => ({ default: module.DocumentContract })))
const CategoryPage = lazy(() => import('./pages/CategoryPage').then(module => ({ default: module.CategoryPage })))
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })))
import { AdminGuard } from './components/auth/AdminGuard'
import { AuthGuard } from './components/auth/AuthGuard'
import { CustomerAccessGuard } from './components/auth/CustomerAccessGuard'
import { SEO } from './components/seo/SEO'
import { trackPageView } from './utils/analytics'

import { NotificationProvider } from './contexts/NotificationContext'
import { FloatingConsultation } from './components/common/FloatingConsultation'
import { AdminWorkspaceProvider } from './components/admin/AdminWorkspaceContext'
import { adminPageLoaders } from './lib/adminPagePreload'

// Lazy Load Pages - Handling Named Exports
const Reservation = lazy(() => import('./pages/Reservation').then(module => ({ default: module.Reservation })))
const Payment = lazy(() => import('./pages/Payment').then(module => ({ default: module.Payment })))
const ReservationComplete = lazy(() => import('./pages/ReservationComplete').then(module => ({ default: module.ReservationComplete })))
const UserReviews = lazy(() => import('./pages/UserReviews').then(module => ({ default: module.UserReviews })))
const ReviewWrite = lazy(() => import('./pages/ReviewWrite').then(module => ({ default: module.ReviewWrite })))
const ReviewDetail = lazy(() => import('./pages/ReviewDetail').then(module => ({ default: module.ReviewDetail })))
const CustomEstimate = lazy(() => import('./pages/CustomEstimate').then(module => ({ default: module.CustomEstimate })))
const EstimateDetail = lazy(() => import('./pages/EstimateDetail').then(module => ({ default: module.EstimateDetail })))
const EstimateComplete = lazy(() => import('./pages/EstimateComplete').then(module => ({ default: module.EstimateComplete })))
const CustomerLink = lazy(() => import('./pages/CustomerLink').then(module => ({ default: module.CustomerLink })))

const TravelMates = lazy(() => import('./pages/TravelMates').then(module => ({ default: module.TravelMates })))
const TravelMateDetail = lazy(() => import('./pages/TravelMateDetail').then(module => ({ default: module.TravelMateDetail })))
const TravelMateWrite = lazy(() => import('./pages/TravelMateWrite').then(module => ({ default: module.TravelMateWrite })))
const ChatList = lazy(() => import('./pages/ChatList').then(module => ({ default: module.ChatList })))
const ChatRoom = lazy(() => import('./pages/ChatRoom').then(module => ({ default: module.ChatRoom })))
const TravelGuide = lazy(() => import('./pages/TravelGuide').then(module => ({ default: module.TravelGuide })))
const TravelGuideDetail = lazy(() => import('./pages/TravelGuideDetail').then(module => ({ default: module.TravelGuideDetail })))
const FAQPage = lazy(() => import('./pages/FAQ').then(module => ({ default: module.FAQPage })))
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(module => ({ default: module.TermsOfService })))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })))
const GuideApply = lazy(() => import('./pages/GuideApply').then(module => ({ default: module.GuideApply })))
const BookingFlow = lazy(() => import('./pages/BookingFlow').then(module => ({ default: module.BookingFlow })))
const Promotions = lazy(() => import('./pages/Promotions').then(module => ({ default: module.Promotions })))
const PromotionDetail = lazy(() => import('./pages/PromotionDetail').then(module => ({ default: module.PromotionDetail })))
const Contact = lazy(() => import('./pages/Contact').then(module => ({ default: module.Contact })))

// MyPage components
const MyPage = lazy(() => import('./pages/MyPage').then(module => ({ default: module.MyPage })))
const MyTravelMates = lazy(() => import('./pages/MyTravelMates').then(module => ({ default: module.MyTravelMates })))
const MyEstimates = lazy(() => import('./pages/MyEstimates').then(module => ({ default: module.MyEstimates })))

const MyReservations = lazy(() => import('./pages/MyReservations').then(module => ({ default: module.MyReservations })))
const MyReservationDetail = lazy(() => import('./pages/MyReservationDetail').then(module => ({ default: module.MyReservationDetail })))
const MyNotifications = lazy(() => import('./pages/MyNotifications').then(module => ({ default: module.MyNotifications })))
const MyReviews = lazy(() => import('./pages/MyReviews').then(module => ({ default: module.MyReviews })))
const RecentlyViewed = lazy(() => import('./pages/RecentlyViewed').then(module => ({ default: module.RecentlyViewed })))
const Wishlist = lazy(() => import('./pages/Wishlist').then(module => ({ default: module.Wishlist })))

// Admin Pages
const AdminLogin = lazy(adminPageLoaders.login)
const AdminDashboard = lazy(adminPageLoaders.dashboard)
const AdminQuoteManage = lazy(adminPageLoaders.quotes)
const AdminQuoteDesk = lazy(adminPageLoaders.quoteDesk)
const AdminCourseManage = lazy(adminPageLoaders.courses)
const AdminQuoteInbox = lazy(adminPageLoaders.inbox)
const QuoteDeskIndexRedirect = lazy(adminPageLoaders.inboxIndex)
const AdminResourceManage = lazy(adminPageLoaders.resources)
const AdminItineraryManage = lazy(adminPageLoaders.itinerary)
const AdminSpotManage = lazy(adminPageLoaders.spots)
const AdminReservationManage = lazy(adminPageLoaders.reservations)
const AdminCalendar = lazy(adminPageLoaders.calendar)
const AdminBannerManage = lazy(adminPageLoaders.banners)
const AdminProductManage = lazy(adminPageLoaders.products)
const AdminCategoryManage = lazy(adminPageLoaders.categories)
const AdminGuideManage = lazy(adminPageLoaders.guides)
const AdminMagazineManage = lazy(adminPageLoaders.magazines)
const AdminAccommodationManage = lazy(adminPageLoaders.accommodations)
const AdminAccommodationOps = lazy(adminPageLoaders.accommodationOps)
const AdminTemplateManage = lazy(adminPageLoaders.templates)
const AdminReviewManage = lazy(adminPageLoaders.reviews)
const AdminFAQManage = lazy(adminPageLoaders.faq)
const AdminPromotionManage = lazy(adminPageLoaders.promotions)
const AdminInquiryManage = lazy(adminPageLoaders.inquiries)
const AdminTourFAQManage = lazy(adminPageLoaders.tourFaqs)
const AdminUiPreview = lazy(adminPageLoaders.uiPreview)

// Loading Component
const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
  </div>
)

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isProductPreview = !!matchPath('/admin/products/:id/preview', location.pathname);
  const isAdminWorkspace = isAdminRoute && !isProductPreview;
  const isContractPreview = location.pathname.startsWith('/documents/contract/') &&
    new URLSearchParams(location.search).get('preview') === '1';
  const isGuidePrintRoute =
    location.pathname.startsWith('/documents/itinerary/') &&
    new URLSearchParams(location.search).get('guide') === '1';
  const appWrapperClass = isAdminWorkspace
    ? 'admin-app-wrapper'
    : isGuidePrintRoute
      ? 'guide-document-wrapper'
      : 'mobile-app-wrapper';

  useEffect(() => { if (!isProductPreview) trackPageView(location.pathname, location.search); }, [location.pathname, location.search, isProductPreview]);

  // Ensure body background matches the layout style for seamless experience
  useEffect(() => {
    if (isGuidePrintRoute) {
      document.body.style.backgroundColor = '#ffffff';
    } else if (isAdminWorkspace) {
      document.body.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc';
    } else {
      document.body.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#111827' : '#f3f4f6';
    }
  }, [isAdminWorkspace, isGuidePrintRoute]);

  return (
    <div className={appWrapperClass}>
      <SEO />
      <NotificationProvider>
        <AdminWorkspaceProvider enabled={isAdminWorkspace && location.pathname !== '/admin/login'}>
        {!isAdminRoute && !isGuidePrintRoute && !isContractPreview && <FloatingConsultation />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <Layout>
                <Home />
              </Layout>
            } />
            <Route path="/category/:slug" element={<Layout><CategoryPage /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/products" element={<TourProducts />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/reservation/:id" element={<Reservation />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/reservation-complete" element={<AuthGuard><ReservationComplete /></AuthGuard>} />
            {/* Old link: the real booking status lives in My Page (sign-in required). */}
            <Route path="/reservation-status" element={<Navigate to="/mypage/reservations" replace />} />
            <Route path="/reviews" element={<UserReviews />} />
            <Route path="/reviews/write" element={<AuthGuard><ReviewWrite /></AuthGuard>} />
            <Route path="/reviews/:id" element={<ReviewDetail />} />
            <Route path="/custom-estimate" element={<AuthGuard><CustomEstimate /></AuthGuard>} />
            <Route path="/estimate/:id" element={<AuthGuard><CustomerAccessGuard source="quote"><EstimateDetail /></CustomerAccessGuard></AuthGuard>} />
            <Route path="/customer-link" element={<AuthGuard><CustomerLink /></AuthGuard>} />
            <Route path="/estimate-complete" element={<AuthGuard><EstimateComplete /></AuthGuard>} />

            <Route path="/travel-mates" element={<TravelMates />} />
            <Route path="/travel-mates/:id" element={<TravelMateDetail />} />
            <Route path="/travel-mates/write" element={<TravelMateWrite />} />
            <Route path="/chats" element={<ChatList />} />
            <Route path="/chats/:id" element={<ChatRoom />} />
            <Route path="/travel-guide" element={<TravelGuide />} />
            <Route path="/travel-guide/:id" element={<TravelGuideDetail />} />
            <Route path="/mypage" element={<AuthGuard><MyPage /></AuthGuard>} />
            <Route path="/mypage/travel-mates" element={<AuthGuard><MyTravelMates /></AuthGuard>} />
            <Route path="/mypage/estimates" element={<AuthGuard><MyEstimates /></AuthGuard>} />

            <Route path="/mypage/reservations" element={<AuthGuard><MyReservations /></AuthGuard>} />
            <Route path="/mypage/reservations/:id" element={<AuthGuard><CustomerAccessGuard source="reservation"><MyReservationDetail /></CustomerAccessGuard></AuthGuard>} />
            <Route path="/my-booking/:id" element={<AuthGuard><CustomerAccessGuard source="reservation"><MyReservationDetail /></CustomerAccessGuard></AuthGuard>} />
            <Route path="/mypage/notifications" element={<AuthGuard><MyNotifications /></AuthGuard>} />
            <Route path="/mypage/reviews" element={<AuthGuard><MyReviews /></AuthGuard>} />
            <Route path="/mypage/recently-viewed" element={<AuthGuard><RecentlyViewed /></AuthGuard>} />
            <Route path="/mypage/wishlist" element={<AuthGuard><Wishlist /></AuthGuard>} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/quotes" element={<AdminGuard><AdminQuoteManage /></AdminGuard>} />
            {/* 맞춤 견적 데스크: 견적 관리 도구(public/*.html)를 관리자 안에 끼워 넣는다. tool = inbox | bookings | builder | courses | itinerary | spots | resources */}
            {/* 견적 도구 중 React로 옮긴 화면. 주소는 그대로이고 옛 문서(public/일정관리.html·명소관리.html 등)는 비교용으로만 남는다. 견적 문의의 ?id=·?qe=는 AdminQuoteInbox가 AdminQuoteDesk에 맡긴다. */}
            <Route path="/admin/quote-desk" element={<AdminGuard><QuoteDeskIndexRedirect /></AdminGuard>} />
            <Route path="/admin/quote-desk/inbox" element={<AdminGuard><AdminQuoteInbox /></AdminGuard>} />
            <Route path="/admin/quote-desk/courses" element={<AdminGuard><AdminCourseManage /></AdminGuard>} />
            <Route path="/admin/quote-desk/resources" element={<AdminGuard><AdminResourceManage /></AdminGuard>} />
            <Route path="/admin/quote-desk/itinerary" element={<AdminGuard><AdminItineraryManage /></AdminGuard>} />
            <Route path="/admin/quote-desk/spots" element={<AdminGuard><AdminSpotManage /></AdminGuard>} />
            <Route path="/admin/quote-desk/:tool?" element={<AdminGuard><AdminQuoteDesk /></AdminGuard>} />
            {/* Keep list selection and customer editor state in separate route instances. */}
            <Route path="/admin/reservations" element={<AdminGuard><AdminReservationManage key="reservation-list" /></AdminGuard>} />
            <Route path="/admin/customer-workspace/product/:id" element={<AdminGuard><AdminReservationManage key="product-customer" customerPage /></AdminGuard>} />
            <Route path="/admin/customer-workspace/legacy-quote/:id" element={<AdminGuard><AdminReservationManage key="legacy-quote-customer" customerPage customerSource="quote" /></AdminGuard>} />
            <Route path="/admin/customer-workspace/quote/:id" element={<AdminGuard><AdminQuoteDesk customerPage /></AdminGuard>} />
            <Route path="/admin/accommodation-ops" element={<AdminGuard><AdminAccommodationOps /></AdminGuard>} />
            <Route path="/admin/calendar" element={<AdminGuard><AdminCalendar /></AdminGuard>} />
            <Route path="/admin/banners" element={<AdminGuard><AdminBannerManage /></AdminGuard>} />
            <Route path="/admin/products" element={<AdminGuard><AdminProductManage /></AdminGuard>} />
            <Route path="/admin/products/:id/preview" element={<AdminGuard><ProductDetail preview /></AdminGuard>} />
            <Route path="/admin/categories" element={<AdminGuard><AdminCategoryManage /></AdminGuard>} />
            <Route path="/admin/guides" element={<AdminGuard><AdminGuideManage /></AdminGuard>} />
            <Route path="/admin/magazines" element={<AdminGuard><AdminMagazineManage /></AdminGuard>} />
            <Route path="/admin/hotels" element={<AdminGuard><Navigate to="/admin/quote-desk/resources?resourceType=lodges" replace /></AdminGuard>} />
            <Route path="/admin/tourist-spots" element={<AdminGuard><Navigate to="/admin/quote-desk/spots" replace /></AdminGuard>} />
            <Route path="/admin/design-spots" element={<AdminGuard><Navigate to="/admin/quote-desk/spots" replace /></AdminGuard>} />
            <Route path="/admin/accommodations" element={<AdminGuard><AdminAccommodationManage /></AdminGuard>} />
            <Route path="/admin/templates" element={<AdminGuard><AdminTemplateManage /></AdminGuard>} />
            <Route path="/admin/reviews" element={<AdminGuard><AdminReviewManage /></AdminGuard>} />
            <Route path="/admin/faq" element={<AdminGuard><AdminFAQManage /></AdminGuard>} />
            <Route path="/admin/guide-intro" element={<AdminGuard><Navigate to="/admin/quote-desk/resources" replace /></AdminGuard>} />
            <Route path="/admin/promotions" element={<AdminGuard><AdminPromotionManage /></AdminGuard>} />
            <Route path="/admin/inquiries" element={<AdminGuard><AdminInquiryManage /></AdminGuard>} />
            <Route path="/admin/tour-faqs" element={<AdminGuard><AdminTourFAQManage /></AdminGuard>} />
            {/* 관리자 부품 미리보기(개발·확인용, 메뉴에 넣지 않는다). 합성 예시만 보여 주고 API를 부르지 않는다. */}
            <Route path="/admin/__ui" element={<AdminGuard><AdminUiPreview /></AdminGuard>} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/promotions/:id" element={<PromotionDetail />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/guide-apply" element={<GuideApply />} />
            <Route path="/booking-flow" element={<BookingFlow />} />
            <Route path="/documents/itinerary/:reservationId" element={<CustomerAccessGuard source="reservation"><DocumentItinerary /></CustomerAccessGuard>} />
            <Route path="/documents/contract/:reservationId" element={<CustomerAccessGuard source="reservation"><DocumentContract /></CustomerAccessGuard>} />
          </Routes>
        </Suspense>
        </AdminWorkspaceProvider>
      </NotificationProvider>
    </div>
  )
}

export default App
// trigger vercel deployment test
