/**
 * GV2-34 · face caméra animée, montage final : une vraie fin (réglage `facecamAnimee.finDouce`, ÉTEINT par défaut), les vraies
 * mesures du son dans le rapport, et des limites cohérentes entre le dépôt et le montage (4 Go, 20 000 caractères).
 * Réglage éteint : filtre et coupes identiques au caractère près à ceux de la répétition validée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { couperPriseV4, VERSION_CHAINE_V4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { resultatV4 } from "@/moteurs/montage-facecam-animee";
import { demandeRenduV4, outilsFacecamAnimee, PARAM_FIN_DOUCE_FA, PHRASES_FA } from "@/services/facecam-animee";
import { filtreMontageV4, lireParametresFacecamV4, PRISE_MONTEE_V4 } from "../../studio-rendu/src/operations/facecam-v4";

const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as Record<string, unknown> & { prise: Record<string, unknown>; duree: number };
const BRUT = (JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] }).mots;
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(readFileSync(join(RACINE, "tests/facecam-reprise-cartes.test.ts"), "utf8"))![1];
const DUREE_PRISE = 130.732;
const FIN_DERNIER_MOT = Math.max(...BRUT.map((m) => m.finSec));

describe("GV2-34 · fin douce : réglage éteint = rien ne change", () => {
  it("filtre : 3ᵉ argument absent ou faux = texte de la répétition, au caractère près", () => {
    const g = TRANS.gardes;
    const repetition = g.map((x, i) => `[0:v]trim=start=${x.debutSec}:end=${x.finSec},setpts=PTS-STARTPTS,fps=30[v${i}];[0:a]atrim=start=${x.debutSec}:end=${x.finSec},asetpts=PTS-STARTPTS[a${i}];`).join("") + g.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${g.length}:v=1:a=1[v][a]`;
    expect(filtreMontageV4(g)).toBe(repetition);
    expect(filtreMontageV4(g, undefined, false)).toBe(repetition);
    expect(filtreMontageV4(g)).not.toContain("afade");
  });

  it("coupes : option absente ou fausse = mêmes gardes que la répétition (30 intervalles)", () => {
    const sans = couperPriseV4({ mots: BRUT, dureeSec: DUREE_PRISE, texteValide: SCRIPT });
    expect(couperPriseV4({ mots: BRUT, dureeSec: DUREE_PRISE, texteValide: SCRIPT, finDouce: false })).toEqual(sans);
    expect(sans.gardes).toEqual(TRANS.gardes);
  });

  it("demande de rendu et lecture des paramètres : aucune clé finDouce tant que le réglage est éteint", () => {
    const base = { idRendu: "r", prise: "u", plan: PLAN_VALIDE as never, gardes: TRANS.gardes, sortie: { urlDepot: "a", cle: "a" }, vignette: { urlDepot: "b", cle: "b" } };
    expect("finDouce" in demandeRenduV4(base).parametres).toBe(false);
    expect("finDouce" in demandeRenduV4({ ...base, finDouce: false }).parametres).toBe(false);
    expect(demandeRenduV4({ ...base, finDouce: true }).parametres).toMatchObject({ finDouce: true });
    const plan = { ...PLAN_VALIDE, prise: { ...PLAN_VALIDE.prise, src: PRISE_MONTEE_V4 }, sons: [] };
    expect("finDouce" in lireParametresFacecamV4({ plan, gardes: TRANS.gardes })).toBe(false);
    expect("finDouce" in lireParametresFacecamV4({ plan, gardes: TRANS.gardes, finDouce: "oui" })).toBe(false);
    expect(lireParametresFacecamV4({ plan, gardes: TRANS.gardes, finDouce: true }).finDouce).toBe(true);
  });
});

describe("GV2-34 · fin douce allumée", () => {
  it("la dernière garde finit 0,6 s après le dernier mot (arrondie vers le haut à la grille de 30 i/s), les autres sont inchangées", () => {
    const sans = couperPriseV4({ mots: BRUT, dureeSec: DUREE_PRISE });
    const avec = couperPriseV4({ mots: BRUT, dureeSec: DUREE_PRISE, finDouce: true });
    expect(avec.gardes).toHaveLength(sans.gardes.length);
    expect(avec.gardes.slice(0, -1)).toEqual(sans.gardes.slice(0, -1));
    const derniere = avec.gardes[avec.gardes.length - 1];
    const cible = Math.min(FIN_DERNIER_MOT + 0.6, DUREE_PRISE);
    expect(derniere.finSec).toBeGreaterThanOrEqual(cible - 1e-9);
    expect(derniere.finSec).toBeLessThanOrEqual(cible + 1 / 30 + 1e-9);
    expect(Math.abs(derniere.finSec * 30 - Math.round(derniere.finSec * 30))).toBeLessThan(1e-6);
    expect(derniere.finSec).toBeGreaterThanOrEqual(sans.gardes[sans.gardes.length - 1].finSec);
    expect(avec.dureeSec).toBeGreaterThanOrEqual(sans.dureeSec);
  });

  it("la prise trop courte pour 0,6 s : la fin ne dépasse jamais la durée de la prise", () => {
    const mots: MotHorodate[] = [{ mot: "Bonjour", debutSec: 0.2, finSec: 0.6 }, { mot: "à", debutSec: 0.6, finSec: 0.7 }, { mot: "tous", debutSec: 0.7, finSec: 1.5 }, { mot: "merci", debutSec: 1.6, finSec: 5.3 }];
    const c = couperPriseV4({ mots, dureeSec: 5.5, finDouce: true });
    expect(c.gardes[c.gardes.length - 1].finSec).toBeLessThanOrEqual(5.5 + 1e-9);
  });

  it("le filtre contient afade=t=out de 0,15 s sur le dernier segment et des micro-fondus de 10 ms aux raccords", () => {
    const g = [{ debutSec: 0.5, finSec: 2 }, { debutSec: 3, finSec: 4.5 }, { debutSec: 6, finSec: 8 }];
    const f = filtreMontageV4(g, undefined, true);
    expect(f).toContain("[0:a]atrim=start=6:end=8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=1.85:d=0.15[a2]");
    expect(f).toContain("[0:a]atrim=start=0.5:end=2,asetpts=PTS-STARTPTS,afade=t=out:st=1.49:d=0.01[a0]");
    expect(f).toContain("[0:a]atrim=start=3:end=4.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=1.49:d=0.01[a1]");
    expect(f.match(/afade=t=out:st=[0-9.]+:d=0.15/g)).toHaveLength(1);
    expect(f).toContain("concat=n=3:v=1:a=1[v][a]");
    // L'image n'est pas touchée.
    expect(f).toContain("[0:v]trim=start=0.5:end=2,setpts=PTS-STARTPTS,fps=30[v0]");
    expect(filtreMontageV4(g, { x: 0, largeur: 1216, hauteur: 2160, sortieLargeur: 1080, sortieHauteur: 1920 }, true)).toContain("crop=1216:2160:0:0");
  });

  it("un seul segment : seulement le fondu de sortie de 0,15 s ; un segment très court : pas de micro-fondu", () => {
    expect(filtreMontageV4([{ debutSec: 0, finSec: 4 }], undefined, true)).toContain("asetpts=PTS-STARTPTS,afade=t=out:st=3.85:d=0.15[a0]");
    const court = filtreMontageV4([{ debutSec: 0, finSec: 2 }, { debutSec: 3, finSec: 3.04 }, { debutSec: 5, finSec: 7 }], undefined, true);
    expect(court).toContain("atrim=start=3:end=3.04,asetpts=PTS-STARTPTS[a1]");
  });
});

/* ---------------- Réglage : éteint si absent ou en panne ---------------- */

