import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-7xl font-bold text-slate-800 dark:text-slate-200 mb-4 tracking-tighter">404</h1>
      <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-300 mb-6">페이지를 찾을 수 없습니다</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm leading-relaxed">
        요청하신 페이지가 사라졌거나, 잘못된 경로입니다. 주소를 다시 한번 확인해 주세요.
      </p>
      <Link 
        to="/" 
        className="px-8 py-3.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
