/**
 * FACE CAMÉRA ANIMÉE v4 — LOT I « brancher le générateur dans le studio ».
 *  - réalisateur avec un FAUX client Claude (plan valide ; plan refusé puis corrigé ; panne → plan v4 minimal) ;
 *  - plan v4 minimal (repli sans Claude) : 0 erreur sur la vraie prise, jamais de mot interdit ;
 *  - chaîne de production pure (transcription → coupes → réalisateur → rendu) et moteur (refus au lancement, avancement, résultat) ;
 *  - format visible seulement pour Will (masqué, aucun menu, accord d'essai) ;
 *  - service de rendu (opération `facecam-v4`) : paramètres, filtre de montage, médias servis ; plaquettes sans `staticFile` direct.
 * AUCUN appel réseau.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import { listerFormats, obtenirFormat } from "@/formats";
import { NAV_LATERALE, ONGLETS_BAS, TUILES_PLUS } from "@/components/coquille/navigation";
import { creerMoteurMontageFacecamAnimee, lireEntreesFacecamAnimee, resultatV4 } from "@/moteurs/montage-facecam-animee";
import { avancerChaineV4, couperPriseV4, EnCoursChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import {
  assemblerPlan,
  PHRASE_REALISATEUR_PANNE,
  PHRASE_REALISATEUR_REFUSE,
  planMinimalV4,
  realiser,
  verifierPlan,
  type EntreeRealisateur,
  type MotTranscrit,
  type ReponseRealisateur,
  type RequeteRealisateur,
} from "@/moteurs/montage-facecam-animee/realisateur";
import { motsInterditsDans } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { roleRealisateurV4 } from "@/moteurs/montage-facecam-animee/realisateur/role-v4";
import { filtreMontageV4, lireParametresFacecamV4, PRISE_MONTEE_V4, sourcesMediasV4 } from "../../studio-rendu/src/operations/facecam-v4";


const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const MOTS = TRANS.motsMontesTexteValide;
const DUREE = TRANS.dureeMonteeSec;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE_PRISE = 130.732;

/** La réponse de Claude qui a donné le plan validé par Will : ses plaquettes et ses mots forts (relus dans les sous-titres). */
function reponseValide() {
  const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
  return { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_VALIDE.elementsV4, motsForts };
}
const ENTREE: EntreeRealisateur = { mots: MOTS, dureeSec: DUREE, prise: { src: PRISE_MONTEE_V4, finSec: DUREE }, fin: { debut: DUREE, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };

function fauxClaude(reponses: ReponseRealisateur[]) {
  const requetes: RequeteRealisateur[] = [];
  const appeler = vi.fn(async (r: RequeteRealisateur) => {
    requetes.push(r);
    return reponses[Math.min(requetes.length - 1, reponses.length - 1)];
  });
  return { appeler, requetes };
}
const texteAffiche = (els: readonly ElementV4Plan[]) => els.flatMap((e) => [...(e.mots ?? []), ...(e.lignes ?? []).map((l) => l.texte)]).join(" | ");

describe("Lot I · réalisateur avec un faux client Claude", () => {
  it("plan de la répétition (5 plaquettes au-dessus de leur plafond, D14 seul) → Opus recommence une fois, puis son plan est GARDÉ (version complète, avertissement visible)", async () => {
    const { appeler, requetes } = fauxClaude([{ ok: true, donnees: reponseValide() }]);
    const r = await realiser(ENTREE, { appeler });
    expect(r.erreurs).toBeUndefined();
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(2); // dès le 2ᵉ essai : une vidéo ordinaire ne paie pas 3 appels
    expect(requetes[1].message).toContain("D14 — ");
    expect(r.phrase).toBe("Mise en scène gardée : 5 plaquettes dépassent leur plafond de variété (D14/D2a).");
    expect(r.avertissements.filter((a) => a.startsWith("Plan gardé malgré : D14 — ")).length).toBe(5);
    expect(r.rendable).toBe(true);
    expect(r.plan.elementsV4).toEqual(PLAN_VALIDE.elementsV4);
    expect(r.plan.groupes).toEqual(PLAN_VALIDE.groupes);
    expect(r.plan.sons).toEqual([]);
    expect(r.plan.fps).toBe(30);
    expect(requetes[0].systeme).toContain("Tu es le RÉALISATEUR");
  });

  it("plan refusé (Certifexemple affiché) puis corrigé → l'erreur V8a exacte renvoyée à Claude (le plan corrigé garde ses D14 : 2 essais, plan gardé)", async () => {
    const refuse = reponseValide();
    refuse.elementsV4 = refuse.elementsV4!.map((e, k) => (k === 0 ? { ...e, mots: ["CERTIFEXEMPLE"] } : e));
    const { appeler, requetes } = fauxClaude([{ ok: true, donnees: refuse }, { ok: true, donnees: reponseValide() }]);
    const r = await realiser(ENTREE, { appeler });
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(2);
    expect(requetes[1].message).toContain("<erreurs_essai_precedent>");
    expect(requetes[1].message).toMatch(/V8a — .*certifexemple/i);
    expect(texteAffiche(r.plan.elementsV4!)).not.toMatch(/certifexemple/i);
  });

  it("Claude en panne → version simple = plan v4 MINIMAL rendable (plus l'ancien catalogue)", async () => {
    const { appeler } = fauxClaude([{ ok: false, message: "crédit épuisé" }]);
    const r = await realiser(ENTREE, { appeler });
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(r.version).toBe("simple");
    expect(r.phrase).toBe(PHRASE_REALISATEUR_PANNE);
    expect(r.rendable).toBe(true);
    expect(r.plan.elementsV4?.length).toBeGreaterThan(20);
    expect(r.plan.cartes).toEqual([]);
    expect(r.plan.fenetres).toEqual([]);
    expect(r.plan.motions ?? []).toEqual([]);
    expect(r.plan.fps).toBe(30);
  });

  it("3 plans refusés → plan v4 minimal, phrase claire pour Will", async () => {
    const { appeler } = fauxClaude([{ ok: true, donnees: { elementsV4: "rien" } }]);
    const r = await realiser(ENTREE, { appeler });
    expect(r.essais).toBe(3);
    expect(r.version).toBe("simple");
    expect(r.phrase).toBe(PHRASE_REALISATEUR_REFUSE);
    expect(r.rendable).toBe(true);
    expect(r.plan.elementsV4?.length).toBeGreaterThan(20);
  });

  it("le rôle Claude : Opus, consigne v4, forme de la réponse donnée en JSON, aucune validation propre (realiser juge)", () => {
    const role = roleRealisateurV4();
    expect(role.modele).toBe("claude-opus-5-5");
    expect(role.consigne).toContain("Tu es le RÉALISATEUR");
    expect(role.envoi).toBeDefined();
    expect(role.schema?.safeParse({ nimporte: "quoi" }).success).toBe(true);
  });
});

describe("Lot I · plan v4 minimal (repli sans Claude)", () => {
  it("sur la vraie prise montée : 0 erreur de verifierPlan, aucun mot interdit, emplacements jamais deux fois de suite", () => {
    const el = planMinimalV4({ mots: MOTS, horizon: DUREE });
    const plan = assemblerPlan(ENTREE, { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: el });
    const v = verifierPlan(plan, MOTS);
    expect(v.erreurs).toEqual([]);
    expect(v.rendable).toBe(true);
    expect(el[0].debut).toBe(0);
    expect(el[el.length - 1].fin).toBe(DUREE);
    for (let k = 1; k < el.length; k++) expect(el[k].debut).toBe(el[k - 1].fin);
    // La prise dit « Certifexemple » (61,7 s) : jamais affiché, ni par une plaquette ni par un sous-titre.
    expect(MOTS.some((m) => /certifexemple/i.test(m.w))).toBe(true);
    expect(motsInterditsDans(texteAffiche(el))).toEqual([]);
    expect(plan.groupes.flatMap((g) => g.mots.map((m) => m.w)).some((w) => /certifexemple/i.test(w))).toBe(false);
  });

  it("vidéo courte (12 s) : rendable ; vidéo muette : aucune plaquette (jamais rendue)", async () => {
    const court = MOTS.filter((m) => m.f <= 12);
    const r = await realiser({ ...ENTREE, mots: court, dureeSec: 12, prise: { src: PRISE_MONTEE_V4, finSec: 12 }, fin: { ...ENTREE.fin, debut: 12 } });
    expect(r.version).toBe("simple");
    expect(r.rendable).toBe(true);
    expect(planMinimalV4({ mots: [], horizon: 30 })).toEqual([]);
    const muet = await realiser({ ...ENTREE, mots: [], dureeSec: 30, prise: { src: PRISE_MONTEE_V4, finSec: 30 }, fin: { ...ENTREE.fin, debut: 30 } });
    expect(muet.rendable).toBe(false);
  });
});

/* ---------------- Chaîne de production ---------------- */

function outilsDoubles(o: { reponses?: ReponseRealisateur[]; renduEnCours?: number } = {}) {
  const claude = fauxClaude(o.reponses ?? [{ ok: true, donnees: reponseValide() }]);
  let attentes = o.renduEnCours ?? 0;
  const rendus: { plan: PlanFacecamAnimee; gardes: { debutSec: number; finSec: number }[] }[] = [];
  const outils: OutilsChaineV4 = {
    transcrire: vi.fn(async () => ({ mots: BRUT.mots, dureeSec: DUREE_PRISE })),
    plafondClaudeAtteint: async () => false,
    appelerRealisateur: claude.appeler,
    rendre: vi.fn(async (d) => {
      if (attentes-- > 0) throw new EnCoursChaineV4("Le montage");
      rendus.push({ plan: d.plan, gardes: d.gardes });
      return { cle: "studio/dev/facecam-animee/v-1/fa4.mp4", vignetteCle: "studio/dev/facecam-animee/v-1/fa4.jpg", dureeSec: d.plan.duree, taille: 34_000_000 };
    }),
  };
  return { outils, claude, rendus };
}

describe("Lot I · chaîne de production (prise → mots → coupes → Opus → rendu)", () => {
  it("coupes de la chaîne = coupes de la répétition validée (30 intervalles, 82,667 s, mêmes mots)", () => {
    const c = couperPriseV4({ mots: BRUT.mots, dureeSec: DUREE_PRISE, texteValide: SCRIPT });
    expect(c.gardes).toEqual(TRANS.gardes);
    expect(c.dureeSec).toBe(DUREE);
    expect(c.mots).toEqual(MOTS);
  });

  it("de bout en bout avec un faux Claude : le plan rendu est celui de la répétition (plaquettes et sous-titres)", async () => {
    const { outils, rendus, claude } = outilsDoubles({ renduEnCours: 2 });
    let etat: EtatChaineV4 = etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "studio/dev/entree/facecam-animee/f-1.mov", texteValide: SCRIPT });
    const vus: string[] = [];
    for (let k = 0; k < 10 && etat.etape !== "prete"; k++) {
      try {
        etat = await avancerChaineV4(etat, outils);
      } catch (e) {
        if (!(e instanceof EnCoursChaineV4)) throw e;
      }
      vus.push(etat.etape);
    }
    expect(etat.etape).toBe("prete");
    expect(vus).toEqual(["coupes", "mise-en-scene", "videos", "rendu", "rendu", "rendu", "prete"]);
    expect(claude.appeler).toHaveBeenCalledTimes(2); // D14 : Opus recommence une fois, puis son plan est gardé
    expect(etat.realisation?.phrase).toBe("Mise en scène gardée : 5 plaquettes dépassent leur plafond de variété (D14/D2a).");
    expect(etat.realisation?.version).toBe("complete");
    expect(rendus).toHaveLength(1);
    expect(rendus[0].gardes).toEqual(TRANS.gardes);
    expect(rendus[0].plan.elementsV4).toEqual(PLAN_VALIDE.elementsV4);
    expect(rendus[0].plan.groupes).toEqual(PLAN_VALIDE.groupes);
    expect(rendus[0].plan.duree).toBe(PLAN_VALIDE.duree);
    expect(rendus[0].plan.prise.src).toBe(PRISE_MONTEE_V4);
    expect(rendus[0].plan.sons).toEqual([]);
    const res = resultatV4(etat);
    expect(res.sorties).toHaveLength(1);
    expect(res.sorties[0]).toMatchObject({ ratio: "9:16", fichierCle: "studio/dev/facecam-animee/v-1/fa4.mp4", resolution: "1080x1920" });
  });

  it("prise muette → arrêt clair, non réessayable", async () => {
    const { outils } = outilsDoubles();
    outils.transcrire = async () => ({ mots: [], dureeSec: 20 });
    await expect(avancerChaineV4(etatInitialV4({ videoId: "v", versionId: "ver", priseCle: "k" }), outils)).rejects.toMatchObject({ name: "ErreurChaineV4", reessayable: false });
  });
});