const lire = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
const etatRendu = vi.hoisted(() => ({ mesures: {} as Record<string, unknown> }));
vi.mock("@/fournisseurs/rendu/client", () => ({
  renduSimule: () => false,
  obtenirServiceRendu: () => ({}),
  suivreRendu: vi.fn(async () => ({ statut: "termine", sortieCle: "cle.mp4", mesures: etatRendu.mesures })),
}));

const outilsAvec = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);

describe("GV2-34 · réglage facecamAnimee.finDouce", () => {
  beforeEach(() => lire.mockReset());

  it("nom du réglage", () => expect(PARAM_FIN_DOUCE_FA).toBe("facecamAnimee.finDouce"));

  it("allumé seulement si la valeur vaut exactement true ; absent, autre valeur ou lecture en échec : clé absente", async () => {
    lire.mockImplementation(async (id: string, defaut: unknown) => (id === PARAM_FIN_DOUCE_FA ? true : defaut));
    expect((await outilsAvec()).finDouce).toBe(true);
    for (const valeur of [false, "true", 1, null, undefined]) {
      lire.mockImplementation(async (id: string, defaut: unknown) => (id === PARAM_FIN_DOUCE_FA ? valeur : defaut));
      expect("finDouce" in (await outilsAvec())).toBe(false);
    }
    lire.mockImplementation(async (id: string, defaut: unknown) => { if (id === PARAM_FIN_DOUCE_FA) throw new Error("lecture"); return defaut; });
    expect("finDouce" in (await outilsAvec())).toBe(false);
    lire.mockImplementation(async (_id: string, defaut: unknown) => defaut);
    expect(Object.keys(await outilsAvec()).sort()).toEqual(["appelerRealisateur", "historique", "plafondClaudeAtteint", "rendre", "reperer", "transcrire", "videos"]);
  });
});

