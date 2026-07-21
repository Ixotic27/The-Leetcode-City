import { buildDeveloperProjection, type CityDeveloperLike as CityDeveloperLikeProjection, type CityProjectionValue } from "./cityProjection";

export type CitySerializableValue = CityProjectionValue;

export type CityDeveloperLike = CityDeveloperLikeProjection;

export class CitySerializer {
  serializeDeveloper(dev: CityDeveloperLike): Record<string, CitySerializableValue> {
    return buildDeveloperProjection(dev);
  }
}
