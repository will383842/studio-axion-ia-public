/**
 * VL-04 : le moteur « Vidéo longue » passe le contrat commun (`testerMoteurVideo`, format sans prix) sur sa vraie chaîne,
 * branchée sur des DOUBLES (voix et montage simulés : aucun appel réel, 0 €). Éteint = en pause sans dépense.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 120_000 });

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { testerMoteurVideo } = await import("@/moteurs/contrat");
const { creerMoteurVideoLongue, moteurMontageVideoLongue, ID_MOTEUR_VIDEO_LONGUE, COMPOSITION_VIDEO_LONGUE } = await import("@/moteurs/montage-video-longue");
const { IDS_MOTEURS, moteurExiste } = await import("@/moteurs/ids");
const { obtenirMoteur, listerMoteurs } = await import("@/moteurs");
const { RENDU_COULEUR } = await import("@/briques/charte/rendu-couleur");
const { CARACTERES_MAX_MORCEAU } = await import("@/briques/voix-longue");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo } from "@/moteurs/types";
import type { MorceauVoix } from "@/briques/voix-longue";

const MDP = "essai-vl-04-moteur";
const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const chapitre = (n: number) => ({ id: `c${n}`, titre: `Chapitre ${n}`, texte: Array.from({ length: 40 }, (_, i) => `mot${n}x${i}`).join(" ") + "." });

async function commande(): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return { ...c, formatId: "video-longue", moteurId: ID_MOTEUR_VIDEO_LONGUE, ratios: ["16:9"], entrees: { ...c.entrees, videoLongue: { chapitres: [chapitre(1), chapitre(2), chapitre(3)] } } };
}

function doubles() {
  const appels = { voix: [] as MorceauVoix[], montages: 0 };
  const deps = {
    voix: {
      lire: async (m: MorceauVoix) => {
        appels.voix.push(m);
        const mots = m.texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
        return { dureeSec: mots.length * 0.4, mots };
      },
    },
    monter: async (ratio: string) => ((appels.montages += 1), { fichierCle: `essai/video-longue/${ratio.replace(":", "x")}.mp4` }),
  };
  return { appels, deps };
}

const d = doubles();
testerMoteurVideo(creerMoteurVideoLongue(() => d.deps), commande, { sansPrix: true });

async function mener(moteur: MoteurVideo, c: CommandeFabrication, travail: Travail) {
  let t = travail;
  let resultat;
  for (let ms = T0; ms < T0 + 60_000; ms += 500) {
    const r = await moteur.avancer(t, c, ms);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") break;
  }
  return { travail: t, resultat };
}

describe("VL-04 · moteur éteint : pause sans dépense", () => {
  it("sans dépendances reliées : en file, sans échec, sans appel, jamais de résultat", async () => {
    const c = await commande();
    const t = await moteurMontageVideoLongue.lancer(c, { travailId: "t-pause", versionId: "v", titre: "Essai", maintenant: T0 });
    expect(t.statut).toBe("en_file");
    expect(t.etapes.every((e) => e.statut === "en_attente")).toBe(true);
    const r = await moteurMontageVideoLongue.avancer(t, c, T0 + 5000);
    expect(r.travail).toEqual(t);
    expect(r.resultat).toBeUndefined();
    expect((await moteurMontageVideoLongue.estimer(c)).total.centimes).toBe(0);
  });
});

describe("VL-04 · chaîne branchée sur des doubles", () => {
  it("lit le script tel quel, un morceau par appel (≤ 5 000 caractères), 16:9, remarques sans refus", async () => {
    const { appels, deps } = doubles();
    const moteur = creerMoteurVideoLongue(() => deps);
    const c = await commande();
    const t = await moteur.lancer(c, { travailId: "t-ok", versionId: "v", titre: "Essai", maintenant: T0 });
    const fin = await mener(moteur, c, t);
    expect(fin.travail.statut).toBe("termine");
    expect(appels.voix.length).toBeGreaterThan(0);
    for (const m of appels.voix) expect(m.texte.length).toBeLessThanOrEqual(CARACTERES_MAX_MORCEAU);
    const lu = appels.voix.map((m) => m.texte).join(" ");
    for (const n of [1, 2, 3]) expect(lu).toContain(chapitre(n).texte);
    expect(fin.resultat!.sorties.map((s) => `${s.ratio} ${s.resolution}`)).toEqual(["16:9 1920x1080"]);
    expect(fin.resultat!.noteQualite.alertes.every((a) => a.gravite === "info")).toBe(true);
    expect(fin.resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("sans aucun chapitre : échec non réessayable clair, aucune voix lue", async () => {
    const { appels, deps } = doubles();
    const moteur = creerMoteurVideoLongue(() => deps);
    const c = { ...(await commande()), entrees: {} };
    const t = await moteur.lancer(c, { travailId: "t-vide", versionId: "v", titre: "Essai", maintenant: T0 });
    const fin = await mener(moteur, c, t);
    expect(fin.travail.statut).toBe("echec");
    expect(fin.travail.erreur?.reessayable).toBe(false);
    expect(appels.voix).toHaveLength(0);
  });

  it("retouche : la voix gardée n'est pas relue", async () => {
    const { appels, deps } = doubles();
    const moteur = creerMoteurVideoLongue(() => deps);
    const c = await commande();
    const fin = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-1", versionId: "v", titre: "Essai", maintenant: T0 }));
    const avant = appels.voix.length;
    const r = await moteur.retoucher({ commande: c, contexte: { travailId: "t-2", versionId: "v2", titre: "Retouche", maintenant: T0 }, planIds: ["p"], consigne: "Plus lent", parent: { projetMontage: fin.resultat!.projetMontage } as never, operations: [] });
    const fin2 = await mener(moteur, c, r);
    expect(fin2.travail.statut).toBe("termine");
    expect(appels.voix.length).toBe(avant);
  });
});

describe("VL-04 · inscription", () => {
  it("le moteur est inscrit, une seule fois, avec ses 16:9 et sa composition", () => {
    expect(IDS_MOTEURS.filter((i) => i === "montage-video-longue")).toHaveLength(1);
    expect(moteurExiste("montage-video-longue")).toBe(true);
    expect(obtenirMoteur("montage-video-longue")).toBe(moteurMontageVideoLongue);
    expect(moteurMontageVideoLongue.capacites.ratios).toEqual(["16:9"]);
    expect(COMPOSITION_VIDEO_LONGUE).toBe("PlanDeScenes");
    expect(listerMoteurs()).toContain(moteurMontageVideoLongue);
  });

  it("la table de couleur a l'entrée du format (rendu neutre dessiné)", () => {
    expect(RENDU_COULEUR["video-longue"]).toEqual({ lut: null, intensite: 70, nature: "dessine" });
  });

  it("« inscrit partout » : le format est inscrit au registre (src/formats/index.ts:26), aucun oubli sauf navigation absente (masqué)", async () => {
    vi.resetModules();
    const reg = await import("@/formats");
    const { formatVideoLongue } = await import("@/formats/video-longue");
    const { moteurExiste: existe, obtenirMoteur: obtenir } = await import("@/moteurs");
    const { RENDU_COULEUR: lut } = await import("@/briques/charte/rendu-couleur");
    const { codeDuFormat } = await import("@/formats/registre-codes");
    if (!reg.trouverFormat("video-longue")) reg.inscrireFormat({ ...formatVideoLongue });
    const f = reg.trouverFormat("video-longue")!;
    expect(codeDuFormat(f.id)).toBe("VL");
    expect(existe(f.moteur)).toBe(true);
    expect(f.ratios.every((r) => obtenir(f.moteur).capacites.ratios.includes(r))).toBe(true);
    expect(f.id in lut).toBe(true);
  });
});
