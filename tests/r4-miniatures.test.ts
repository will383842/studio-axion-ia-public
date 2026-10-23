/**
 * LOT R4 — miniatures réelles (03/10). Sans clé, sans réseau payant :
 *   - ROUGE prouvé sur 03d297b : une vraie vidéo (non démo) recevait les miniatures de démonstration ;
 *   - règles pures : titre de couverture (5 mots), mot mis en valeur, 3 instants, mise en page dans la zone sûre ;
 *   - le fournisseur `studio-rendu` (service de rendu simulé) : une demande par miniature, reprise d'une panne ;
 *   - l'opération `miniature` de studio-rendu, vrai passage FFmpeg (la plus nette des 5 images, JPEG ≤ 2 Mo).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { couvertureDepuisTitre, dimensionsMiniature, estCleDemo, instantsMiniature, motCleCouverture } from "@/domaine/miniatures";
import { creerFournisseurMiniatureStudioRendu, ESSAIS_MINIATURE } from "@/fournisseurs/rendu/miniature";
import { outilsServeur } from "@/fournisseurs/rendu/inscription";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { EtatRendu, ServiceRendu, SourceMiniature } from "@/fournisseurs/types";
import { OPERATIONS, verifierDemande } from "../studio-rendu/src/contrat";
import {
  contraintesTitre,
  estMotCle,
  formatMiniature,
  hauteurBlocTitre,
  mettreEnPageTitre,
  placementTitre,
  unitesCouverture,
  VARIANTES_MINIATURE,
  type RatioMiniature,
} from "../studio-rendu/compositions/commune/miniature-mise-en-page";
import { choisirPlusNette, creerOperationMiniature, instantsCandidats, OCTETS_MAX_MINIATURE } from "../studio-rendu/src/operations/miniature";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const travaux = await import("@/services/travaux");
const videosService = await import("@/services/videos");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "r4-miniatures-essai";

/* ------------------------------------------------------------------ */
/* ROUGE : jamais une image de démonstration sur une vraie vidéo        */
/* ------------------------------------------------------------------ */

