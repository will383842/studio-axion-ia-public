/**
 * MIGRATION — étape 21 (Source axion-ia.com, 03/10) : les pages clés du site suivies au départ (accueil, formations,
 * audit, implémentation, tarifs, questions fréquentes, à propos) sont ajoutées si elles manquent. Idempotente, testée,
 * AUCUNE suppression ; renvoie null au second passage. Rien n'est lu ici : la lecture se fait par la tâche quotidienne.
 */
import type { Depots } from "@/domaine/depots";
import { idPage, PAGES_DEPART, rubriqueDe } from "@/source-axion/adresses";

export async function etape21SourceAxion(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const ajoutees: string[] = [];
  for (const p of PAGES_DEPART) {
    const id = idPage(p.url);
    if (await d.pagesSite.obtenir(id)) continue;
    await d.pagesSite.enregistrer({ id, url: p.url, rubrique: rubriqueDe(p.url), titre: p.nom, suivie: { par: "depart", depuis: maintenant }, connueAuDepart: true, creeLe: maintenant, modifieLe: maintenant });
    ajoutees.push(p.url.replace("https://axion-ia.com", "") || "/");
  }
  return ajoutees.length ? { pagesSuivies: ajoutees } : null;
}
