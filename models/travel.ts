export type TripStatus = "inspiration" | "planning" | "completed";

export type City = {
  id: string;
  slug: string;
  name: string;
  country?: string;
  cover?: string;
};

export type Place = {
  id: string;
  cityId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  category?: string;
};

export type Day = {
  id: string;
  tripId: string;
  date: string | null;
  title: string;
  placeIds: string[];
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
  cities: City[];
  days: Day[];
  expenses: Expense[];
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
  protected?: boolean;
};
