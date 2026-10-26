import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import { Role } from '../auth/permissions.js';
import {
  ProductionStage,
  allowedStageTransitions,
  assertStageTransition,
  isProductionStage,
  isStageTransitionAllowed,
  nextStages,
} from './index.js';

describe('production stage machine', () => {
  it('recognises stages', () => {
    expect(isProductionStage('cutting')).toBe(true);
    expect(isProductionStage('welding')).toBe(false);
  });

  it('walks the full production line', () => {
    const path = [
      ProductionStage.Queued,
      ProductionStage.Received,
      ProductionStage.Cutting,
      ProductionStage.Creasing,
      ProductionStage.Assembly,
      ProductionStage.Printing,
      ProductionStage.Qc,
      ProductionStage.Labelling,
      ProductionStage.Packing,
      ProductionStage.Ready,
    ];

    for (let i = 0; i < path.length - 1; i += 1) {
      expect(isStageTransitionAllowed(path[i]!, path[i + 1]!, Role.Production)).toBe(true);
    }
  });

  it('models the qc pass/fail/reject branches', () => {
    expect(
      isStageTransitionAllowed(ProductionStage.Qc, ProductionStage.Labelling, Role.Production),
    ).toBe(true);
    expect(
      isStageTransitionAllowed(ProductionStage.Qc, ProductionStage.Rework, Role.Production),
    ).toBe(true);
    expect(
      isStageTransitionAllowed(ProductionStage.Rework, ProductionStage.Qc, Role.Production),
    ).toBe(true);
    expect(
      isStageTransitionAllowed(ProductionStage.Qc, ProductionStage.Scrapped, Role.Production),
    ).toBe(true);
    expect(
      isStageTransitionAllowed(ProductionStage.Scrapped, ProductionStage.Ready, Role.Production),
    ).toBe(true);
  });

  it('rejects skipping a stage', () => {
    expect(
      isStageTransitionAllowed(ProductionStage.Queued, ProductionStage.Ready, Role.Production),
    ).toBe(false);
    expect(
      isStageTransitionAllowed(ProductionStage.Cutting, ProductionStage.Qc, Role.Production),
    ).toBe(false);
  });

  it('rejects a non-production role', () => {
    expect(
      isStageTransitionAllowed(ProductionStage.Received, ProductionStage.Cutting, Role.Driver),
    ).toBe(false);
  });

  it('throws with the correct code on an illegal transition', () => {
    try {
      assertStageTransition(ProductionStage.Queued, ProductionStage.Ready, Role.Production);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('INVALID_PRODUCTION_STAGE');
    }
  });

  it('allows an admin to cancel from any stage', () => {
    expect(
      isStageTransitionAllowed(ProductionStage.Cutting, ProductionStage.Cancelled, Role.Admin),
    ).toBe(true);
    expect(nextStages(ProductionStage.Cutting)).toContain(ProductionStage.Cancelled);
  });

  it('returns a de-duplicated allowed list', () => {
    const allowed = allowedStageTransitions(ProductionStage.Qc, Role.Production);
    expect(new Set(allowed).size).toBe(allowed.length);
  });
});