/* ---------------- Mesures du son dans le rapport ---------------- */

const rendreAvec = async (mesures: Record<string, unknown>) => {
  lire.mockImplementation(async (_id: string, defaut: unknown) => defaut);
  etatRendu.mesures = mesures;
  const outils = await outilsAvec();
  return outils.rendre({ idRendu: "fa4-v", priseCle: "prise", plan: { duree: 80 } as never, gardes: [{ debutSec: 0, finSec: 80 }] });
};

function etatAvecRendu(rendu: Partial<NonNullable<EtatChaineV4["rendu"]>>, dureePlan = 80): EtatChaineV4 {
  return {
    version: VERSION_CHAINE_V4,
    etape: "prete",
    demande: { videoId: "v", versionId: "ver", priseCle: "p" },
    coupes: { gardes: [{ debutSec: 0, finSec: dureePlan }], dureeSec: dureePlan, mots: [] },
    realisation: { version: "complete", essais: 1, avertissements: 0, plan: { groupes: [], duree: dureePlan } as never },
    rendu: { cle: "c.mp4", vignetteCle: "c.jpg", dureeSec: dureePlan, taille: 10, ...rendu },
  } as unknown as EtatChaineV4;
}

describe("GV2-34 · le rapport dit les vraies mesures du son", () => {
  it("rendre remonte lufs, picVraiDbtp et dureeMonteeSec quand le rendu les donne ; sinon rien (champs facultatifs)", async () => {
    const r = await rendreAvec({ dureeSec: 80, taille: 5, lufs: -16, picVraiDbtp: -2.1, dureeMonteeSec: 79.9 });
    expect(r).toMatchObject({ cle: "cle.mp4", dureeSec: 80, taille: 5, lufs: -16, picVraiDbtp: -2.1, dureeMonteeSec: 79.9 });
    const vide = await rendreAvec({ dureeSec: 80, taille: 5 });
    expect(Object.keys(vide).sort()).toEqual(["cle", "dureeSec", "taille", "vignetteCle"]);
    const junk = await rendreAvec({ dureeSec: 80, taille: 5, lufs: "x", picVraiDbtp: null });
    expect("lufs" in junk).toBe(false);
    expect("picVraiDbtp" in junk).toBe(false);
  });

  it("sans mesure (ancien état) : rapport d'aujourd'hui, −14, aucune alerte de plus", () => {
    const s = resultatV4(etatAvecRendu({})).sorties[0].rapportQualite;
    expect(s.niveauSonoreLufs).toBe(-14);
    expect(s.note).toBe(90);
    expect(s.alertes).toEqual([]);
  });

  it("niveau mesuré à −14,4 : écrit tel quel, pas d'alerte (dans la tolérance)", () => {
    const s = resultatV4(etatAvecRendu({ lufs: -14.4, picVraiDbtp: -2, dureeMonteeSec: 80 })).sorties[0].rapportQualite;
    expect(s.niveauSonoreLufs).toBe(-14.4);
    expect(s.alertes).toEqual([]);
  });

  it("mesures doubles (−16 LUFS) : rapport fidèle et alerte info « niveau-sonore » ; la note reste celle d'aujourd'hui", () => {
    const r = resultatV4(etatAvecRendu({ lufs: -16, picVraiDbtp: -2, dureeMonteeSec: 80 }));
    const rapport = r.sorties[0].rapportQualite;
    expect(rapport.niveauSonoreLufs).toBe(-16);
    expect(rapport.note).toBe(90);
    expect(rapport.alertes).toHaveLength(1);
    expect(rapport.alertes[0]).toMatchObject({ code: "niveau-sonore", gravite: "info" });
    expect(rapport.alertes[0].message).toContain("-16");
    expect(r.noteQualite.alertes).toEqual(rapport.alertes);
  });

  it("durée montée écartée du plan de plus de 2 images : alerte info « duree » ; 2 images exactement : rien", () => {
    const a = resultatV4(etatAvecRendu({ dureeMonteeSec: 80.2 })).sorties[0].rapportQualite.alertes;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ code: "duree", gravite: "info" });
    expect(resultatV4(etatAvecRendu({ dureeMonteeSec: 80 + 2 / 30 })).sorties[0].rapportQualite.alertes).toEqual([]);
    expect(resultatV4(etatAvecRendu({ dureeMonteeSec: 79.99 })).sorties[0].rapportQualite.alertes).toEqual([]);
  });
});

