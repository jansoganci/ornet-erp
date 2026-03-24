import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronRight, Menu, Video } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { SearchInput, Badge, Card } from '../../components/ui';
import { useMobileSidebar } from '../../contexts/MobileSidebarContext';
import { cn } from '../../lib/utils';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { getRichGuideCardSummary, getRichGuideTitle } from './content';
import { GUIDE_CATEGORY, GUIDE_TOPICS } from './guideRegistry';

const CATEGORY_ICONS = {
  [GUIDE_CATEGORY.camera]: Video,
  [GUIDE_CATEGORY.alarm]: Bell,
};

const CATEGORY_ORDER = [GUIDE_CATEGORY.camera, GUIDE_CATEGORY.alarm];

export function TechnicalGuideListPage() {
  const { t } = useTranslation('technicalGuide');
  const { openMobileSidebar } = useMobileSidebar();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredTopics = useMemo(() => {
    const q = normalizeForSearch(search.trim());
    return GUIDE_TOPICS.filter((topic) => {
      if (categoryFilter !== 'all' && topic.category !== categoryFilter) return false;
      if (!q) return true;
      const title =
        getRichGuideTitle(topic.i18nKey) || t(`topics.${topic.i18nKey}.title`, { defaultValue: '' });
      const summary = getRichGuideCardSummary(topic.i18nKey);
      const hay = normalizeForSearch(`${title} ${summary}`);
      return hay.includes(q);
    });
  }, [search, categoryFilter, t]);

  const emptyMessage = useMemo(() => {
    if (filteredTopics.length > 0) return null;
    if (search.trim()) return t('list.noResults');
    if (categoryFilter !== 'all') return t('list.emptyCategory');
    return t('list.noResults');
  }, [filteredTopics.length, search, categoryFilter, t]);

  const chipClass = (active) =>
    cn(
      'whitespace-nowrap shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] inline-flex items-center active:scale-[0.98]',
      active
        ? 'bg-primary-600 text-white shadow-md dark:bg-primary-600 dark:text-white'
        : 'border border-neutral-200 bg-white text-neutral-800 dark:border-[#262626] dark:bg-[#1f1f1f] dark:text-neutral-100',
    );

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <div className="hidden md:block">
        <PageHeader title={t('title')} description={t('listDescription')} />
      </div>

      <div
        className={cn(
          'md:hidden sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-1',
          'border-b border-neutral-200 dark:border-[#262626]',
          'bg-white/95 dark:bg-[#0e0e0e]/95 backdrop-blur-md',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={openMobileSidebar}
            className="p-2 -ml-2 rounded-full shrink-0 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={t('list.openMenu')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight truncate min-w-0">
            {t('list.mobileTitle')}
          </h1>
        </div>
      </div>

      <Card className="p-3 md:p-4 border-neutral-200/60 dark:border-neutral-800/60 dark:bg-[#1a1a1a]">
        <div className="space-y-3">
          <SearchInput
            placeholder={t('list.searchPlaceholder')}
            value={search}
            onChange={setSearch}
            size="sm"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={chipClass(categoryFilter === 'all')}
            >
              {t('list.allCategories')}
            </button>
            {CATEGORY_ORDER.map((catId) => (
              <button
                key={catId}
                type="button"
                onClick={() => setCategoryFilter(catId)}
                className={chipClass(categoryFilter === catId)}
              >
                {t(`categories.${catId}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filteredTopics.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-12">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTopics.map((topic) => {
            const titleText =
              getRichGuideTitle(topic.i18nKey) || t(`topics.${topic.i18nKey}.title`, { defaultValue: '' });
            const summary = getRichGuideCardSummary(topic.i18nKey);
            const CatIcon = CATEGORY_ICONS[topic.category] ?? Video;

            return (
              <li key={topic.slug}>
                <Link
                  to={`/technical-guide/${topic.slug}`}
                  className={cn(
                    'group flex h-full min-h-[10.5rem] flex-col rounded-xl border p-5 shadow-sm transition-all',
                    'border-neutral-200 bg-white dark:border-[#262626] dark:bg-[#1a1a1a]',
                    'hover:border-primary-500/60 hover:shadow-md dark:hover:border-primary-500/50',
                    'active:scale-[0.99]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge
                      variant="default"
                      className="shrink-0 gap-1.5 border-0 bg-neutral-100 text-neutral-700 dark:bg-[#262626] dark:text-neutral-200"
                    >
                      <CatIcon className="h-3.5 w-3.5" aria-hidden />
                      <span className="max-w-[10rem] truncate">{t(`categories.${topic.category}`)}</span>
                    </Badge>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <h3 className="text-base font-bold leading-snug text-neutral-900 line-clamp-2 dark:text-neutral-50 pr-1">
                    {titleText}
                  </h3>
                  {summary ? (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 line-clamp-2 dark:text-neutral-400">
                      {summary}
                    </p>
                  ) : (
                    <div className="flex-1 min-h-[2.5rem]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
