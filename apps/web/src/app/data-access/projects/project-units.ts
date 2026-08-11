import { millimetresToUnit, unitToMillimetres } from '@slablab/geometry-engine';
import type { MeasurementUnit } from '@slablab/shared';

const dimensionlessParameters = new Set([
  'hasLid',
  'lidStyle',
  'roundness',
  'sides',
  'points',
  'facets',
  'gores',
  'includeBase',
  'closedTop',
  'rotation',
]);

export const isDimensionalParameter = (field: string): boolean =>
  !dimensionlessParameters.has(field);

export const parameterToMillimetres = (
  field: string,
  value: number,
  unit: MeasurementUnit,
): number => (isDimensionalParameter(field) ? unitToMillimetres(value, unit) : value);

export const parameterFromMillimetres = (
  field: string,
  value: number,
  unit: MeasurementUnit,
): number => (isDimensionalParameter(field) ? millimetresToUnit(value, unit) : value);

export const parametersToMillimetres = (
  parameters: Record<string, number>,
  unit: MeasurementUnit,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(parameters).map(([field, value]) => [
      field,
      parameterToMillimetres(field, value, unit),
    ]),
  );