/* ---------------- Limites du dépôt ---------------- */

describe("GV2-34 · limites du dépôt alignées sur le montage", () => {
  const sourcesSujets = { videos: async () => [], sujets: async () => ({ sujets: [], sujetDuScript: {} }), fichiers: async () => [], garde: async () => "bloquant", catalogueEtendu: async () => false, banque: () => [], maintenant: () => "2026-11-13T00:00:00.000Z" };
  const fichierDe = (taille: number) => async () => ({ id: "f-1", cleStockage: "studio/dev/entree/facecam-animee/f-1.mov", mime: "video/quicktime", nom: "IMG.MOV", taille });
  const outils = () => ({ empreinte: vi.fn(async (f: never) => f), brouillon: vi.fn(async () => ({ id: "v-9" })), lancer: vi.fn(async () => ({ travailId: "t" })), enregistrerAccord: vi.fn(async () => undefined), accordEssai: async () => true, sourcesSujets });

  it("fichier déclaré à 5 Go : refus avant tout appel (empreinte, brouillon, lancement)", async () => {
    const { deposerFacecamAnimee } = await import("@/services/facecam-animee");
    const dep = outils();
    const r = await deposerFacecamAnimee({ fichierId: "f-1", dureeSec: 130 }, { ...dep, fichier: fichierDe(5 * 1024 ** 3) } as never);
    expect(r).toEqual({ statut: "refusee", phrase: PHRASES_FA.tropLourd });
    expect(PHRASES_FA.tropLourd).toBe("Ce fichier dépasse 4 Go : le montage ne pourra pas le lire. Exportez-le en plus léger.");
    expect(dep.empreinte).not.toHaveBeenCalled();
    expect(dep.brouillon).not.toHaveBeenCalled();
    expect(dep.lancer).not.toHaveBeenCalled();
  });

  it("fichier de 4 Go pile ou plus léger : accepté ; texte de 20 000 caractères : accepté", async () => {
    const { deposerFacecamAnimee } = await import("@/services/facecam-animee");
    for (const taille of [4 * 1024 ** 3, 1_000_000]) {
      const dep = outils();
      const r = await deposerFacecamAnimee({ fichierId: "f-1", dureeSec: 130, texte: "a".repeat(20_000) }, { ...dep, fichier: fichierDe(taille) } as never);
      expect(r).toEqual({ statut: "lancee", videoId: "v-9" });
    }
  });

  it("texte de 20 001 caractères : refus clair, rien n'est créé (plus de coupe en silence)", async () => {
    const { deposerFacecamAnimee } = await import("@/services/facecam-animee");
    const dep = outils();
    const r = await deposerFacecamAnimee({ fichierId: "f-1", dureeSec: 130, texte: "a".repeat(20_001) }, { ...dep, fichier: fichierDe(1_000_000) } as never);
    expect(r).toEqual({ statut: "refusee", phrase: PHRASES_FA.texteTropLong });
    expect(PHRASES_FA.texteTropLong).toMatch(/20 000 caractères/);
    expect(dep.brouillon).not.toHaveBeenCalled();
    expect(dep.lancer).not.toHaveBeenCalled();
  });
});

describe("GV2-34 · fin douce : une consigne dite après la dernière phrase reste coupée", () => {
  it("la dernière garde s'arrête avant « Monteur, … » dit en fin de prise (avec et sans texte dit)", () => {
    const consigne = ["Monteur,", "coupe", "la", "fin", "ici."].map((mot, i) => ({ ...BRUT[BRUT.length - 1], mot, debutSec: FIN_DERNIER_MOT + 2 + i * 0.4, finSec: FIN_DERNIER_MOT + 2.35 + i * 0.4 }));
    const mots = [...BRUT, ...consigne];
    for (const texteValide of [undefined, SCRIPT]) {
      const sans = couperPriseV4({ mots, dureeSec: FIN_DERNIER_MOT + 6, texteValide });
      const avec = couperPriseV4({ mots, dureeSec: FIN_DERNIER_MOT + 6, texteValide, finDouce: true });
      expect(avec.gardes.at(-1)!.finSec).toBeLessThan(consigne[0].debutSec);
      expect(avec.gardes.at(-1)!.finSec).toBeGreaterThanOrEqual(sans.gardes.at(-1)!.finSec);
      expect(avec.mots).toHaveLength(sans.mots.length);
    }
  });
});