/* ---------------- Moteur ---------------- */

const COMMANDE = (entrees: Record<string, unknown>): CommandeFabrication => ({ videoId: "v-1", formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"], entrees, briques: {}, distribution: [] }) as unknown as CommandeFabrication;
const PRISE = { facecamAnimee: { priseCle: "studio/dev/entree/facecam-animee/f-1.mov", fichierId: "f-1", texteValide: SCRIPT, accordEssaiReel: true } };

describe("Lot I · moteur (refus au lancement levé, vraie chaîne)", () => {
  const moteur = creerMoteurMontageFacecamAnimee();
  it("refus : sans prise (squelette), et format masqué sans l'accord d'essai de Will ; accepté avec prise + accord", () => {
    expect(moteur.refusAuLancement?.(COMMANDE({}))).toMatchObject({ code: "FACECAM_ANIMEE_EN_CHANTIER" });
    expect(moteur.refusAuLancement?.(COMMANDE({ facecamAnimee: { ...PRISE.facecamAnimee, accordEssaiReel: false } }))).toMatchObject({ code: "FACECAM_ANIMEE_FORMAT_MASQUE" });
    expect(moteur.refusAuLancement?.(COMMANDE(PRISE))).toBeNull();
    expect(lireEntreesFacecamAnimee(PRISE)).toMatchObject({ priseCle: PRISE.facecamAnimee.priseCle, accordEssaiReel: true });
  });

  it("lancer puis avancer jusqu'à la vidéo finie (outils doubles) ; un travail extérieur en cours ne fait pas d'échec", async () => {
    const { outils } = outilsDoubles({ renduEnCours: 1 });
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const c = COMMANDE(PRISE);
    let t: Travail = await m.lancer(c, { travailId: "trav-1", versionId: "ver-1", titre: "Essai" });
    expect(t.etapes.map((e) => e.cle)).toEqual(["transcription", "coupes", "mise-en-scene", "videos", "rendu"]);
    let resultat;
    for (let k = 0; k < 8 && t.statut !== "termine"; k++) {
      const r = await m.avancer(t, c);
      t = r.travail;
      resultat = r.resultat;
      expect(t.statut).not.toBe("echec");
    }
    expect(t.statut).toBe("termine");
    expect(t.etapes.every((e) => e.statut === "terminee")).toBe(true);
    expect(resultat?.sorties[0].fichierCle).toBe("studio/dev/facecam-animee/v-1/fa4.mp4");
  });

  it("studio non relié → échec réessayable ; « Réessayer » reprend l'étape arrêtée", async () => {
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => null });
    const c = COMMANDE(PRISE);
    const t = await m.lancer(c, { travailId: "trav-2", versionId: "ver-2", titre: "Essai" });
    const r = await m.avancer(t, c);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur).toMatchObject({ code: "FACECAM_ANIMEE_NON_RELIE", reessayable: true });
    const repris = await m.reessayer(r.travail);
    expect(repris.statut).toBe("en_cours");
    expect(repris.parametres?.facecamAnimeeV4).toMatchObject({ etape: "transcription" });
  });
});

