/**
 * Vérification de bout en bout n° 2, données n° 2 et n° 11 (base MÉMOIRE) : les exemples de démonstration déjà semés
 * en production (anciens sujets de droit du travail) sont MASQUÉS par l'étape 20, jamais effacés ; les liens privés
 * d'exemple sont coupés ; un événement est écrit ; rejouable ; un choix ultérieur de Will est respecté.
 * Et le code du lien de démonstration n'est plus écrit en dur dans le dépôt.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Depots } from "@/domaine/depots";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { migrerDonnees } = await import("@/services/migrations");
const { etape20Exemples, TRACE_EXEMPLES_MASQUES } = await import("@/services/migrations/etape-20-exemples");
const { filtreExemples } = await import("@/services/_commun");
const { resoudrePartage } = await import("@/services/partages");

const COLLECTIONS: (keyof Depots)[] = ["videos", "idees", "scripts", "publications", "partages", "notifications", "scriptsMaitres", "matieres", "elements"];

async function empreintes(d: Depots): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const c of COLLECTIONS) r[c] = await (d[c] as { compter: () => Promise<number> }).compter();
  return r;
}

beforeEach(() => reinitialiserDepots());

describe("E2E-2 données n° 2 · exemples de démonstration masqués par la migration", () => {
  it("avant : les exemples sont visibles ; après : masqués, et RIEN n'est effacé", async () => {
    const d = depots();
    const idees = await d.idees.lister();
    expect(idees.some((i) => i.estDemo)).toBe(true);
    expect(idees.filter(await filtreExemples()).some((i) => i.estDemo)).toBe(true);
    const avant = await empreintes(d);

    await migrerDonnees(d, "2026-10-04T08:00:00.000Z");

    expect((await d.parametres.obtenir("afficherExemples"))?.valeur).toBe(false);
    const visibles = (await d.idees.lister()).filter(await filtreExemples());
    expect(visibles.some((i) => i.estDemo)).toBe(false);
    const videosVisibles = (await d.videos.lister()).filter(await filtreExemples());
    expect(videosVisibles.some((v) => v.estDemo)).toBe(false);
    // Rien n'est effacé : les mêmes documents sont toujours là.
    const apres = await empreintes(d);
    for (const c of COLLECTIONS) expect(apres[c], c).toBeGreaterThanOrEqual(avant[c]);
    expect((await d.idees.lister()).length).toBe(idees.length);
  });

  it("les liens privés d'exemple encore ouverts sont coupés (jamais effacés) : la page dit « plus actif »", async () => {
    const d = depots();
    const lien = (await d.partages.lister((p) => !!p.estDemo && !p.revoqueLe && (!p.expireLe || p.expireLe > new Date().toISOString())))[0];
    expect(lien).toBeDefined();
    expect((await resoudrePartage(lien.code)).etat).toBe("ok");
    const r = await etape20Exemples(d, "2026-10-04T08:00:00.000Z");
    expect(r).toMatchObject({ exemplesMasques: true });
    expect((await d.partages.obtenir(lien.id))?.revoqueLe).toBe("2026-10-04T08:00:00.000Z");
    expect((await resoudrePartage(lien.code)).etat).not.toBe("ok");
  });

  it("un événement « migration » est écrit, et la trace empêche tout second passage", async () => {
    const d = depots();
    const r1 = await migrerDonnees(d, "2026-10-04T08:00:00.000Z");
    expect(r1.lots?.exemples).toBeDefined();
    const ev = await d.evenements.lister((e) => e.id === "ev-migration-exemples-2026-10-04T08:00:00.000Z");
    expect(ev[0]?.message).toMatch(/Exemples de démonstration masqués/);
    expect(await d.parametres.obtenir(TRACE_EXEMPLES_MASQUES)).not.toBeNull();

    // Will rallume les exemples : un redémarrage (rejeu) ne les recoupe pas.
    await d.parametres.enregistrer({ id: "afficherExemples", valeur: true, creeLe: "x", modifieLe: "x" });
    const r2 = await migrerDonnees(d, "2026-10-04T09:00:00.000Z");
    expect(r2.lots?.exemples).toBeUndefined();
    expect((await d.parametres.obtenir("afficherExemples"))?.valeur).toBe(true);
    expect(await d.evenements.compter((e) => e.id.startsWith("ev-migration-exemples-"))).toBe(1);
  });
});

describe("E2E-2 données n° 11 · plus de code de lien privé écrit en dur", () => {
  it("le code de démonstration « mails7k2 » n'existe plus dans src/ ; les codes d'exemple sont tirés au hasard", async () => {
    const fichiers: string[] = [];
    const parcourir = (dossier: string) => {
      for (const n of readdirSync(dossier)) {
        const p = join(dossier, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n)) fichiers.push(p);
      }
    };
    parcourir(join(process.cwd(), "src"));
    expect(fichiers.filter((f) => readFileSync(f, "utf8").includes("mails7k2"))).toEqual([]);
    const codes1 = (await reinitialiserDepots().partages.lister()).map((p) => p.code);
    const codes2 = (await reinitialiserDepots().partages.lister()).map((p) => p.code);
    expect(codes1).not.toEqual(codes2);
    for (const c of codes1) expect(c).toMatch(/^[a-z0-9]{8}$/);
  });
});
