/**
 * 11/10 — miniatures : titre sans code interne, image sans sous-titres (chemin R4), chemin COMPLET du studio avec un vrai `studio-rendu` local (serveur HTTP et files du
 * conteneur ; l'opération `miniature` y est remplacée par une opération d'essai qui note les demandes) :
 * outil choisi par `FOURNISSEUR_MINIATURE=studio-rendu`, stockage R2 (adresses signées localement, aucun envoi).
 * Aucune clé réelle, aucun appel payant.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { DemandeRendu } from "../studio-rendu/src/contrat";
import { FilesRendu } from "../studio-rendu/src/files";
import { creerServeur } from "../studio-rendu/src/serveur";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

// Un studio-rendu local : les demandes « miniature » sont notées et réussissent (instant retenu + 0,2 s).
const recues: DemandeRendu[] = [];
const files = new FilesRendu({
  operations: {
    miniature: async (d) => {
      recues.push(d);
      return { mesures: { instant: Number(d.parametres.instantSec) + 0.2 } };
    },
  },
});
const serveur: Server = creerServeur(files);
await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
const ENV_AVANT = { ...process.env };
Object.assign(process.env, {
  STUDIO_RENDU_URL: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`,
  FOURNISSEUR_MINIATURE: "studio-rendu",
  FOURNISSEUR_STOCKAGE: "r2",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "cle-essai",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "studio-essai",
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const travaux = await import("@/services/travaux");

const MDP = "miniature-titre-code";

afterAll(() => {
  serveur.close();
  for (const k of ["STUDIO_RENDU_URL", "FOURNISSEUR_MINIATURE", "FOURNISSEUR_STOCKAGE", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (ENV_AVANT[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_AVANT[k];
  }
});

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  recues.length = 0;
  await auth.seConnecter(MDP, false);
});

import { couvertureDepuisTitre, instantsHorsSousTitres } from "@/domaine/miniatures";
const miniatures = await import("@/services/miniatures");

describe("couvertureDepuisTitre · jamais de code interne ni de version", () => {
  it.each([
    ["0005-FC-TT-L · Le diagnostic fuite — v5", "Le diagnostic fuite"],
    ["0005-FC-TT-L · Le diagnostic fuite - v2", "Le diagnostic fuite"],
    ["0012-AV-IG-S · Votre PV de 135 € (v3)", "Votre PV de 135 €"],
    ["Le diagnostic fuite — v5", "Le diagnostic fuite"],
  ])("« %s » → « %s »", (entree, attendu) => {
    expect(couvertureDepuisTitre(entree)).toBe(attendu);
  });
  it("5 mots au plus, comme avant", () => {
    const t = couvertureDepuisTitre("0005-FC-TT-L · Pourquoi votre employeur lit vos mails privés chaque matin — v4");
    expect(t).not.toMatch(/\d{4}-|·|v4/i);
    expect(t.split(/\s+/).length).toBeLessThanOrEqual(5);
  });
});

describe("instantsHorsSousTitres", () => {
  it("un instant dans un sous-titre glisse au bord libre", () => {
    const r = instantsHorsSousTitres([5, 12], [{ debutSec: 4, finSec: 7 }], 30);
    expect(r[0] < 3.9 || r[0] > 7.1).toBe(true);
    expect(r[1]).toBe(12);
  });
});

beforeEach(() => {
  recues.length = 0;
});

async function videoCodee(avecMaster: boolean) {
  const d = depots();
  const v = (await d.videos.lister((x) => !!x.estDemo && x.statut === "prete" && !!x.versionChoisieId))[0];
  await d.videos.modifier(v.id, { estDemo: false, titre: "0005-FC-TT-L · Le diagnostic fuite — v5" });
  for (const m of await d.miniatures.lister((x) => x.videoId === v.id)) await d.miniatures.modifier(m.id, { videoId: `${v.id}-ranges` });
  const sortie = (await d.sorties.lister((s) => s.versionId === v.versionChoisieId && s.ratio === v.ratios[0]))[0];
  await d.fichiers.modifier(sortie.fichierId, { cleStockage: `studio/dev/videos/${v.id}/finale.mp4` });
  if (avecMaster) {
    const master = await d.fichiers.enregistrer({ id: "f-master-code", cleStockage: `studio/dev/videos/${v.id}/master-sans-texte.mov`, nom: "master.mov", mime: "video/quicktime", taille: 1, origine: "fabrication", statut: "pret", creeLe: "2026-10-11T10:00:00.000Z", modifieLe: "2026-10-11T10:00:00.000Z" });
    await d.pistes.enregistrer({ id: "piste-master-code", versionId: v.versionChoisieId!, type: "master-sans-texte", ratio: v.ratios[0], fichierId: master.id, fournisseur: "studio-rendu", creeLe: "2026-10-11T10:00:00.000Z", modifieLe: "2026-10-11T10:00:00.000Z" });
  }
  return (await d.videos.obtenir(v.id))!;
}

describe("miniatures d'une vidéo au titre interne", () => {
  it("le titre de couverture écrit et enregistré n'a ni code ni version", { timeout: 60_000 }, async () => {
    const v = await videoCodee(true);
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    expect(recues).toHaveLength(3);
    for (const r of recues) expect(r.parametres.couverture).toBe("Le diagnostic fuite");
    const minis = await depots().miniatures.lister((m) => m.videoId === v.id);
    expect(minis.every((m) => m.titre === "Le diagnostic fuite")).toBe(true);
  });

  it("sans vidéo sans texte, les instants évitent les sous-titres de la vidéo finale", { timeout: 60_000 }, async () => {
    const v = await videoCodee(false);
    // Sous-titres partout sauf un trou à 40 %-50 % : aucun instant ne doit tomber dans un groupe.
    const d = v.dureeCibleSec;
    const trou = [{ id: "s1", debutSec: 0, finSec: d * 0.4, mots: [] }, { id: "s2", debutSec: d * 0.5, finSec: d, mots: [] }];
    await depots().sousTitres.enregistrer({ id: "st-code", videoId: v.id, versionId: v.versionChoisieId!, langue: "fr", version: 1, segments: trou, creeLe: "2026-10-11T10:00:00.000Z", modifieLe: "2026-10-11T10:00:00.000Z" } as never);
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    expect(recues.length).toBeGreaterThan(0);
    for (const r of recues) {
      const t = Number(r.parametres.instantSec);
      expect(trou.some((g) => t >= g.debutSec && t <= g.finSec), `instant ${t}`).toBe(false);
    }
  });

  it("rattrapage : refait les miniatures au code, garde l'ancien fichier, ne touche pas un titre changé, idempotent", { timeout: 60_000 }, async () => {
    const v = await videoCodee(true);
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    const d = depots();
    const minis = await d.miniatures.lister((m) => m.videoId === v.id);
    const [a, b] = minis;
    const anciens = new Map(minis.map((m) => [m.id, m.fichierId]));
    await d.miniatures.modifier(a.id, { titre: "0005-FC-TT-L · LE DIAGNOSTIC FUITE — V5" });
    await d.miniatures.modifier(b.id, { titre: "Mon titre à moi" });
    recues.length = 0;
    expect(await miniatures.refaireMiniaturesTitreInterne(v.id)).toBe(1);
    expect(recues).toHaveLength(1);
    expect(recues[0].parametres.couverture).toBe("LE DIAGNOSTIC FUITE");
    const apresA = (await d.miniatures.obtenir(a.id))!;
    expect(apresA.titre).toBe("LE DIAGNOSTIC FUITE");
    expect(apresA.fichierId).not.toBe(anciens.get(a.id));
    expect(await d.fichiers.obtenir(anciens.get(a.id)!)).toBeTruthy();
    const apresB = (await d.miniatures.obtenir(b.id))!;
    expect(apresB).toMatchObject({ titre: "Mon titre à moi", fichierId: anciens.get(b.id) });
    recues.length = 0;
    expect(await miniatures.refaireMiniaturesTitreInterne()).toBe(0);
    expect(recues).toHaveLength(0);
  });
});
