/**
 * G6 · le moteur avocat ORCHESTRE la brique « déclinaison » (co-signature du 03/10) : la mère pose une coupe à chaque
 * frontière ; une version par réseau ne fait lire QUE son début et sa fin (texte dit transmis, liste de prononciations
 * vide), reprend le corps de la mère sur des coupes (aucune variante ne refait le corps), coûte moins de 1 € ; les
 * sous-titres viennent du texte AFFICHÉ et restent hors de toutes les zones ; l'encadré et l'incrustation d'appel
 * suivent SON réseau. Voix, visage et rendu SIMULÉS (aucun appel HeyGen, fal.ai ni Claude).
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat, empreinteAudioMaitre } = await import("@/moteurs/montage-avocat");
const { parametresComposition } = await import("@/moteurs/montage-avocat/composition");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { zonesProtegeesUnion } = await import("@/briques/declinaison");
const { zoneDe } = await import("@/briques/sous-titres/largeur");
const { dureeVideo, obtenirFormat } = await import("@/formats");

import type { BlocScript, CommandeFabrication, IdReseau, MereVariante, Travail } from "@/domaine/types";
import type { DemandeLecture, FournisseurVoix } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP = "essai-g6-moteur";
const T0 = Date.UTC(2026, 9, 3, 9, 0, 0);
const RESEAUX: IdReseau[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

function voixEspion() {
  const lectures: DemandeLecture[] = [];
  const voix: FournisseurVoix = { ...fournisseurVoixSimulation, lire: async (d) => (lectures.push(d), fournisseurVoixSimulation.lire(d)) };
  return { lectures, voix: () => voix };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine") return { travail, resultat: resultat! };
    if (travail.statut === "echec") throw new Error(JSON.stringify(travail.erreur));
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

const bloc = (id: string, blocRecette: string, segments: BlocScript["segments"]): BlocScript => ({ id, blocRecette, segments });

/** Le corps commun (identifiants partagés par toutes les versions), dont un segment facultatif LinkedIn. */
const CORPS: BlocScript[] = [
  bloc("bc", "coeur", [
    { id: "c1", texte: "Une DAF de PME de quarante salariés passait douze heures par semaine sur ses relances." },
    { id: "c2", texte: "Nous avons branché un outil qui lit chaque facture et relance seul, le vendredi soir." },
    { id: "f1", texte: "Sur LinkedIn, ce détail compte : l'outil garde la trace de chaque échange avec le client.", facultatif: "linkedin" },
  ]),
  bloc("bp", "preuve", [{ id: "c3", texte: "Résultat : deux heures par semaine, et plus aucun PV de retard oublié." }]),
];

/** Commande d'une version : son ouverture, le corps, sa fin ; texte dit (PV → pé vé), liste vide. */
async function commandeVersion(o: { ouverture: BlocScript[]; fin: BlocScript[]; avecFacultatif: boolean; variante?: CommandeFabrication["variante"] }): Promise<CommandeFabrication> {
  const c0 = await fabrication.construireCommande("v-03");
  const corps = o.avecFacultatif ? CORPS : CORPS.map((b) => ({ ...b, segments: b.segments.filter((s) => !s.facultatif) }));
  const blocs = [...o.ouverture, ...corps, ...o.fin];
  const segments = blocs.flatMap((b) => b.segments);
  const texteComplet = segments.map((s) => s.texte).join(" ");
  return {
    ...c0,
    dureeCibleSec: dureeVideo(obtenirFormat("avocat"), texteComplet, c0.dureeCibleSec),
    script: { blocs, texteComplet },
    plans: [],
    prononciations: [],
    texteDitParSegment: segments.map((s) => s.texte.replace(/\bPV\b/g, "pé vé").replace(/\bDAF\b/g, "daf").replace(/\bPME\b/g, "pé emme heu")),
    reseaux: RESEAUX,
    zonesProtegees: zonesProtegeesUnion(RESEAUX)!,
    encadreTexte: "Douze heures de relances",
    partiesDeclinaison: { ouverture: o.ouverture.flatMap((b) => b.segments.map((s) => s.id)), fin: o.fin.flatMap((b) => b.segments.map((s) => s.id)), facultatifs: o.avecFacultatif ? ["f1"] : [] },
    briques: { ...c0.briques, illustrations: false },
    ...(o.variante ? { variante: o.variante } : {}),
  };
}

