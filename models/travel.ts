export type TripStatus = "inspiration" | "planning" | "completed";

export type Member = {
  id: string;
  name: string;
  displayName: string;
  avatar: string | null;
  active: boolean;
  createdAt: string;
};

export type City = {
  id: string;
  slug: string;
  name: string;
  country?: string;
  cover?: string;
};

export type TripPlaceStatus = "candidate" | "selected" | "locked";

export type TripStage = {
  id: string;
  tripId: string;
  cityId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  city?: City;
  members?: Member[];
};

export type Place = {
  id: string;
  cityId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSystem: "WGS84" | "GCJ02" | null;
  provider: "amap" | "osm" | "manual" | null;
  providerPlaceId: string | null;
  adcode: string | null;
  cityCode: string | null;
  district: string | null;
  typeCode: string | null;
  providerUpdatedAt: string | null;
  createdByMemberId: string | null;
  updatedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DayPlace = { dayId: string; placeId: string; sortOrder: number; note: string | null; arrivalTime: string | null; departureTime: string | null; planStatus?: TripPlaceStatus; place: Place };

export type Day = {
  id: string;
  tripId: string;
  date: string | null;
  title: string;
  updatedAt?: string | null;
  placeIds: string[];
  places?: DayPlace[];
};

export type Expense = {
  id: string;
  tripId: string;
  name: string;
  amount: number;
  currency: "CNY";
  scope: "person" | "shared";
  status?: "estimated" | "paid";
};

export type Photo = {
  id: string;
  tripId: string;
  cityId?: string;
  src: string;
  alt: string;
  takenAt?: string;
};

export type Trip = {
  id: string;
  slug: string;
  title: string;
  status: TripStatus;
  startDate: string | null;
  endDate: string | null;
  people: number;
  cover: string | null;
  timezone?: string | null;
  cities: City[];
  days: Day[];
  expenses: Expense[];
  photos: Photo[];
  stages?: TripStage[];
  createdAt: string;
  updatedAt: string;
  members?: Member[];
  createdByMemberId?: string | null;
  updatedByMemberId?: string | null;
};