/* ---------------- Visible pour Will seul ---------------- */

describe("Lot I · format visible seulement pour Will", () => {
  it("format actif mais réservé à Will : absent des listes, aucun lien du menu ; la page n'est joignable que par son adresse", () => {
    expect(obtenirFormat("facecam-animee").statut).toBe("actif");
    expect(obtenirFormat("facecam-animee").reserveAWill).toBe(true);
    expect(listerFormats().some((f) => f.id === "facecam-animee")).toBe(false);
    for (const liste of [NAV_LATERALE, ONGLETS_BAS, TUILES_PLUS]) expect(liste.some((e) => e.href.includes("face-camera-animee"))).toBe(false);
    expect(existsSync(join(RACINE, "src/app/(studio)/face-camera-animee/page.tsx"))).toBe(true);
  });

  it("le dépôt exige la session du studio et l'accord d'essai ; avec l'accord, la vidéo part (doubles)", { timeout: 30_000 }, async () => {
    vi.resetModules();
    vi.doMock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
    const { deposerFacecamAnimee, PHRASES_FA } = await import("@/services/facecam-animee");
    const fichier = async () => ({ id: "f-1", cleStockage: "studio/dev/entree/facecam-animee/f-1.mov", mime: "video/quicktime", nom: "IMG_7747.MOV", taille: 1 });
    const lancer = vi.fn(async () => ({ travailId: "trav" }));
    const brouillon = vi.fn(async (_e: { entrees: Record<string, unknown>; distribution: unknown[] }) => ({ id: "v-9" }));
    // Contrôle « prise déjà traitée » (lot L7) : de faux dépôts vides, pas d'import à froid ni de lecture des vrais dépôts (test plus rapide).
    const sourcesSujets = { videos: async () => [], sujets: async () => ({ sujets: [], sujetDuScript: {} }), fichiers: async () => [], garde: async () => "bloquant", catalogueEtendu: async () => false, banque: () => [], maintenant: () => "2026-10-19T00:00:00.000Z" };
    const sans = await deposerFacecamAnimee({ fichierId: "f-1", dureeSec: 130 }, { fichier, accordEssai: async () => false, brouillon, lancer, sourcesSujets });
    expect(sans).toEqual({ statut: "refusee", phrase: PHRASES_FA.sansAccord });
    expect(lancer).not.toHaveBeenCalled();
    const enregistrerAccord = vi.fn(async () => undefined);
    const avec = await deposerFacecamAnimee({ fichierId: "f-1", dureeSec: 130, texte: SCRIPT, accordEssai: true }, { fichier, accordEssai: async () => false, enregistrerAccord, brouillon, lancer, sourcesSujets });
    expect(avec).toEqual({ statut: "lancee", videoId: "v-9" });
    expect(enregistrerAccord).toHaveBeenCalledTimes(1);
    expect(brouillon.mock.calls[0]?.[0]).toMatchObject({ entrees: { facecamAnimee: { priseCle: "studio/dev/entree/facecam-animee/f-1.mov", accordEssaiReel: true, texteValide: SCRIPT } }, distribution: [{ source: "rush" }] });
    const image = await deposerFacecamAnimee({ fichierId: "f-1", dureeSec: 130 }, { fichier: async () => ({ ...(await fichier()), mime: "image/png" }), accordEssai: async () => true, brouillon, lancer, sourcesSujets });
    expect(image.statut).toBe("refusee");
    vi.doUnmock("@/services/auth");
  });
});

