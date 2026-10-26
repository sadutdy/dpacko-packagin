import { DomainError, DomainErrorCode } from '../errors.js';
import { Role } from '../auth/permissions.js';

/**
 * The Production Hub stage machine. Mirrors the flowchart in ARCHITECTURE.md §2.3:
 *
 *   queued -> received -> cutting -> creasing -> assembly -> printing -> qc
 *     qc --pass--> labelling -> packing -> ready
 *     qc --fail--> rework -> qc
 *     qc --reject--> scrapped -> ready
 */

export const ProductionStage = {
  Queued: 'queued',
  Received: 'received',
  Cutting: 'cutting',
  Creasing: 'creasing',
  Assembly: 'assembly',
  Printing: 'printing',
  Qc: 'qc',
  Rework: 'rework',
  Labelling: 'labelling',
  Packing: 'packing',
  Ready: 'ready',
  Scrapped: 'scrapped',
  Cancelled: 'cancelled',
} as const;

export type ProductionStage = (typeof ProductionStage)[keyof typeof ProductionStage];

export const PRODUCTION_STAGES: readonly ProductionStage[] = Object.values(ProductionStage);

export function isProductionStage(value: unknown): value is ProductionStage {
  return typeof value === 'string' && (PRODUCTION_STAGES as readonly string[]).includes(value);
}

export interface ProductionTransition {
  from: ProductionStage | '*';
  to: ProductionStage;
  trigger: string;
  roles: readonly Role[];
}

export const PRODUCTION_TRANSITIONS: readonly ProductionTransition[] = [
  {
    from: ProductionStage.Queued,
    to: ProductionStage.Received,
    trigger: 'job.receive',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Received,
    to: ProductionStage.Cutting,
    trigger: 'station.start',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Cutting,
    to: ProductionStage.Creasing,
    trigger: 'stage.advance',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Creasing,
    to: ProductionStage.Assembly,
    trigger: 'stage.advance',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Assembly,
    to: ProductionStage.Printing,
    trigger: 'stage.advance',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Printing,
    to: ProductionStage.Qc,
    trigger: 'stage.advance',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Qc,
    to: ProductionStage.Labelling,
    trigger: 'qc.pass',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Labelling,
    to: ProductionStage.Packing,
    trigger: 'stage.advance',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Packing,
    to: ProductionStage.Ready,
    trigger: 'stage.advance',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Qc,
    to: ProductionStage.Rework,
    trigger: 'qc.fail',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Rework,
    to: ProductionStage.Qc,
    trigger: 'rework.complete',
    roles: [Role.Production],
  },
  {
    from: ProductionStage.Qc,
    to: ProductionStage.Scrapped,
    trigger: 'qc.reject',
    roles: [Role.Production, Role.Admin],
  },
  {
    from: ProductionStage.Scrapped,
    to: ProductionStage.Ready,
    trigger: 'scrap.close',
    roles: [Role.Production, Role.Admin],
  },
  { from: '*', to: ProductionStage.Cancelled, trigger: 'job.cancel', roles: [Role.Admin] },
];

export function nextStages(from: ProductionStage): ProductionStage[] {
  const direct = PRODUCTION_TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
  const wildcard = PRODUCTION_TRANSITIONS.filter((t) => t.from === '*').map((t) => t.to);
  return [...new Set([...direct, ...wildcard])];
}

export function allowedStageTransitions(from: ProductionStage, role: Role): ProductionStage[] {
  const direct = PRODUCTION_TRANSITIONS.filter(
    (t) => t.from === from && t.roles.includes(role),
  ).map((t) => t.to);
  const wildcard = PRODUCTION_TRANSITIONS.filter(
    (t) => t.from === '*' && t.roles.includes(role),
  ).map((t) => t.to);
  return [...new Set([...direct, ...wildcard])];
}

export function isStageTransitionAllowed(
  from: ProductionStage,
  to: ProductionStage,
  role: Role,
): boolean {
  return allowedStageTransitions(from, role).includes(to);
}

export function assertStageTransition(
  from: ProductionStage,
  to: ProductionStage,
  role: Role,
): void {
  if (isStageTransitionAllowed(from, to, role)) return;

  throw new DomainError(
    DomainErrorCode.INVALID_PRODUCTION_STAGE,
    `Cannot move a job from '${from}' to '${to}'`,
    { from, to, role, allowedTransitions: allowedStageTransitions(from, role) },
  );
}
