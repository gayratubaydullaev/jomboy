'use client';

import Link from 'next/link';
import { useTranslation } from '@/contexts/i18n-context';

export function CookiesPageBody() {
  const { t, intlLocale } = useTranslation();

  return (
    <div className="w-full container max-w-3xl mx-auto px-0 sm:px-4 md:px-6 py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">{t('cookies.title')}</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {t('cookies.updated')}{' '}
        {new Date().toLocaleDateString(intlLocale, { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground text-sm md:text-base">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('cookies.whatTitle')}</h2>
          <p>{t('cookies.whatBody')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('cookies.howTitle')}</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('cookies.howCart')}</li>
            <li>{t('cookies.howAuth')}</li>
            <li>{t('cookies.howCsrf')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('cookies.manageTitle')}</h2>
          <p>{t('cookies.manageBody')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('cookies.questionsTitle')}</h2>
          <p>
            {t('cookies.questionsBefore')}{' '}
            <Link href="/" className="text-primary underline underline-offset-4 hover:no-underline">
              {t('cookies.contactLink')}
            </Link>{' '}
            {t('cookies.questionsAfter')}
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/" className="text-primary text-sm font-medium hover:underline">
          {t('cookies.backHome')}
        </Link>
      </p>
    </div>
  );
}
