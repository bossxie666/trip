import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AlbumDetailClient } from "@/components/media/AlbumDetailClient";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { getAlbum } from "@/services/album-service.server";

export const dynamic = "force-dynamic";
export default async function AlbumDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string }> }) {
  const actor = await getCurrentMember(); if (!actor) redirect("/unlock?returnTo=%2Falbums");
  let album;
  try { album = await getAlbum((await params).id, actor.id, { filter: (await searchParams).filter || "all" }); }
  catch (caught) {
    if (caught instanceof Error && ["ALBUM_NOT_FOUND", "ALBUM_FORBIDDEN"].includes(caught.message)) notFound();
    throw caught;
  }
  return <><SiteHeader active="albums" currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar, role: actor.role }} /><main className="journal-subpage album-page album-detail-page"><header><Link href="/albums">← 返回相册</Link><h1>{album.title}</h1>{album.description && <p>{album.description}</p>}</header><AlbumDetailClient key={album.id} album={album} /></main></>;
}
