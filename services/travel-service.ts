import type { City, Photo, Place, Trip } from "@/models/travel";

// These contracts keep future persistence and map/photo providers outside UI code.
// Phase A deliberately supplies no remote implementation.
export interface TripRepository {
  list(): Promise<Trip[]>;
  findBySlug(slug: string): Promise<Trip | undefined>;
}

export interface CityRepository {
  list(): Promise<City[]>;
  findBySlug(slug: string): Promise<City | undefined>;
}

export interface PlaceRepository {
  listByCity(cityId: string): Promise<Place[]>;
}

export interface PhotoRepository {
  listByTrip(tripId: string): Promise<Photo[]>;
}

export interface TravelMapService {
  getPlaceLink(place: Place): string | undefined;
}
