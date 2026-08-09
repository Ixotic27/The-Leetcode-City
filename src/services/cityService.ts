import { CityReadModel, type CityLoadOptions, type CityLoadResponse } from "./cityReadModel";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CitySerializer } from "./citySerializer";

export type { CityLoadOptions, CityLoadResponse, CityLoadSuccessBody } from "./cityReadModel";

export class CityService {
  private readonly readModel: CityReadModel;

  constructor(admin?: SupabaseClient, serializer?: CitySerializer) {
    this.readModel = new CityReadModel(admin, serializer);
  }

  async loadCityData(options: CityLoadOptions): Promise<CityLoadResponse> {
    return this.readModel.loadCityData(options);
  }
}
