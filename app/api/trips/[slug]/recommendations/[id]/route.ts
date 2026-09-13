import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tripMemberRecords, tripRecords } from "@/db/schema";
import { getCurrentMember } from "@/services/auth.server";
import { getRecommendationDetail } from "@/services/recommendation-repository.server";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const actor = await getCurrentMember();
  if (!actor) return Response.json({ error: "请先验证旅行成员身份。" }, { status: 401 });
  const { slug, id } = await params, db = getDb();
  const trip = (await db.select({ id: tripRecords.id }).from(tripRecords).where(eq(tripRecords.slug, slug)).limit(1))[0];
  if (!trip) return Response.json({ error: "行程不存在。" }, { status: 404 });
  if (!(await db.select({ memberId: tripMemberRecords.memberId }).from(tripMemberRecords).where(and(eq(tripMemberRecords.tripId, trip.id), eq(tripMemberRecords.memberId, actor.id))).limit(1))[0]) return Response.json({ error: "你不是这条行程的成员。" }, { status: 403 });
  const detail = await getRecommendationDetail(trip.id, id);
  return detail ? Response.json(detail) : Response.json({ error: "攻略素材不存在。" }, { status: 404 });
}
