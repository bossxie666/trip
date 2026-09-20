import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AlbumDetailClient } from "@/components/media/AlbumDetailClient";
import { WorkspaceNavLink as Link } from "@/components/trip/WorkspaceNavLink";
import { getCurrentMember } from "@/services/auth.server";
import { getAlbum } from "@/services/album-service.server";

export const dynamic = "force-dynamic";
export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentMember(); if (!actor) redirect("/unlock?returnTo=%2Falbums");
  let album; try { album = await getAlbum((await params).id, actor.id); } catch { notFound(); }
  return <><SiteHeader active="albums" currentMember={{ id: actor.id, displayName: actor.displayName, avatar: actor.avatar }} /><main className="journal-subpage album-page album-detail-page"><header><Link href="/albums">← 返回相册</Link><h1>{album.title}</h1>{album.description && <p>{album.description}</p>}</header><AlbumDetailClient album={album} /></main></>;
}
