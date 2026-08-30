import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAppliedBonuses } from "./bonus-parser.ts";

const commercial = (sourceCount: number, amount: number) => ({
  source_building_type: "commercial",
  source_count: sourceCount,
  effect_type: "step_coin_bonus_percent",
  amount,
});

const factory = (sourceCount: number, amount: number) => ({
  source_building_type: "factory",
  source_count: sourceCount,
  effect_type: "step_coin_bonus_percent",
  amount,
});

describe("parseAppliedBonuses", () => {
  it("accepts an empty bonus list", () => {
    assert.deepEqual(parseAppliedBonuses([], 100), []);
    assert.deepEqual(parseAppliedBonuses([], 0), []);
  });

  it("maps one commercial bonus to camelCase", () => {
    assert.deepEqual(parseAppliedBonuses([commercial(1, 10)], 110), [
      {
        sourceBuildingType: "commercial",
        sourceCount: 1,
        effectType: "step_coin_bonus_percent",
        amount: 10,
      },
    ]);
  });

  it("accepts actual source counts above the effective caps", () => {
    assert.deepEqual(
      parseAppliedBonuses([commercial(4, 30), factory(3, 20)], 150),
      [
        {
          sourceBuildingType: "commercial",
          sourceCount: 4,
          effectType: "step_coin_bonus_percent",
          amount: 30,
        },
        {
          sourceBuildingType: "factory",
          sourceCount: 3,
          effectType: "step_coin_bonus_percent",
          amount: 20,
        },
      ],
    );
    assert.deepEqual(parseAppliedBonuses([factory(3, 50)], 150)?.[0], {
      sourceBuildingType: "factory",
      sourceCount: 3,
      effectType: "step_coin_bonus_percent",
      amount: 50,
    });
  });

  it("rejects bonuses when no coins were awarded", () => {
    assert.equal(parseAppliedBonuses([commercial(1, 10)], 0), null);
  });

  it("rejects an amount that does not match the source count and caps", () => {
    assert.equal(parseAppliedBonuses([commercial(4, 40)], 140), null);
    assert.equal(
      parseAppliedBonuses([commercial(3, 30), factory(2, 50)], 180),
      null,
    );
  });

  it("rejects duplicates and reversed ordering", () => {
    assert.equal(
      parseAppliedBonuses([commercial(1, 10), commercial(1, 10)], 120),
      null,
    );
    assert.equal(
      parseAppliedBonuses([factory(1, 25), commercial(1, 10)], 135),
      null,
    );
  });

  it("rejects unknown effects and invalid counts", () => {
    assert.equal(
      parseAppliedBonuses([
        { ...commercial(1, 10), effect_type: "step_coin_bonus_flat" },
      ], 110),
      null,
    );
    assert.equal(parseAppliedBonuses([commercial(0, 0)], 100), null);
  });
});
