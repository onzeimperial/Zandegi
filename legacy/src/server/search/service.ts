import { db } from "@/lib/db";

export interface SearchResult {
  type: "goal" | "task" | "skill" | "resource" | "knowledge" | "friend";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** Global search scoped to a user. SQLite `contains` is case-insensitive for ASCII. */
export async function globalSearch(userId: string, q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = { contains: term };

  const [goals, tasks, skills, resources, knowledge, friendships] = await Promise.all([
    db.goal.findMany({
      where: { userId, OR: [{ title: like }, { rawInput: like }, { summary: like }] },
      select: { id: true, title: true, category: true },
      take: 6,
    }),
    db.task.findMany({
      where: { goal: { userId }, title: like },
      select: { id: true, title: true, goalId: true, status: true, goal: { select: { title: true } } },
      take: 6,
    }),
    db.skill.findMany({
      where: { goal: { userId }, name: like },
      select: { id: true, name: true, goalId: true, mastery: true, goal: { select: { title: true } } },
      take: 6,
    }),
    db.resource.findMany({
      where: { goal: { userId }, title: like },
      select: { id: true, title: true, goalId: true, type: true },
      take: 5,
    }),
    db.knowledgeEntry.findMany({
      where: { isCurrent: true, OR: [{ title: like }, { body: like }, { slug: like }] },
      select: { id: true, slug: true, title: true, domain: true },
      take: 5,
    }),
    db.friendship.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requester: { select: { id: true, name: true, email: true } },
        addressee: { select: { id: true, name: true, email: true } },
        requesterId: true,
      },
      take: 20,
    }),
  ]);

  const results: SearchResult[] = [];

  for (const g of goals) results.push({ type: "goal", id: g.id, title: g.title, subtitle: g.category, href: `/goals/${g.id}` });
  for (const t of tasks)
    results.push({ type: "task", id: t.id, title: t.title, subtitle: `${t.goal.title} · ${t.status}`, href: `/goals/${t.goalId}` });
  for (const s of skills)
    results.push({ type: "skill", id: s.id, title: s.name, subtitle: `${s.goal.title} · ${Math.round(s.mastery)}% mastery`, href: `/goals/${s.goalId}` });
  for (const r of resources) results.push({ type: "resource", id: r.id, title: r.title, subtitle: r.type, href: `/goals/${r.goalId}` });
  for (const k of knowledge) results.push({ type: "knowledge", id: k.id, title: k.title, subtitle: k.domain, href: `/knowledge/${k.slug}` });

  const lower = term.toLowerCase();
  for (const f of friendships) {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    if ((other.name ?? "").toLowerCase().includes(lower) || (other.email ?? "").toLowerCase().includes(lower)) {
      results.push({ type: "friend", id: other.id, title: other.name ?? other.email, subtitle: "Friend", href: `/friends` });
    }
  }

  return results.slice(0, 25);
}