const OUVERTURE_MERE = [bloc("om", "accroche", [{ id: "om1", texte: "Vous relancez encore vos factures à la main, chaque vendredi soir ?" }])];
const FIN_MERE = [bloc("fm", "appel", [{ id: "fm1", texte: "Écrivez-nous pour un diagnostic gratuit." }])];
const OUVERTURE_TT = [bloc("ot", "accroche", [{ id: "ot1", texte: "Douze heures par semaine, rien que pour des relances ?" }])];
const FIN_TT = [bloc("ft", "appel", [{ id: "at1", texte: "Envoyez ça à votre DAF.", incrustation: { type: "objet", elementId: "incrustation-appel-logo" } }]), bloc("fb", "boucle", [{ id: "bt1", texte: "Douze heures, vraiment ?" }])];

async function fabriquerMere() {
  const espion = voixEspion();
  const m = creerMoteurMontageAvocat({ voix: espion.voix });
  const c = await commandeVersion({ ouverture: OUVERTURE_MERE, fin: FIN_MERE, avecFacultatif: true });
  const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-mere", versionId: "ver-mere", titre: "Mère", maintenant: T0 }));
  const mere = m.mereDeclinaison!(resultat.projetMontage, { videoId: "video-mere", versionId: "ver-mere" })!;
  return { m, c, resultat, mere, espion };
}

describe("G6 · la mère", () => {
  it("une coupe à chaque frontière (ouverture | corps | facultatif | corps | fin) ; la voix lit le texte DIT tel quel", async () => {
    const { c, resultat, mere, espion } = await fabriquerMere();
    expect(mere).not.toBeNull();
    expect(espion.lectures).toHaveLength(1);
    // Une seule application des prononciations : la voix reçoit le texte dit, sans liste à réappliquer.
    expect(espion.lectures[0].prononciations).toEqual([]);
    expect(espion.lectures[0].texte).toContain("pé vé");
    expect(espion.lectures[0].texte).not.toMatch(/\bPV\b/);
    const bornes = resultat.plans!.slice(1).map((p) => p.debutSec);
    const temps = new Map(mere.segments.map((s) => [s.segmentId, s]));
    for (const [a, b] of [["om1", "c1"], ["c2", "f1"], ["f1", "c3"], ["c3", "fm1"]]) {
      const t = (temps.get(a)!.finSec + temps.get(b)!.debutSec) / 2;
      expect(bornes.some((x) => Math.abs(x - t) < 0.002), `coupe entre ${a} et ${b}`).toBe(true);
    }
    // Sous-titres tirés du texte AFFICHÉ : « PV », jamais la forme phonétique.
    const mots = (resultat.sousTitres ?? []).flatMap((s) => s.mots.map((m) => m.mot)).join(" ");
    expect(mots).toMatch(/\bPV\b/);
    expect(mots).not.toMatch(/pé vé|pé emme/);
    // Empreinte stable : même commande → même empreinte ; elle porte sur le texte dit.
    expect(empreinteAudioMaitre(c)).toBe(empreinteAudioMaitre({ ...c }));
    expect(empreinteAudioMaitre(c)).not.toBe(empreinteAudioMaitre({ ...c, texteDitParSegment: undefined }));
  });
});

