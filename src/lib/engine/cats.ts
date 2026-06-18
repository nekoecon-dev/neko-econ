import type { Cat, CatAction, GameState, Market, PlayerPolicy } from '@/types/game';
import { clamp, round2 } from './math';

const WORK_CHANCE: Record<Cat['personality'], number> = {
  aggressive: 0.9,
  conservative: 0.6,
  lazy: 0.3,
};

const HUNGER_EAT_THRESHOLD = 65;
const ENERGY_SLEEP_THRESHOLD = 15;
const ENERGY_WORK_MIN = 25;

/**
 * Decide a single cat's next action (small state machine).
 * Priority: survival (sleep) > hunger (eat) > work-or-idle by personality.
 */
export function decideCatAction(cat: Cat, market: Market): CatAction {
  if (cat.energy <= ENERGY_SLEEP_THRESHOLD) return 'sleeping';

  if (cat.hunger >= HUNGER_EAT_THRESHOLD) {
    const canEat = cat.inventory > 0 || cat.money >= market.soupPrice;
    if (canEat) return 'eating';
  }

  const wantsToWork = Math.random() < WORK_CHANCE[cat.personality];
  if (wantsToWork && cat.energy > ENERGY_WORK_MIN) return 'working';

  return 'idle';
}

/**
 * Advance a single cat by one tick: metabolism, then the chosen action.
 * Returns gross income (tax is applied later, across all cats, in
 * updateAllCats). Policy hooks: a high interest rate pushes conservative cats
 * out of work and into idleness.
 */
export function updateCat(cat: Cat, market: Market, policy: PlayerPolicy): Cat {
  // Metabolism: hunger creeps up, a little energy is always spent.
  let hunger = clamp(cat.hunger + 4, 0, 100);
  let energy = clamp(cat.energy - 1, 0, 100);
  let money = cat.money;
  let inventory = cat.inventory;

  let action = decideCatAction(cat, market);

  // Policy hook: high interest rate -> conservative cats stop working.
  if (action === 'working' && cat.personality === 'conservative') {
    const idleProbability = policy.interestRate / 40; // up to 0.5 at 20%
    if (Math.random() < idleProbability) action = 'idle';
  }

  switch (action) {
    case 'sleeping': {
      energy = clamp(energy + 30, 0, 100);
      hunger = clamp(hunger + 3, 0, 100);
      break;
    }
    case 'eating': {
      if (inventory > 0) {
        inventory -= 1;
      } else if (money >= market.soupPrice) {
        money = round2(money - market.soupPrice);
      }
      hunger = clamp(hunger - 40, 0, 100);
      break;
    }
    case 'working': {
      energy = clamp(energy - 10, 0, 100);
      // Fixed wages (not price-scaled) keep the money supply from spiralling.
      switch (cat.job) {
        case 'producer': {
          money = round2(money + 8);
          break;
        }
        case 'trader': {
          money = round2(money + 6);
          break;
        }
        case 'investor': {
          // Base wage plus capital income that scales with the interest rate.
          money = round2(money + 4 + money * (policy.interestRate / 100) * 0.2);
          break;
        }
      }
      break;
    }
    case 'idle':
    default: {
      energy = clamp(energy + 12, 0, 100);
      hunger = clamp(hunger + 1, 0, 100);
      break;
    }
  }

  return { ...cat, hunger, energy, money, inventory, action };
}

/**
 * Advance every cat one tick, tally market supply/demand, then apply tax:
 * a share of each cat's work income is pooled and handed to the poorest cat.
 */
export function updateAllCats(state: GameState): GameState {
  const { market, policy, cats } = state;

  let supply = 0;
  let demand = 0;
  let taxPool = 0;

  const priceFactor = 10 / Math.max(market.soupPrice, 1); // negative feedback

  const next = cats.map((cat) => {
    const updated = updateCat(cat, market, policy);

    // Supply: soup put on the market by working producers / traders.
    if (updated.action === 'working') {
      if (cat.job === 'producer') supply += 3;
      else if (cat.job === 'trader') supply += 1;
    }

    // Demand: money- and hunger-sensitive willingness to buy, damped by price.
    const buyingPressure =
      (0.4 + updated.hunger / 100) * (1 + updated.money / 600) * priceFactor * 1.3;
    demand += buyingPressure;

    // Tax: a share of positive work income is collected into the pool.
    if (updated.action === 'working' && updated.money > cat.money) {
      const income = updated.money - cat.money;
      const tax = round2(income * (policy.taxRate / 100));
      if (tax > 0) {
        taxPool += tax;
        return { ...updated, money: round2(updated.money - tax) };
      }
    }
    return updated;
  });

  // Redistribute the tax pool to the single poorest cat.
  if (taxPool > 0 && next.length > 0) {
    let poorest = 0;
    for (let i = 1; i < next.length; i++) {
      if (next[i].money < next[poorest].money) poorest = i;
    }
    next[poorest] = { ...next[poorest], money: round2(next[poorest].money + taxPool) };
  }

  return {
    ...state,
    cats: next,
    market: { ...market, supply: round2(supply), demand: round2(demand) },
  };
}
