import { useI18n } from '@/lib/i18n';

/** Shared banner when merchant paused online orders or reservations. */
export default function ShopNotAcceptingBanner({
  kind,
  phone,
}: {
  kind: 'orders' | 'reservations' | 'both';
  phone?: string | null;
}) {
  const { t } = useI18n();
  const msg =
    kind === 'orders'
      ? t('shopNotAcceptingOrders')
      : kind === 'reservations'
        ? t('shopNotAcceptingReservations')
        : t('shopNotAcceptingBoth');
  return (
    <div className="border border-amber-200 bg-amber-50 text-amber-950 px-4 py-3 text-sm space-y-1">
      <p className="font-medium">{msg}</p>
      {phone ? (
        <p>
          <a className="underline font-semibold" href={`tel:${phone.replace(/\s+/g, '')}`}>
            {phone}
          </a>
        </p>
      ) : null}
    </div>
  );
}