/* ---------------- Service de rendu ---------------- */

describe("Lot I · service de rendu, opération facecam-v4", () => {
  const planOk = { ...PLAN_VALIDE, prise: { ...PLAN_VALIDE.prise, src: PRISE_MONTEE_V4 }, sons: [] };
  it("paramètres contrôlés : plan v4 exigé, AUCUN son (pas de musique), prise montée, intervalles valides", () => {
    expect(lireParametresFacecamV4({ plan: planOk, gardes: TRANS.gardes }).gardes).toHaveLength(30);
    expect(() => lireParametresFacecamV4({ plan: { ...planOk, sons: [{ src: "musique.mp3" }] }, gardes: TRANS.gardes })).toThrow(/aucune musique/);
    expect(() => lireParametresFacecamV4({ plan: { ...planOk, elementsV4: [] }, gardes: TRANS.gardes })).toThrow();
    expect(() => lireParametresFacecamV4({ plan: { ...planOk, prise: { src: "autre.mp4" } }, gardes: TRANS.gardes })).toThrow();
    expect(() => lireParametresFacecamV4({ plan: planOk, gardes: [{ debutSec: 3, finSec: 2 }] })).toThrow();
  });

  it("filtre de montage = celui de la répétition (intervalles gardés, 30 i/s, voix comprise, aucun zoom)", () => {
    const f = filtreMontageV4(TRANS.gardes);
    expect(f.match(/\[0:v\]trim=/g)).toHaveLength(30);
    expect(f.match(/\[0:a\]atrim=/g)).toHaveLength(30);
    // Texte identique au filtre de la répétition (`outils/facecam-animee-v4/monter-prise.mjs`).
    const g = TRANS.gardes;
    const repetition = g.map((x, i) => `[0:v]trim=start=${x.debutSec}:end=${x.finSec},setpts=PTS-STARTPTS,fps=30[v${i}];[0:a]atrim=start=${x.debutSec}:end=${x.finSec},asetpts=PTS-STARTPTS[a${i}];`).join("") + g.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${g.length}:v=1:a=1[v][a]`;
    expect(f).toBe(repetition);
    expect(f).toContain("concat=n=30:v=1:a=1[v][a]");
    expect(f).not.toMatch(/scale|crop|zoom/);
  });

  // Skippé : média retiré de la version publique (B-roll).
  it.skip("médias servis : bruitages, B-roll, polices (Montserrat 900, Montserrat Black, Inter Bold) et logo existent, noms uniques", () => {
    const { dossiers, fichiers } = sourcesMediasV4(join(RACINE, "studio-rendu"));
    const noms: string[] = [];
    for (const d of dossiers) {
      expect(existsSync(d)).toBe(true);
      noms.push(...readdirSync(d).filter((n) => /\.(wav|mp4|woff2|ttf|png)$/i.test(n)));
    }
    for (const f of fichiers) {
      expect(existsSync(f)).toBe(true);
      noms.push(f.split("/").pop()!);
    }
    expect(new Set(noms).size).toBe(noms.length);
    for (const n of ["Montserrat-900-latin.woff2", "Montserrat-Black.ttf", "Inter-Bold.ttf", "logo-axion.png", "whoosh-in.wav", "broll-reunion-equipe.mp4"]) expect(noms).toContain(n);
    // Tout média nommé par le plan validé est servi.
    for (const e of PLAN_VALIDE.elementsV4 ?? []) for (const m of e.medias ?? []) expect(noms).toContain(m.split("/").pop());
  });

  it("plaquettes v4 : plus aucun staticFile direct (mediaV4), chaque .tsx commence par import React, aucune valeur importée de src/", () => {
    const ic = join(RACINE, "studio-rendu/compositions/interface-claire");
    const fichiers = [join(ic, "VideoAnimeeV4.tsx"), join(ic, "plan-galerie.ts")];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        if (n.isDirectory()) parcourir(join(d, n.name));
        else if (/\.tsx?$/.test(n.name)) fichiers.push(join(d, n.name));
      }
    };
    parcourir(join(ic, "motion-v4"));
    for (const f of fichiers) {
      const s = readFileSync(f, "utf8");
      if (!f.endsWith("medias-v4.ts")) expect(s, f).not.toMatch(/\bstaticFile\(/);
      if (f.endsWith(".tsx")) expect(s.startsWith('import React'), f).toBe(true);
      expect(s, f).not.toMatch(/^import (?!type)[^;]*from "(\.\.\/)+src\//m);
    }
  });
});
