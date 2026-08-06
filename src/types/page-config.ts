/**
 * @file page-config.ts
 * @description Type definitions for main page building configurations, zones, and districts.
 */

export interface BuildingConfig {
  readonly id: string;
  readonly name: string;
  readonly height: number;
  readonly width: number;
  readonly depth: number;
  readonly color: string;
  readonly zoneId: string;
}

export interface DistrictConfig {
  readonly id: string;
  readonly displayName: string;
  readonly xOffset: number;
  readonly zOffset: number;
  readonly primaryThemeColor: string;
}

export interface ZoneDefinition {
  readonly id: string;
  readonly label: string;
  readonly buildingCapacity: number;
}
