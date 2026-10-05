import { Handshake } from 'lucide-react';
import type { Principal } from '@partners/rbac';
import { Card, CardHeader, Empty } from '@partners/ui';
import { AskChip, DealValue, DueLabel, StagePill } from '@/components/domain';
import type { PartnerDetail } from '@/features/partners/queries';
import type { UserOption } from '@/features/users/queries';

export function DealsCard({
  partner,
  now,
}: {
  partner: PartnerDetail;
  principal: Principal;
  users: readonly UserOption[];
  now: Date;
}) {
  return (
    <Card>
      <CardHeader
        title="Deals"
        count={partner.deals.length}
        icon={<Handshake className="size-4" />}
      />
      {partner.deals.length === 0 ? (
        <Empty title="No deals yet" className="py-8" />
      ) : (
        <ul className="divide-line divide-y">
          {partner.deals.map((deal) => (
            <li key={deal.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-ink text-[13.5px] font-semibold">{deal.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <AskChip askType={deal.askType} short />
                  <DealValue
                    askType={deal.askType}
                    amountMinor={deal.amountMinor}
                    tierName={deal.tier?.name}
                    className="text-[12.5px]"
                  />
                </div>
              </div>
              <StagePill stage={deal.stage} />
              {deal.nextAction && (
                <div className="w-full text-[12.5px]">
                  <span className="text-ink-soft">{deal.nextAction}</span>{' '}
                  <DueLabel due={deal.nextActionDue} stage={deal.stage} now={now} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
