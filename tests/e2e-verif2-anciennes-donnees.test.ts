/**
 * VÉRIFICATION E2E n° 2 — anciennes données de la production (avant le paquet 4, version d186500).
 * On part des données de démonstration, ramenées à l'ANCIENNE forme (champs ajoutés depuis retirés) :
 * - personnages sans `visageParFormat` ;
 * - écritures (générations) sans `essai` ;
 * - publications d'avant le lot R1 (sans `etatEnvoi`, `canalNom`, `cleEnvoi`, `votreMarque`) ;
 * - notifications sans `envoi` ; vidéo en attente avec un accord booléen (`confirme: true`).
 * Puis : la migration du démarrage tourne deux fois. Rien ne disparaît (aucun document, aucun champ), le second
 * passage ne change rien, et les lecteurs gardent le comportement d'avant.
 * Le même contrôle a été fait sur un vrai Postgres chargé avec les données de d186500 (docs/controles/VERIF-E2E-2.md).
 */
import { describe, expect, it } from "vitest";
import type { Depots } from "@/domaine/depots";
import { visagePourFormat } from "@/domaine/distribution";
import { reinitialiserDepots } from "@/donnees/memoire";
import { migrerDonnees, totalChangements } from "@/services/migrations";

type Doc = { id: string } & Record<string, unknown>;

/** Toutes les collections des dépôts → copie profonde de leurs documents. */
async function instantane(d: Depots): Promise<Map<string, Doc>> {
  const m = new Map<string, Doc>();
  for (const [col, depot] of Object.entries(d) as [string, { lister: () => Promise<Doc[]> }][]) {
    for (const e of await depot.lister()) m.set(`${col}/${e.id}`, structuredClone(e));
  }
  return m;
}

/** Copie sans les champs donnés (forme d'avant leur ajout). */
function sans<T extends object>(e: T, ...champs: string[]): T {
  const copie = { ...e } as Record<string, unknown>;
  for (const c of champs) delete copie[c];
  return copie as T;
}

async function versAncienneForme(d: Depots): Promise<void> {
  for (const p of await d.personnages.lister()) await d.personnages.enregistrer(sans(p, "visageParFormat"));
  for (const pub of await d.publications.lister()) {
    await d.publications.enregistrer(sans(pub, "etatEnvoi", "canalNom", "cleEnvoi", "votreMarque", "canalId", "modeBuffer", "envoiCommenceLe", "etatLuLe"));
  }
  for (const n of await d.notifications.lister()) await d.notifications.enregistrer(sans(n, "envoi"));
  for (const g of await d.generations.lister()) await d.generations.enregistrer(sans(g, "essai"));
  const brouillon = (await d.videos.lister((v) => v.statut === "brouillon"))[0];
  if (brouillon) await d.videos.modifier(brouillon.id, { lancementEnAttente: { depuis: new Date().toISOString(), fournisseur: "heygen", confirme: true } });
}

describe("anciennes données de la production → version en ligne (b544423)", () => {
  it("la migration du démarrage ne perd ni document ni champ, et se rejoue sans effet", async () => {
    const d = reinitialiserDepots();
    await versAncienneForme(d);
    const avant = await instantane(d);

    await migrerDonnees(d);
    const apres = await instantane(d);
    const manquants = [...avant.keys()].filter((k) => !apres.has(k));
    expect(manquants).toEqual([]);
    const champsPerdus: string[] = [];
    for (const [k, doc] of avant) for (const champ of Object.keys(doc)) if (!(champ in apres.get(k)!)) champsPerdus.push(`${k}.${champ}`);
    expect(champsPerdus).toEqual([]);

    const second = await migrerDonnees(d);
    expect(totalChangements(second)).toBe(0);
  });

  it("un personnage sans visageParFormat garde le visage par défaut (comportement d'avant)", async () => {
    const d = reinitialiserDepots();
    await versAncienneForme(d);
    for (const p of await d.personnages.lister()) {
      expect(p.visageParFormat).toBeUndefined();
      const visages = await d.visages.lister((v) => v.personnageId === p.id);
      const choisi = visagePourFormat(visages, p, "avocat");
      const pret = visages.filter((v) => v.statut === "pret");
      if (pret.length === 0) expect(choisi).toBeUndefined();
      else expect(pret.map((v) => v.id)).toContain(choisi?.id);
    }
  });

  it("les publications et notifications d'avant restent lisibles et ne repartent pas en envoi", async () => {
    const d = reinitialiserDepots();
    await versAncienneForme(d);
    await migrerDonnees(d);
    for (const pub of await d.publications.lister()) expect(pub.etatEnvoi).toBeUndefined();
    // Le facteur des notifications ne prend que `envoi.statut === "a-envoyer"` : une ancienne notification n'est jamais renvoyée.
    expect((await d.notifications.lister()).filter((n) => n.envoi)).toEqual([]);
  });
});
