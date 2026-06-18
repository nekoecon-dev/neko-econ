import type { FacilityKind } from '@/types/game';

export const FACILITY_COST: Record<FacilityKind, number> = {
  soupFactory: 5000,
  matatabiPark: 3000,
  fishingPond: 2000,
};

export const FACILITY_META: Record<
  FacilityKind,
  { icon: string; name: string; effect: string }
> = {
  soupFactory: { icon: '🏭', name: 'スープ工場', effect: '失業率 -10% / 生産性UP' },
  matatabiPark: { icon: '🌳', name: 'マタタビ公園', effect: '幸福度UP / ストライキ抑制' },
  fishingPond: { icon: '🎣', name: '釣り堀', effect: '食料供給UP / デフレ圧力' },
};

// Extra market supply per facility (productivity / food => downward price push).
export const FACILITY_SUPPLY_BONUS: Record<FacilityKind, number> = {
  soupFactory: 4,
  matatabiPark: 0,
  fishingPond: 5,
};

// Each soup factory shaves this many points off the unemployment rate.
export const FACTORY_UNEMPLOYMENT_RELIEF = 10;

// Each matatabi park raises the Gini threshold needed to spark a strike.
export const PARK_STRIKE_THRESHOLD_BONUS = 0.08;

/** Total extra supply contributed by all built facilities. */
export function facilitySupplyBonus(facilities: Record<FacilityKind, number>): number {
  return (
    facilities.soupFactory * FACILITY_SUPPLY_BONUS.soupFactory +
    facilities.fishingPond * FACILITY_SUPPLY_BONUS.fishingPond
  );
}
