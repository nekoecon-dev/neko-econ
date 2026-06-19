import type { FacilityKind } from '@/types/game';

export const FACILITY_KINDS: FacilityKind[] = ['soupFactory', 'matatabiPark', 'fishingPond'];

export function isFacilityKind(value: string): value is FacilityKind {
  return (FACILITY_KINDS as string[]).includes(value);
}

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

// Breaking-news headline announced when a facility is dropped onto the map,
// spelling out the economic effect (pushed straight to the news log, no API).
export const FACILITY_NEWS: Record<FacilityKind, string> = {
  soupFactory: '【速報】スープ工場が完成！失業率が10%低下したニャ！',
  matatabiPark: '【速報】マタタビ公園がオープン！猫たちが幸せ、ストライキも遠のいたニャ〜',
  fishingPond: '【速報】釣り堀が完成！スープの供給が増えてデフレ圧力ニャ',
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
