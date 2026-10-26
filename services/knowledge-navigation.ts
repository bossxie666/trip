export type KnowledgeQuery = { section?: string; q?: string; tag?: string; destination?: string; favorite?: string; page?: string };

export function knowledgeHref(current: KnowledgeQuery, changes: Partial<KnowledgeQuery> = {}) {
  const query = { ...current, ...changes };
  if (!("page" in changes)) delete query.page;
  const params = new URLSearchParams();
  for (const key of ["section", "q", "tag", "destination", "favorite", "page"] as const) {
    if (query[key]) params.set(key, query[key]!);
  }
  return `/knowledge${params.size ? `?${params}` : ""}`;
}