describe("G6 · une version par réseau sur la mère", () => {
  async function versionTikTok(mere: MereVariante) {
    return commandeVersion({
      ouverture: OUVERTURE_TT,
      fin: FIN_TT,
      avecFacultatif: false,
      variante: { id: "var-tt", code: "0042-AV-TT", reseau: "tiktok", videoMereId: "video-mere", tranches: { debutRemplaceSec: 0, finRemplaceSec: 0 }, segmentsRefaits: ["ot1", "at1", "bt1"], mere, typeDerive: "variante-reseau" },
    });
  }

  it("seuls le début et la fin sont lus ; le corps (segment facultatif retiré) est repris de la mère sur des coupes", async () => {
    const { mere, resultat: rMere } = await fabriquerMere();
    const espion = voixEspion();
    const m = creerMoteurMontageAvocat({ voix: espion.voix });
    const c = await versionTikTok(mere);
    const t = await m.lancer(c, { travailId: "t-tt", versionId: "ver-tt", titre: "TikTok", maintenant: T0 });
    expect(t.etapes.find((e) => e.cle === "voix")?.nom).toBe("Votre voix · début et fin");
    const { resultat } = await jusquAuBout(m, c, t);
    expect(espion.lectures).toHaveLength(1);
    expect(espion.lectures[0].texte).toContain("Douze heures par semaine");
    expect(espion.lectures[0].texte).toContain("Envoyez ça à votre daf");
    expect(espion.lectures[0].texte).not.toContain("relance seul");
    expect(espion.lectures[0].prononciations).toEqual([]);
    const projet = resultat.projetMontage as { assemblage?: { morceaux: { entree: string; deSec: number; aSec: number }[]; jointures: { visible: boolean }[] } };
    expect(projet.assemblage?.morceaux.map((x) => x.entree)).toEqual(["partiel", "mere", "mere", "partiel"]);
    expect(projet.assemblage?.jointures.every((j) => !j.visible)).toBe(true);
    // Chaque morceau de la mère commence et finit sur une coupe de la mère.
    const coupesMere = new Set(mere.plans.map((p) => p.debutSec).concat(mere.plans.at(-1)!.finSec).map((x) => x.toFixed(3)));
    for (const x of projet.assemblage!.morceaux.filter((y) => y.entree === "mere")) {
      expect(coupesMere.has(x.deSec.toFixed(3))).toBe(true);
      expect(coupesMere.has(x.aSec.toFixed(3))).toBe(true);
    }
    // Aucune variante ne refait le corps : ses plans sont ceux de la mère (mêmes durées, mêmes cadrages).
    const corpsMere = rMere.plans!.filter((p) => ["c1", "c2", "c3"].includes(p.segmentId));
    const corpsVersion = resultat.plans!.filter((p) => ["c1", "c2", "c3"].includes(p.segmentId));
    expect(corpsVersion.map((p) => [+(p.finSec - p.debutSec).toFixed(2), p.cadrage.zoom])).toEqual(corpsMere.map((p) => [+(p.finSec - p.debutSec).toFixed(2), p.cadrage.zoom]));
    expect(resultat.plans!.some((p) => p.segmentId === "f1")).toBe(false);
    // Sous-titres : texte affiché du début neuf, du corps repris et de la fin neuve.
    const mots = (resultat.sousTitres ?? []).flatMap((s) => s.mots.map((x) => x.mot)).join(" ");
    expect(mots).toContain("DAF");
    expect(mots).toMatch(/\bPV\b/);
    expect(mots).not.toContain("LinkedIn");
  });

  it("coût d'une version ≤ 1 € (début et fin seulement), la mère ≈ 3 à 4 € ; aucun appel payant en simulation", async () => {
    const { m, c: cMere, mere } = await fabriquerMere();
    const cTT = await versionTikTok(mere);
    const eMere = await m.estimer(cMere);
    const eTT = await m.estimer(cTT);
    expect(eTT.total.centimes).toBeLessThanOrEqual(100);
    expect(eTT.total.centimes).toBeGreaterThan(0);
    expect(eMere.total.centimes).toBeGreaterThan(3 * eTT.total.centimes);
    expect(eTT.lignes.find((l) => l.etape === "Voix")!.quantite).toBeLessThan(eMere.lignes.find((l) => l.etape === "Voix")!.quantite / 2);
  });

  it("sous-titres hors de TOUTES les zones ; encadré et incrustation d'appel dans la zone de SON réseau", async () => {
    const { mere } = await fabriquerMere();
    const c = { ...(await versionTikTok(mere)), medias: { "incrustation-appel-logo": { cle: "logo.png", mime: "image/png" } } };
    const m = creerMoteurMontageAvocat({ voix: voixEspion().voix });
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-tt2", versionId: "ver-tt2", titre: "TikTok", maintenant: T0 }));
    const p = parametresComposition(c, { ratio: "9:16", plans: resultat.plans!, segments: resultat.sousTitres ?? [], dureeSec: resultat.plans!.at(-1)!.finSec });
    const union = zoneDe("9:16", RESEAUX);
    expect(p.texte.sousTitres!.positions.hautPct).toBeGreaterThanOrEqual(union.haut);
    expect(p.texte.sousTitres!.positions.basPct).toBeLessThanOrEqual(100 - union.bas);
    for (const r of RESEAUX) {
      const z = zoneDe("9:16", [r]);
      expect(p.texte.sousTitres!.positions.basPct).toBeLessThanOrEqual(100 - z.bas);
    }
    expect(p.texte.encadre?.lignes.join(" ")).toMatch(/DOUZE HEURES/);
    const appel = p.texte.incrustations.find((i) => i.type === "objet");
    expect(appel).toBeTruthy();
    const tt = zoneDe("9:16", ["tiktok"]);
    expect(appel!.centreYPx).toBeLessThan(((100 - tt.bas) / 100) * 1920);
    expect(p.alertes.filter((a) => a.code === "zone-protegee")).toEqual([]);
  });
});
