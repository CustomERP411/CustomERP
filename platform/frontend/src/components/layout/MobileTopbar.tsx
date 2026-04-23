import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandMark from '../brand/BrandMark';

interface Props {
  onOpenMenu: () => void;
}

export default function MobileTopbar({ onOpenMenu }: Props) {
  const { t } = useTranslation('sidebar');

  return (
    <div className="md:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-slate-900 px-3 text-white shadow">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('openMenu')}
        className="flex h-10 w-10 items-center justify-center rounded-md text-slate-200 hover:bg-slate-800"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Link to="/projects" className="flex items-center justify-center" title="CustomERP">
        <BrandMark variant="icon" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" alt="" />
      </Link>
      <div className="w-10" aria-hidden="true" />
    </div>
  );
}
