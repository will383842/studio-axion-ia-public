/**
 * PLAN FACECAM v4 — LOT A « Fondations » (tests gardés : contrat `testerMoteurVideo` avec facecam, plafond atteint, non
 * régression de l'avocat). Format facecam masqué, Selfie masqué, moteur squelette, `sansPrix`, 15 Go par prise,
 * `entrees.facecam` (clés seulement), `EtatFacecam`, client studio-aligneur et son double de simulation.
 * Fournisseurs simulés, AUCUN appel réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const envois = await import("@/services/envois");
const { testerMoteurVideo } = await import("@/moteurs/contrat");
const { deciderJeLis, obtenirMoteur, moteurPrisesFilmees } = await import("@/moteurs");
const { creerMoteurMontageFacecam, moteurMontageFacecam, versionSelonPlafond } = await import("@/moteurs/montage-facecam");
const formats = await import("@/formats");
const { recetteFaceCamera } = await import("@/formats/familles/face-camera");
const { codeDuFormat } = await import("@/formats/registre-codes");
const facecam = await import("@/domaine/facecam");
const { creerFacecamHttp, creerFacecamSimule, fournisseurFacecam, ROUTES_FACECAM } = await import("@/fournisseurs/facecam");

import type { CommandeFabrication, SessionTournage, Travail, VarianteReseau } from "@/domaine/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP = "essai-facecam-lot-a";
const T0 = Date.UTC(2026, 9, 9, 9, 0, 0);
const GO = 1024 * 1024 * 1024;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Une commande du format facecam (texte de démonstration, une prise filmée). */
async function commandeFacecam(): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return { ...c, formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"] };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

/* ---------------- Contrat partagé (test gardé n° 1) ---------------- */
testerMoteurVideo(moteurMontageFacecam, commandeFacecam, { sansPrix: true });

describe("facecam · format (lot A)", () => {
  it("inscrit, code FC, actif, famille face-camera, 9:16, express → fabrication, moteur montage-facecam, sans prix", () => {
    const f = formats.obtenirFormat("facecam");
    expect(codeDuFormat("facecam")).toBe("FC");
    expect(f.codeClassement).toBe("FC");
    expect(f.statut).toBe("actif");
    expect(f.famille).toBe("face-camera");
    expect(f.ratios).toEqual(["9:16"]);
    expect(f.etapes).toEqual(["express", "fabrication"]);
    expect(f.moteur).toBe("montage-facecam");
    expect(f.declinaison).toBe("aucune");
    expect(f.sansPrix).toBe(true);
    expect(formats.listerFormats().map((x) => x.id)).toContain("facecam");
    expect(formats.formatGenerateur("facecam").recette.modeParDefaut).toBe("teleprompteur");
  });

  it("la famille face-camera n'est pas modifiée (l'avocat en hérite) ; Selfie masqué, Créateur B inchangé", () => {
    expect(recetteFaceCamera).toEqual({ famille: "face-camera", modesDiction: ["avatar", "teleprompteur", "trame"], declinaison: "ouverture-fin" });
    expect(formats.obtenirFormat("selfie").statut).toBe("masque");
    expect(formats.obtenirFormat("createur-b").statut).toBe("bientot");
    const avocat = formats.obtenirFormat("avocat");
    expect(avocat.sansPrix).toBeUndefined();
    expect(avocat.tailleMaxEnvoiOctets).toBeUndefined();
    expect(avocat.moteur).toBe("simulation");
  });

  it("accord de prix : d'office pour facecam, celui de Will tel quel pour l'avocat", () => {
    expect(formats.formatSansPrix("facecam")).toBe(true);
    expect(formats.formatSansPrix("avocat")).toBe(false);
    expect(formats.accordDuFormat("facecam", undefined)).toBe(true);
    expect(formats.accordDuFormat("avocat", undefined)).toBeUndefined();
    expect(formats.accordDuFormat("avocat", 120)).toBe(120);
  });
});

describe("facecam · moteur (lot A)", () => {
  it("inscrit ; « je lis » de l'avocat inchangé ; facecam désigné par son seul format", () => {
    expect(obtenirMoteur("montage-facecam").id).toBe("montage-facecam");
    expect(moteurPrisesFilmees("facecam")).toBeNull();
    expect(moteurPrisesFilmees("avocat")).toBe("montage-avocat");
    const ctx = { allume: true, montageRelie: true, stockageRelie: true };
    expect(deciderJeLis("facecam", null, ctx)).toEqual({ moteurId: "montage-facecam", effectif: false, manque: null });
    expect(deciderJeLis("avocat", null, ctx).moteurId).toBe("montage-avocat");
    expect(deciderJeLis("avocat", null, { ...ctx, allume: false }).moteurId).toBe("simulation");
  });

  it("estimer() rend 0, et le lancement réel est refusé tant que le montage n'est pas prêt", async () => {
    const c = await commandeFacecam();
    expect((await moteurMontageFacecam.estimer(c)).total.centimes).toBe(0);
    expect(moteurMontageFacecam.refusAuLancement?.(c)?.code).toBe("FACECAM_EN_CHANTIER");
  });

  it("étapes parlantes : le son, les coupes, l'image, les sous-titres et cartes", async () => {
    const noms = moteurMontageFacecam.etapes(await commandeFacecam()).map((e) => e.nom);
    for (const n of ["Le son", "Les coupes", "L'image", "Les sous-titres et cartes"]) expect(noms).toContain(n);
  });
});

/* ---------------- Plafond atteint (test gardé n° 6) ---------------- */
describe("facecam · plafond du mois atteint : aucun appel Claude, la vidéo sort quand même", () => {
  it("plafond atteint : version simple, sans relecture, sorties produites, mention « relever ? »", async () => {
    const relire = vi.fn(async () => undefined);
    const moteur = creerMoteurMontageFacecam({ relire });
    const c = { ...(await commandeFacecam()), plafondClaudeAtteint: true };
    expect(versionSelonPlafond(c)).toBe("simple");
    expect(moteur.etapes(c).map((e) => e.cle)).not.toContain("relecture");
    const fin = await jusquAuBout(moteur, c, await moteur.lancer(c, { travailId: "t-plafond", versionId: "ver-plafond", titre: "Essai", maintenant: T0 }));
    expect(fin.travail.statut).toBe("termine");
    expect(fin.resultat!.sorties.map((s) => s.ratio)).toEqual(["9:16"]);
    expect(fin.resultat!.noteQualite.alertes.map((a) => a.message)).toContain(facecam.MENTION_PLAFOND_FACECAM);
    expect(relire).not.toHaveBeenCalled();
  });

  it("sous le plafond : la relecture Claude a lieu une fois, sans mention", async () => {
    const relire = vi.fn(async () => undefined);
    const moteur = creerMoteurMontageFacecam({ relire });
    const c = await commandeFacecam();
    const fin = await jusquAuBout(moteur, c, await moteur.lancer(c, { travailId: "t-sous", versionId: "ver-sous", titre: "Essai", maintenant: T0 }));
    expect(fin.travail.statut).toBe("termine");
    expect(relire).toHaveBeenCalledTimes(1);
    expect(fin.resultat!.noteQualite.alertes).toEqual([]);
  });
});

describe("facecam · envoi de 15 Go (l'avocat garde 4 Go)", () => {
  async function seanceDe(formatId: string): Promise<string> {
    const d = depots();
    await d.variantes.enregistrer({ id: `var-${formatId}`, formatId } as unknown as VarianteReseau);
    const s = { id: `seance-${formatId}`, varianteIds: [`var-${formatId}`], prises: [], etat: "preparee", creeLe: "2026-10-09T09:00:00.000Z", modifieLe: "2026-10-09T09:00:00.000Z" } as unknown as SessionTournage;
    await d.sessionsTournage.enregistrer(s);
    return s.id;
  }
  const prise = (entiteId: string, taille: number) => ({ nom: "IMG_7747.MOV", mime: "video/quicktime", taille, typeEntite: "rush", entiteId });

  it("une prise facecam de 10 Go passe ; plus de 15 Go est refusée", async () => {
    const id = await seanceDe("facecam");
    await expect(envois.commencerEnvoi(prise(id, 10 * GO))).resolves.toMatchObject({ fichierId: expect.any(String) });
    await expect(envois.commencerEnvoi(prise(id, 16 * GO))).rejects.toMatchObject({ code: "TAILLE_INVALIDE", message: "Ce fichier dépasse 15 Go." });
  });

  it("une prise avocat garde la limite de 4 Go, avec le même message", async () => {
    const id = await seanceDe("avocat");
    await expect(envois.commencerEnvoi(prise(id, 5 * GO))).rejects.toMatchObject({ code: "TAILLE_INVALIDE", message: "Ce fichier dépasse 4 Go." });
    await expect(envois.commencerEnvoi({ ...prise("vis-1", 5 * GO), typeEntite: "visage" })).rejects.toMatchObject({ code: "TAILLE_INVALIDE" });
    expect(formats.tailleMaxEnvoi(["avocat", undefined])).toBe(4 * GO);
    expect(formats.tailleMaxEnvoi(["avocat", "facecam"])).toBe(15 * GO);
  });
});

describe("facecam · entrees.facecam (clés R2 seulement) et EtatFacecam", () => {
  it("lecture sans jamais lever : valeurs par défaut, clé trop longue écartée", () => {
    expect(facecam.lireEntreesFacecam(undefined)).toEqual(facecam.entreesFacecamVides());
    const lu = facecam.lireEntreesFacecam({ facecam: { transcriptionCle: "studio/prod/facecam/t.json.gz", pisteVisageCle: "x".repeat(5000), image: { lumiere: "plus", dents: 12 }, coupes: { auto: [], retablies: ["c1", 3] } } });
    expect(lu.transcriptionCle).toBe("studio/prod/facecam/t.json.gz");
    expect(lu.pisteVisageCle).toBeUndefined();
    expect(lu.image).toEqual({ lumiere: "plus", couleurs: "juste", mine: "juste", dents: "juste" });
    expect(lu.coupes.retablies).toEqual(["c1"]);
  });

  it("chaque état a un libellé français ; le montage parle en 4 étapes", () => {
    const etats = Object.values(facecam.EtatFacecam);
    expect(etats).toHaveLength(12);
    for (const e of etats) expect(facecam.LIBELLES_ETAT_FACECAM[e].libelle.length).toBeGreaterThan(3);
    expect(facecam.LIBELLES_ETAT_FACECAM[facecam.EtatFacecam.FichierReduitIos].libelle).toContain("app Fichiers");
    expect(facecam.libelleMontageFacecam(2)).toBe("Montage · L'image (3 sur 4)");
  });
});

describe("facecam · client studio-aligneur et double de simulation", () => {
  it("par défaut : le double de simulation (même avec l'adresse du conteneur)", () => {
    expect(fournisseurFacecam({}, {}).mode).toBe("simulation");
    expect(fournisseurFacecam({}, { STUDIO_ALIGNEUR_URL: "http://aligneur:4200" }).mode).toBe("simulation");
    expect(fournisseurFacecam({ reel: true }, {}).mode).toBe("simulation");
    expect(fournisseurFacecam({ reel: true }, { STUDIO_ALIGNEUR_URL: "http://aligneur:4200" }).mode).toBe("reel");
  });

  it("double : terminé au suivi, clés stables ; une panne simulée reste un échec typé", async () => {
    const f = creerFacecamSimule({ routesEnPanne: ["segmenter"] });
    for (const r of ROUTES_FACECAM) await f.soumettre(r, { idTravail: "t1", source: "https://r2/x", parametres: { texte: "Un bon PV" } });
    const t = await f.suivre("transcrire", "t1");
    expect(t.statut === "termine" && t.resultat.mots?.map((m) => m.mot)).toEqual(["Un", "bon", "PV"]);
    expect((await f.suivre("segmenter", "t1")).statut).toBe("echec");
    expect((await f.suivre("visages", "inconnu")).statut).toBe("echec");
  });

  it("HTTP : même clé, 501 « non-implemente » rendu en échec non réessayable, jamais d'exception", async () => {
    const appels: { url: string; cle?: string }[] = [];
    const faux = (async (url: string, init?: RequestInit) => {
      appels.push({ url, cle: (init?.headers as Record<string, string>)["x-studio-rendu-cle"] });
      if (url.endsWith("/panne")) throw new Error("réseau");
      return new Response(JSON.stringify({ statut: "echec", erreur: { code: "non-implemente", reessayable: false, message: "La route /visages n'est pas encore disponible." } }), { status: 501 });
    }) as typeof fetch;
    const f = creerFacecamHttp("http://aligneur:4200/", { fetch: faux, cle: "secret" });
    const e = await f.soumettre("visages", { idTravail: "t1", source: "https://r2/x" });
    expect(e).toEqual({ statut: "echec", erreur: { code: "non-implemente", reessayable: false, message: "La route /visages n'est pas encore disponible." } });
    expect(appels[0]).toEqual({ url: "http://aligneur:4200/visages", cle: "secret" });
    expect((await f.suivre("visages", "panne")).statut).toBe("echec");
  });
});
