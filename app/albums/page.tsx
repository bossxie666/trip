import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AlbumIndexClient } from "@/components/media/AlbumIndexClient";
import { getCurrentMember } from "@/services/auth.server";
import { listAlbums, listAlbumTripOptions } from "@/services/album-service.server";

export const dynamic = "force-dynamic";
export default async function AlbumsPage() {
  const actor = await getCurrentMember(); if (!actor) redirect("/unlock?returnTo=%2Falbums");
  const [albums, trips] = await Promise.all([listAlbums(actor.id), listAlbumTripOptions(actor.id)]);
  return <><SiteHeader active="albums" currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar }} /><main className="journal-subpage album-page compact-page"><AlbumIndexClient albums={albums} trips={trips} /></main></>;
}
