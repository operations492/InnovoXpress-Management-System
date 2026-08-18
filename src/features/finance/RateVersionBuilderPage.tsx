import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Icon, Tabs, type TabItem } from '@/ui';
import { useToast } from '@/components/Toast';
import type { RateItem, RateVersion } from '@/domain/ratePlan';
import { zonesForBook } from '@/domain/serviceZone';
import { useRatePlansStore } from '@/store/RatePlansProvider';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';
import { useFreightItemsStore } from '@/store/FreightItemsProvider';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';
import { useAdditionalServicesStore } from '@/store/AdditionalServicesProvider';
import { ServicesStep } from './components/steps/ServicesStep';
import { ItemsStep } from './components/steps/ItemsStep';
import { LanesStep } from './components/steps/LanesStep';
import { RatesStep } from './components/steps/RatesStep';
import { ItemOverrideDialog } from './components/ItemOverrideDialog';
import { ServiceChargesDialog } from './components/ServiceChargesDialog';

/** The 4-step Rate Version builder: Services → Items → Lanes → Rates. */
export function RateVersionBuilderPage() {
  const { planId = '', versionId = '' } = useParams();
  const store = useRatePlansStore();
  const navigate = useNavigate();
  const { flash } = useToast();
  const { levels } = useServiceLevelsStore();
  const { items: freightItems } = useFreightItemsStore();
  const { services } = useAdditionalServicesStore();
  const zonesStore = useServiceZonesStore();

  const plan = store.plans.find((p) => p.id === planId) ?? null;
  const version = plan?.versions.find((v) => v.id === versionId) ?? null;

  const [step, setStep] = useState('services');
  const [overrideItem, setOverrideItem] = useState<RateItem | null>(null);
  const [showCharges, setShowCharges] = useState(false);

  if (!plan || !version) {
    return (
      <div className="p-6">
        <p className="mb-3 text-[13px] text-muted-foreground">Rate plan or version not found.</p>
        <Button variant="utility" size="sm" onClick={() => navigate('/finance/rate-plans')}>
          Back to Rate Plans
        </Button>
      </div>
    );
  }

  const patch = (p: Partial<RateVersion>) => store.updateVersion(plan.id, version.id, p);
  const zones = zonesForBook(zonesStore.zones, plan.zoneBookId ?? '');

  const stepTabs: TabItem[] = [
    { value: 'services', label: 'Services', count: version.serviceLevelIds.length },
    { value: 'items', label: 'Items', count: version.items.length },
    { value: 'lanes', label: 'Lanes', count: version.lanes.length },
    { value: 'rates', label: 'Rates', count: version.rateLines.length },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/finance/rate-plans')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon name="chevronLeft" size={14} /> Rate Plans
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">{plan.title}</h1>
          <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
            Version {version.effectiveFrom || '—'} → {version.expireOn || '—'}
          </p>
        </div>
        <Button variant="utility" size="sm" leadingIcon={<Icon name="receipt" size={15} />} onClick={() => setShowCharges(true)}>
          Service Charges
        </Button>
      </div>

      <div className="border-b">
        <Tabs items={stepTabs} value={step} onChange={setStep} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        {step === 'services' && <ServicesStep version={version} patch={patch} levels={levels} />}
        {step === 'items' && (
          <ItemsStep version={version} patch={patch} freightItems={freightItems} onEditOverride={setOverrideItem} />
        )}
        {step === 'lanes' && <LanesStep version={version} patch={patch} zones={zones} />}
        {step === 'rates' && <RatesStep version={version} patch={patch} levels={levels} freightItems={freightItems} />}
      </div>

      {overrideItem && (
        <ItemOverrideDialog
          key={overrideItem.id}
          open
          onClose={() => setOverrideItem(null)}
          item={overrideItem}
          freightItems={freightItems}
          onSave={(ov) => {
            patch({ items: version.items.map((it) => (it.id === overrideItem.id ? { ...it, override: ov } : it)) });
            flash(ov ? 'Override saved' : 'Override removed');
          }}
        />
      )}

      {showCharges && (
        <ServiceChargesDialog
          open
          onClose={() => setShowCharges(false)}
          version={version}
          services={services}
          onSave={(charges) => {
            patch({ serviceCharges: charges });
            flash('Service charges updated');
          }}
        />
      )}
    </div>
  );
}
