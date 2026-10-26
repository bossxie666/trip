import { listGuestbookMessages } from "@/services/guestbook-service.server";
import { listHomeFeaturedPhotos } from "@/services/media-service.server";
import { listTripSummaries } from "@/services/trip-repository.server";
import { selectUpcomingTrip } from "./upcoming-trip";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getHomeDashboard(memberId: string) {
  const featuredPhotosPromise = listHomeFeaturedPhotos();
  const messagesPromise = listGuestbookMessages(3);
  const trips = await listTripSummaries("all", memberId);
  const cityRows = trips.flatMap((trip) => trip.cities.map((city) => ({ ...city, tripStatus: trip.status })));
  const cities = [...new Map(cityRows.map((city) => [city.cityId, city])).values()];
  const today = todayInShanghai();
  const upcoming = selectUpcomingTrip(trips, today);
  const completed = trips.filter((trip) => trip.status === "completed").length;
  const cityCount = cities.length;
  const [featuredPhotos, messages] = await Promise.all([featuredPhotosPromise, messagesPromise]);
  return {
    stats: { tripCount: trips.length, completed, cityCount },
    trips: trips.slice(0, 4),
    upcoming,
    cities,
    featuredPhotos,
    messages,
  };
}
