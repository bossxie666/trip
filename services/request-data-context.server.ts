import { cache } from "react";
import { getCurrentMember } from "@/services/auth.server";
import { findTripBySlug } from "@/services/trip-repository.server";

export type TripRequestContext = {
  actor: Awaited<ReturnType<typeof getCurrentMember>>;
  trip: Awaited<ReturnType<typeof findTripBySlug>>;
  membership: { memberId: string } | null;
  permissions: { canRead: boolean };
};

/** Request-local data. Callers pass it explicitly; it is never cached globally. */
export const createTripRequestContext = cache(async function createTripRequestContext(slug: string): Promise<TripRequestContext> {
  const [actor, trip] = await Promise.all([getCurrentMember(), findTripBySlug(slug)]);
  const membership = actor && trip?.members?.some((member) => member.id === actor.id)
    ? { memberId: actor.id }
    : null;
  return { actor, trip, membership, permissions: { canRead: Boolean(actor && trip && membership) } };
});
