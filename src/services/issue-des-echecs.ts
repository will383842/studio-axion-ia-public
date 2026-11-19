/**
 * S-13-AFFICHAGE-v19c · Lecture seule : ce que sont devenus les échecs des derniers jours (reparti seul, repris, en cours,
 * resté à Williams). Ne lève JAMAIS d'erreur : sans lecture possible, les 4 nombres valent 0. N'écrit rien.
 */
import "server-only";
import { compterIssues, type IssueEchec } from "@/domaine/issue-des-echecs";
import type { Travail } from "@/domaine/types";
import { depots } from "./_commun";
import { lireEchecs } from "./journal-echecs";

const ZERO = (): Record<IssueEchec, number> => ({ "reparti-seul": 0, repris: 0, "en-cours": 0, "reste-a-williams": 0 });

export async function lireIssuesDesEchecs({ joursMax = 30 }: { joursMax?: number } = {}): Promise<{ issues: Record<IssueEchec, number>; total: number }> {
  try {
    const lignes = await lireEchecs({ joursMax });
    const ids = new Set(lignes.map((l) => l.travailId));
    const travaux = await depots().travaux.lister(
      (t) => ids.has(t.id),
      (t) => ({ id: t.id, statut: t.statut, tentatives: t.tentatives, reprise: t.reprise }) as Travail,
    );
    const issues = compterIssues(lignes, new Map(travaux.map((t) => [t.id, t])));
    return { issues, total: Object.values(issues).reduce((a, b) => a + b, 0) };
  } catch {
    return { issues: ZERO(), total: 0 };
  }
}