describe("R4 · une vraie vidéo ne reçoit jamais une miniature de démonstration", () => {
  beforeAll(async () => {
    await preparerMotDePasse(MDP);
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    bg.suspendreBoucleGeneration(true);
    await auth.seConnecter(MDP, false);
    for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
    for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  });
  afterEach(() => {
    bg.arreterBoucleGeneration();
    vi.useRealTimers();
  });

  /** Un sujet du banc, ses versions par réseau fabriquées (moteur et outils simulés) : de VRAIES vidéos (non démo). */
  async function videosFabriquees(): Promise<string[]> {
    vi.useFakeTimers({ toFake: ["Date"] });
    const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" });
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
    await bg.validerVariantes((await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id));
    const f = await fr.fabriquerLesN(r.scriptMaitreId, { operationId: "op-r4", lancer: true });
    for (let i = 0; i < 200; i++) {
      if ((await Promise.all(f.videoIds.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete")) return f.videoIds;
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    throw new Error("la fabrication n'avance pas");
  }

  async function clesMiniatures(videoId: string): Promise<string[]> {
    const minis = await depots().miniatures.lister((m) => m.videoId === videoId);
    return Promise.all(minis.map(async (m) => (await depots().fichiers.obtenir(m.fichierId))?.cleStockage ?? ""));
  }

  it("ROUGE (03d297b) : vidéo non démo → aucune miniature /demo/", { timeout: 120_000 }, async () => {
    const ids = await videosFabriquees();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const v = (await depots().videos.obtenir(id))!;
      expect(v.estDemo, id).toBeFalsy();
      for (const cle of await clesMiniatures(id)) expect(estCleDemo(cle), `${id} : ${cle}`).toBe(false);
    }
  });

  it("repli : la VIGNETTE RÉELLE de la vidéo quand rien n'a été calculé ; rien si la vidéo n'en a pas de vraie", { timeout: 120_000 }, async () => {
    const [id] = await videosFabriquees();
    const v = (await depots().videos.obtenir(id))!;
    // Fabrication simulée : la vignette de la sortie est une image de démonstration → aucune miniature.
    expect(await depots().miniatures.compter((m) => m.videoId === id)).toBe(0);
    // Une vraie vignette (clé de notre stockage) : elle devient la miniature, titre de couverture à part.
    const sortie = (await depots().sorties.lister((s) => s.versionId === v.versionChoisieId))[0];
    await depots().fichiers.modifier(sortie.vignetteFichierId, { cleStockage: `studio/dev/videos/${id}/vignette.jpg` });
    await travaux.executerSuites([{ type: "finition", videoId: id, titre: v.titre, ratio: v.ratios[0] }]);
    const [mini] = await depots().miniatures.lister((m) => m.videoId === id);
    expect(mini).toMatchObject({ fichierId: sortie.vignetteFichierId, choisie: true, origine: "vignette" });
    expect(mini.incrustee).toBeFalsy();
    expect((await depots().videos.obtenir(id))!.miniatureChoisieId).toBe(mini.id);
  });

  it("couverture du générateur trop longue : bornée à 5 mots dès sa lecture (même sur la vignette réelle)", { timeout: 120_000 }, async () => {
    const [id] = await videosFabriquees();
    const v = (await depots().videos.obtenir(id))!;
    await depots().variantes.enregistrer({ id: "var-long", couverture: { texte: "Votre employeur peut-il vraiment lire tous vos mails privés", motCle: "mails" }, publication: {} } as never);
    await depots().videos.modifier(id, { varianteId: "var-long" });
    const sortie = (await depots().sorties.lister((s) => s.versionId === v.versionChoisieId))[0];
    await depots().fichiers.modifier(sortie.vignetteFichierId, { cleStockage: `studio/dev/videos/${id}/vignette.jpg` });
    await travaux.executerSuites([{ type: "finition", videoId: id, titre: v.titre, ratio: v.ratios[0] }]);
    const [mini] = await depots().miniatures.lister((m) => m.videoId === id);
    expect(mini.titre.split(" ").filter((m) => /[\p{L}\p{N}]/u.test(m)).length, mini.titre).toBeLessThanOrEqual(5);
  });

  it("titre écrit sur l'image + outil réel non relié : le titre n'est pas changé (jamais un titre qui diffère de l'image)", async () => {
    const v = (await depots().videos.lister((x) => !!x.estDemo && x.statut === "prete"))[0];
    await depots().miniatures.enregistrer({ id: "mini-ecrite", videoId: v.id, fichierId: "f-x", titre: "Amende : l'erreur", choisie: false, ratio: "9:16", incrustee: true, instantSec: 4, variante: 0, origine: "rendu", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
    await expect(videosService.choisirMiniature(v.id, "mini-ecrite", "Un autre titre")).rejects.toThrow(/relié/);
    expect((await depots().miniatures.obtenir("mini-ecrite"))!.titre).toBe("Amende : l'erreur");
    // Même titre : simple choix, rien à refaire.
    await videosService.choisirMiniature(v.id, "mini-ecrite", "Amende : l'erreur");
    expect((await depots().miniatures.obtenir("mini-ecrite"))!.choisie).toBe(true);
  });

  it("une vidéo de DÉMONSTRATION garde ses images de démonstration (comportement inchangé)", async () => {
    const v = (await depots().videos.lister((x) => !!x.estDemo && x.statut === "prete"))[0];
    for (const m of await depots().miniatures.lister((x) => x.videoId === v.id)) await depots().miniatures.modifier(m.id, { videoId: `${v.id}-ranges` });
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);
    const cles = await clesMiniatures(v.id);
    expect(cles).toHaveLength(3);
    expect(cles.every(estCleDemo)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Règles pures                                                        */
/* ------------------------------------------------------------------ */

describe("R4 · titre de couverture et mot mis en valeur", () => {
  it("le titre entier s'il tient en 5 mots", () => {
    expect(couvertureDepuisTitre("Vous recevez un PV ?")).toBe("Vous recevez un PV ?");
    expect(couvertureDepuisTitre("  Licenciement   abusif  ")).toBe("Licenciement abusif");
    expect(couvertureDepuisTitre("Télétravail : quels outils pour l'équipe ?")).toBe("Télétravail : quels outils pour l'équipe ?");
  });
  it("sinon la partie qui tient, ou les premiers mots coupés proprement (jamais un mot outil en dernier)", () => {
    expect(couvertureDepuisTitre("Préavis de démission : ce que dit vraiment la loi")).toBe("Préavis de démission");
    expect(couvertureDepuisTitre("Amende : l'erreur que tout le monde fait")).toBe("Amende : l'erreur");
    expect(couvertureDepuisTitre("Ce que votre employeur ne vous dira jamais sur la rupture")).toBe("Ce que votre employeur");
    for (const t of ["Le préavis de démission que personne ne lit vraiment", "Pourquoi les prud'hommes donnent raison au salarié dans ce cas"]) {
      const c = couvertureDepuisTitre(t);
      expect(c.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length).toBeLessThanOrEqual(5);
      expect(c.split(/\s+/).at(-1)!.toLowerCase()).not.toMatch(/^(le|la|les|de|que|qui|tout|dans|au|ce|ne)$/);
    }
  });
  it("mot mis en valeur : un nombre d'abord (avec son symbole), sinon le mot plein le plus long", () => {
    expect(motCleCouverture("Un PV de 135 € ?")).toBe("135 €");
    expect(motCleCouverture("45 jours pour contester")).toBe("45");
    expect(motCleCouverture("Licenciement abusif : vos droits")).toBe("Licenciement");
    expect(motCleCouverture("le et la")).toBe("");
  });
  it("le mot mis en valeur est retrouvé sur l'image (capitales, accents, apostrophes)", () => {
    expect(estMotCle("L'ERREUR", "erreur")).toBe(true);
    expect(estMotCle("L’ERREUR", "erreur")).toBe(true);
    expect(estMotCle("DÉMISSION", "démission")).toBe(true);
    expect(estMotCle("135 €", "135 €")).toBe(true);
    expect(estMotCle("AMENDE", "erreur")).toBe(false);
    expect(unitesCouverture("Un PV de 135 € ?")).toEqual(["UN", "PV", "DE", "135 € ?"]);
  });
});

describe("R4 · trois instants, le visage d'abord", () => {
  const plans = [
    { debutSec: 0, finSec: 3, sourceImage: "double" as const },
    { debutSec: 3, finSec: 5, sourceImage: "illustration" as const },
    { debutSec: 5, finSec: 14, sourceImage: "double" as const },
    { debutSec: 14, finSec: 18, sourceImage: "rush" as const },
    { debutSec: 18, finSec: 20, sourceImage: "motion" as const },
  ];
  it("instant de couverture d'abord, puis le cœur des plans de la personne (les plus longs), dans les bornes", () => {
    const i = instantsMiniature(plans, 20, { debutSec: 16, finSec: 17 });
    expect(i).toHaveLength(3);
    expect(i[0]).toBe(16.5);
    expect(i[1]).toBeCloseTo(5 + 9 * 0.55, 2);
    expect(i[2]).toBeCloseTo(0 + 3 * 0.55, 2);
    for (const t of i) expect(t).toBeGreaterThanOrEqual(1);
  });
  it("jamais la première seconde ni la toute fin ; 1,5 s au moins entre deux instants ; repli régulier sans plans", () => {
    const i = instantsMiniature([], 30);
    expect(i).toEqual([9, 16.5, 24]);
    const court = instantsMiniature([{ debutSec: 0, finSec: 4, sourceImage: "double" }], 4);
    expect(court.length).toBe(3);
    for (const t of court) expect(t).toBeGreaterThanOrEqual(1);
    for (const t of court) expect(t).toBeLessThanOrEqual(3.2);
  });
});

/** Mesure approchée de Montserrat Black en capitales (largeur moyenne ≈ 0,78 em ; I et ponctuation plus étroits). */
const mesureApprochee = (texte: string, taille: number) => [...texte].reduce((s, c) => s + (/[IJ.,:;!?'’  ]/.test(c) ? 0.36 : /[MW]/.test(c) ? 1.02 : 0.78), 0) * taille;

describe("R4 · mise en page : grand, lisible, dans la zone sûre", () => {
  const titres = ["Amende : l'erreur", "Licenciement abusif", "Un PV de 135 € ?", "Rupture conventionnelle : vos droits", "Démission"];
  const ratios: RatioMiniature[] = ["9:16", "16:9", "4:5", "1:1"];

  it("même taille d'image côté studio et côté studio-rendu", () => {
    for (const r of ratios) expect(dimensionsMiniature(r)).toEqual({ largeur: formatMiniature(r).largeur, hauteur: formatMiniature(r).hauteur });
  });

  it("vertical : zone sûre 1080 × 1350 au milieu (grille 4:5 et 3:4), titre jamais hors de cette zone", () => {
    const f = formatMiniature("9:16");
    expect(f.zoneSure).toEqual({ x: 0, y: 285, largeur: 1080, hauteur: 1350 });
    for (const t of titres)
      for (const v of VARIANTES_MINIATURE) {
        const c = contraintesTitre(f, v);
        const m = mettreEnPageTitre(unitesCouverture(t), mesureApprochee, c);
        const hauteur = hauteurBlocTitre(m.lignes.length, m.taillePx, c);
        const { haut } = placementTitre(f, v, hauteur);
        expect(haut, `${t} / ${v}`).toBeGreaterThanOrEqual(f.zoneSure.y);
        // Sous le visage : jamais dans les 40 % du haut de la zone du titre.
        expect(haut, `${t} / ${v}`).toBeGreaterThanOrEqual(f.zoneTitre.y + f.zoneTitre.hauteur * 0.4 - 0.5);
        expect(haut + hauteur, `${t} / ${v}`).toBeLessThanOrEqual(f.zoneSure.y + f.zoneSure.hauteur);
        for (const l of m.lignes) expect(mesureApprochee(l.join(" "), m.taillePx) + (c.margeLigne ?? 0), `${t} / ${v}`).toBeLessThanOrEqual(c.largeurMax + 0.5);
      }
  });

  it("lisible sur un téléphone de 390 px : au moins 84 px sur 1080 (≈ 11 px dans une case de grille de 130 px)", () => {
    // Un mot de plus de 12 lettres (« conventionnelle ») limite la taille à lui seul : Will raccourcit le titre s'il veut.
    for (const r of ratios)
      for (const t of titres.filter((x) => Math.max(...x.split(/\s+/).map((m) => m.length)) <= 12)) {
        const f = formatMiniature(r);
        const m = mettreEnPageTitre(unitesCouverture(t), mesureApprochee, contraintesTitre(f, "bas"));
        expect(m.taillePx, `${r} ${t}`).toBeGreaterThanOrEqual(r === "16:9" ? 64 : 84);
        expect(m.lignes.length).toBeLessThanOrEqual(4);
      }
  });

  it("16:9 : le titre reste dans les 60 % de gauche (la durée YouTube est en bas à droite)", () => {
    const f = formatMiniature("16:9");
    expect(f.zoneTitre.x + f.zoneTitre.largeur).toBeLessThanOrEqual(1280 * 0.62);
  });

  it("coupe des lignes : le plus grand possible, sans mot très court laissé seul", () => {
    const m = mettreEnPageTitre(unitesCouverture("Un PV de 135 € ?"), mesureApprochee, contraintesTitre(formatMiniature("9:16"), "bas"));
    expect(m.lignes.some((l) => l.length === 1 && l[0].length <= 3)).toBe(false);
    const seul = mettreEnPageTitre(unitesCouverture("Démission"), mesureApprochee, contraintesTitre(formatMiniature("9:16"), "bas"));
    expect(seul.lignes).toEqual([["DÉMISSION"]]);
    expect(seul.taillePx).toBeGreaterThanOrEqual(130);
  });
});

/* ------------------------------------------------------------------ */
/* Fournisseur studio-rendu (service simulé)                            */
/* ------------------------------------------------------------------ */

function source(n = 3): SourceMiniature {
  return {
    url: "https://r2.exemple/videos/v-1/master.mov?signe",
    dureeSec: 40,
    ratio: "9:16",
    instantsSec: [12, 20, 31].slice(0, n),
    depots: Array.from({ length: n }, (_, i) => ({ cle: `studio/dev/videos/v-1/miniatures/m-${i + 1}.jpg`, urlDepot: `https://r2.exemple/depot/${i + 1}` })),
  };
}

describe("R4 · fournisseur « studio-rendu » des miniatures", () => {
  it("inscrit seulement avec STUDIO_RENDU_URL ; réel, gratuit", () => {
    expect(outilsServeur({})).toEqual({ miniature: {}, etalonnage: {}, son: {} });
    const f = outilsServeur({ STUDIO_RENDU_URL: "http://studio-rendu:4100" }).miniature["studio-rendu"];
    expect(f).toMatchObject({ id: "studio-rendu", type: "miniature", mode: "reel" });
    expect(f.capacites.tarif).toBeUndefined();
    expect(f.capacites.tarifUsd).toBeUndefined();
  });

  it("une demande « miniature » par instant (file courte), dépôts du studio, titre et mot mis en valeur transmis", async () => {
    let t = 0;
    const service = creerServiceRenduSimule(() => t);
    const vus: Parameters<ServiceRendu["soumettre"]>[0][] = [];
    const espion: ServiceRendu = { soumettre: (d) => (vus.push(d), service.soumettre(d)), etat: service.etat };
    const f = creerFournisseurMiniatureStudioRendu({ rendu: () => espion, attendre: async () => void (t += 1_000), maintenant: () => t });
    const r = await f.proposer({ videoId: "v-1", titre: "Un PV de 135 € ?", nombre: 3, source: source(), couverture: { texte: "Un PV de 135 € ?", motCle: "135 €" } });
    expect(r.map((x) => x.fichierCle)).toEqual(source().depots.map((d) => d.cle));
    expect(r.every((x) => x.incrustee && x.titre === "Un PV de 135 € ?")).toBe(true);
    expect(r.map((x) => x.variante)).toEqual([0, 1, 2]);
    expect(vus).toHaveLength(3);
    for (const d of vus) {
      expect(verifierDemande(d)).toBeNull();
      expect(d).toMatchObject({ operation: "miniature", file: "courte", entrees: { video: source().url } });
      expect(d.parametres).toMatchObject({ couverture: "Un PV de 135 € ?", motCle: "135 €", ratio: "9:16", dureeSec: 40 });
    }
    expect(vus.map((d) => d.parametres.instantSec)).toEqual([12, 20, 31]);
  });

  it("texte trop long (titre ou couverture) : 5 mots au plus sur l'image, et c'est CE texte qui est rendu comme titre", async () => {
    let t = 0;
    const service = creerServiceRenduSimule(() => t);
    const vus: Parameters<ServiceRendu["soumettre"]>[0][] = [];
    const espion: ServiceRendu = { soumettre: (d) => (vus.push(d), service.soumettre(d)), etat: service.etat };
    const f = creerFournisseurMiniatureStudioRendu({ rendu: () => espion, attendre: async () => void (t += 1_000), maintenant: () => t });
    for (const appel of [
      { titre: "Votre employeur peut-il vraiment lire tous vos mails privés", couverture: undefined },
      { titre: "T", couverture: { texte: "Votre employeur peut-il vraiment lire tous vos mails privés", motCle: "mails" } },
    ]) {
      vus.length = 0;
      const r = await f.proposer({ videoId: "v-1", nombre: 1, source: source(), ...appel });
      const ecrit = String(vus[0].parametres.couverture);
      expect(ecrit.split(" ").filter((m) => /[\p{L}\p{N}]/u.test(m)).length, ecrit).toBeLessThanOrEqual(5);
      expect(r[0].titre).toBe(ecrit);
    }
  });

  it("panne passagère : soumise à nouveau (nouvel identifiant), au plus deux fois ; refus définitif : absente, jamais remplacée", async () => {
    const echecs = new Map<string, number>();
    let t = 0;
    const etats = new Map<string, EtatRendu>();
    const service: ServiceRendu = {
      async soumettre(d) {
        const base = d.idRendu.replace(/-e\d+$/, "");
        const n = echecs.get(base) ?? 0;
        // m-1 : une panne passagère puis réussite ; m-2 : refus définitif ; m-3 : toujours en panne.
        if (base.endsWith("-1-0")) etats.set(d.idRendu, n === 0 ? { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "délai" } } : { statut: "termine", sortieCle: d.sortie.cle, mesures: { instant: 12.2 } });
        else if (base.endsWith("-2-0")) etats.set(d.idRendu, { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "illisible" } });
        else etats.set(d.idRendu, { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "délai" } });
        echecs.set(base, n + 1);
        return { idRendu: d.idRendu };
      },
      async etat(id) {
        return etats.get(id) ?? { statut: "inconnu" };
      },
    };
    const f = creerFournisseurMiniatureStudioRendu({ rendu: () => service, attendre: async () => void (t += 1_000), maintenant: () => t });
    const r = await f.proposer({ videoId: "v-1", titre: "Titre", nombre: 3, source: source() });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ fichierCle: source().depots[0].cle, instantSec: 12.2 });
    expect([...echecs.entries()].find(([k]) => k.endsWith("-3-0"))?.[1]).toBe(1 + ESSAIS_MINIATURE);
  });

  it("sans source (vidéo simulée) : rien, jamais une image d'essai", async () => {
    const f = creerFournisseurMiniatureStudioRendu({ rendu: () => creerServiceRenduSimule() });
    expect(await f.proposer({ videoId: "v-1", titre: "T", nombre: 3 })).toEqual([]);
  });

  it("attente bornée : un service muet ne bloque pas la boucle au-delà du délai", async () => {
    let t = 0;
    const muet: ServiceRendu = { soumettre: async (d) => ({ idRendu: d.idRendu }), etat: async () => ({ statut: "en_cours", progression: 10 }) };
    const f = creerFournisseurMiniatureStudioRendu({ rendu: () => muet, attendre: async () => void (t += 5_000), maintenant: () => t, delaiMs: 60_000 });
    expect(await f.proposer({ videoId: "v-1", titre: "T", nombre: 3, source: source() })).toEqual([]);
    // Les 3 attentes avancent la même horloge : au plus un tour de plus chacune après le délai.
    expect(t).toBeLessThanOrEqual(60_000 + 3 * 5_000);
  });
});

/* ------------------------------------------------------------------ */
/* Opération `miniature` de studio-rendu                                */
/* ------------------------------------------------------------------ */

describe("R4 · opération « miniature » (règles pures)", () => {
  it("déclarée au contrat de studio-rendu", () => expect(OPERATIONS).toContain("miniature"));
  it("5 images autour de l'instant, dans la vidéo", () => {
    expect(instantsCandidats(10, 40)).toEqual([10, 9.8, 10.2, 9.6, 10.4]);
    expect(instantsCandidats(0, 40)).toEqual([0.1, 0.2, 0.4]);
    expect(Math.max(...instantsCandidats(39.9, 40))).toBeLessThanOrEqual(39.85);
  });
  it("la plus nette, sauf une image noire ; à netteté égale, la plus proche de l'instant visé", () => {
    expect(choisirPlusNette([{ instantSec: 10, flou: 6 }, { instantSec: 10.2, flou: 3 }, { instantSec: 9.8, flou: 4 }], 10).instantSec).toBe(10.2);
    expect(choisirPlusNette([{ instantSec: 10, flou: 6, luminosite: 90 }, { instantSec: 10.2, flou: 1, luminosite: 4 }], 10).instantSec).toBe(10);
    expect(choisirPlusNette([{ instantSec: 9.6, flou: 3.0 }, { instantSec: 10, flou: 3.03 }], 10).instantSec).toBe(10);
  });
});

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!ffmpegPresent)("R4 · opération « miniature » : vrai passage FFmpeg", { timeout: 90_000 }, () => {
  let serveur: Server;
  let base = "";
  const recus = new Map<string, Buffer>();
  const dossier = mkdtempSync(join(tmpdir(), "r4-miniature-"));
  const video = join(dossier, "video.mp4");

  beforeAll(async () => {
    // 4 s, 360 × 640 : tout est flou SAUF autour de 2,2 s (la seule image nette des 5 examinées autour de 2,0 s).
    const r = spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=25:duration=4", "-vf", "boxblur=8:2:enable='not(between(t,2.15,2.25))'", "-c:v", "libx264", "-g", "1", "-pix_fmt", "yuv420p", video]);
    expect(r.status).toBe(0);
    serveur = createServer((req, res) => {
      if (req.method === "GET" || req.method === "HEAD") {
        const contenu = readFileSync(video);
        const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
        if (plage) {
          const debut = plage[1] ? Number(plage[1]) : 0;
          const fin = plage[2] ? Math.min(contenu.length - 1, Number(plage[2])) : contenu.length - 1;
          res.writeHead(206, { "content-type": "video/mp4", "content-length": fin - debut + 1, "content-range": `bytes ${debut}-${fin}/${contenu.length}`, "accept-ranges": "bytes" });
          res.end(req.method === "HEAD" ? undefined : contenu.subarray(debut, fin + 1));
          return;
        }
        res.writeHead(200, { "content-type": "video/mp4", "content-length": contenu.length, "accept-ranges": "bytes" });
        res.end(req.method === "HEAD" ? undefined : contenu);
        return;
      }
      const morceaux: Buffer[] = [];
      req.on("data", (c: Buffer) => morceaux.push(c));
      req.on("end", () => {
        recus.set(req.url ?? "", Buffer.concat(morceaux));
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });
  afterAll(() => serveur.close());

  it("la plus nette des 5 images est retenue, mise à 1080 × 1920, titre posé, JPEG ≤ 2 Mo déposé", async () => {
    const travail = join(dossier, "travail");
    mkdirSync(travail, { recursive: true });
    const recuParLeRendu: unknown[] = [];
    // Le navigateur de Remotion n'est pas ouvert ici : le rendu d'essai recopie le fond et note les propriétés.
    const op = creerOperationMiniature(async (proprietes, sortiePng) => {
      recuParLeRendu.push(proprietes);
      const fond = readFileSync(join(travail, "fond.png"));
      writeFileSync(sortiePng, fond);
    });
    const r = await op(
      { idRendu: "mini-1", operation: "miniature", file: "courte", entrees: { video: `${base}/video.mp4` }, sortie: { urlDepot: `${base}/depot/mini.jpg`, cle: "x" }, parametres: { instantSec: 2.0, dureeSec: 4, ratio: "9:16", couverture: "Un PV de 135 € ?", motCle: "135 €", variante: 1 } },
      { progression: () => undefined, dossier: travail, signal: new AbortController().signal },
    );
    expect(r.mesures?.instant).toBe(2.2);
    expect(r.mesures).toMatchObject({ largeur: 1080, hauteur: 1920, candidats: 5 });
    expect(recuParLeRendu).toEqual([expect.objectContaining({ ratio: "9:16", couverture: "Un PV de 135 € ?", motCle: "135 €", variante: "etiquettes", image: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/fond\.png$/) })]);
    const jpeg = recus.get("/depot/mini.jpg")!;
    expect(jpeg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(jpeg.length).toBeLessThanOrEqual(OCTETS_MAX_MINIATURE);
    const sonde = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", "-"], { input: jpeg });
    expect(sonde.stdout.toString().trim()).toBe("1080,1920");
  });
});
