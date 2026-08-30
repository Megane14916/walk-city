export type AppliedBonus = {
  sourceBuildingType: "commercial" | "factory";
  sourceCount: number;
  effectType: "step_coin_bonus_percent";
  amount: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseAppliedBonuses(
  value: unknown,
  coinsAwarded: number,
): AppliedBonus[] | null {
  if (!Array.isArray(value) || value.length > 2) return null;
  if (coinsAwarded === 0) return value.length === 0 ? [] : null;

  const bonuses: AppliedBonus[] = [];
  for (const item of value) {
    if (
      !isObject(item) ||
      (item.source_building_type !== "commercial" &&
        item.source_building_type !== "factory") ||
      item.effect_type !== "step_coin_bonus_percent"
    ) {
      return null;
    }

    const sourceCount = positiveInteger(item.source_count);
    const amount = positiveInteger(item.amount);
    if (sourceCount === null || amount === null || amount > 50) return null;

    bonuses.push({
      sourceBuildingType: item.source_building_type,
      sourceCount,
      effectType: "step_coin_bonus_percent",
      amount,
    });
  }

  const commercial = bonuses.find(
    (bonus) => bonus.sourceBuildingType === "commercial",
  );
  const factory = bonuses.find(
    (bonus) => bonus.sourceBuildingType === "factory",
  );
  if (
    bonuses.filter((bonus) => bonus.sourceBuildingType === "commercial").length >
      1 ||
    bonuses.filter((bonus) => bonus.sourceBuildingType === "factory").length >
      1 ||
    (commercial && bonuses[0] !== commercial) ||
    (commercial && factory && bonuses[1] !== factory)
  ) {
    return null;
  }

  const commercialAmount = commercial
    ? Math.min(commercial.sourceCount, 3) * 10
    : 0;
  const factoryAmount = factory
    ? Math.min(Math.min(factory.sourceCount, 2) * 25, 50 - commercialAmount)
    : 0;
  if (
    commercial?.amount !== (commercial ? commercialAmount : undefined) ||
    factory?.amount !== (factory ? factoryAmount : undefined) ||
    commercialAmount + factoryAmount > 50
  ) {
    return null;
  }

  return bonuses;
}
