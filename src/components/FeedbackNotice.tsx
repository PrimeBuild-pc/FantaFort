"use client";

import { useLocale } from '@/context/LocaleContext';

// Pages report an action as '✓' on success or the error text otherwise; this keeps the
// two visually and semantically distinct (status vs. alert) everywhere.
export default function FeedbackNotice({ message }: { message: string }) {
  const { t } = useLocale();
  if (!message) return null;
  return message === '✓'
    ? <p className="notice success" role="status">✓ {t('done')}</p>
    : <p className="notice error" role="alert">{message}</p>;
}
