import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { NavigationFilmee } from "@/briques/plan-scenes/tutoriel/navigation-filmee";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { EtapeCalee } from "@/moteurs/montage-tutoriel-outil/calage-scenario";
import type { CarteZones, ZoneCarte } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import { DUREE_CIBLE_SEC, type CahierVideo } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import {
  SEUILS_TUTORIEL,
  controlerApresCalage,
  controlerAvantValidation,
  controlerVideoEssai,
  fusionnerVerdicts,
  publiable,
  resumePourWilliams,
  type EntreeApresCalage,
  type EntreeAvantValidation,
  type EntreeVideoEssai,
  type VerdictControleur,
} from "@/moteurs/montage-tutoriel-outil/equipe/controleur";
import type { ParcoursTutoriel } from "@/moteurs/montage-tutoriel-outil/equipe/realisateur";
import type { PhraseScript, PropositionScripts, VersionScript } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import type { FicheValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import { MOTS_PAR_SECONDE } from "@/moteurs/montage-tutoriel-outil/script";
import { mesuresPourControle, noterZones, type ZoneMesure } from "@/briques/controle-image/mesures-video";
import { controlerVideoFinie } from "@/briques/controle-image/video-finie";
import { controlerMarque } from "@/moteurs/montage-tutoriel-outil/equipe/controle-marque";
import { etablirVerdict } from "@/moteurs/montage-tutoriel-outil/equipe/controleur";
import { controlerNettete, rapportNetteteTutoriel, type RapportNettete } from "@/moteurs/montage-tutoriel-outil/nettete";

/* ---------- Entrées fictives cohérentes avec T-EXT-18 à 22 ---------- */
const cahier: CahierVideo = {
  version: "cahier-tutoriel.v1",
  entree: "A",
  cas: 1,
  gabarits: ["G-Decision"],
  roles: [],
  manques: [],
  scriptsFournis: [],
  fin: "aucune",
  ratios: ["4:5"],
  dureeCibleSec: [40, 55],
  raisons: [],
};
const zone = (id: string, etat: ZoneCarte["etat"], chiffres: string[] = []): ZoneCarte => ({ id, nom: id, aller: id, cible: `[data-zone="${id}"]`, etat, gestes: ["clic"], prouve: "Une zone de démonstration.", chiffres });
const carte: CarteZones = { version: "carte-zones.v1", maquette: "demo", manques: [], zones: [zone("alertes", "maintenant", ["12 commandes"]), zone("commandes", "maintenant"), zone("resume", "avant")] };
const fiche: FicheValeur = {
  version: "fiche-valeur.v1",
  persona: { metier: "responsable d'atelier", journee: "Entre deux commandes, il cherche ce qui manque.", perte: "Du temps et du calme." },
  avant: ["Des tableurs dispersés."],
  moments: [
    { id: "m1", zoneId: "alertes", geste: "clic", evite: "Vous ne cherchez plus ce qui manque." },
    { id: "m2", zoneId: "commandes", geste: "clic", permet: "Vous voyez tout de suite les commandes en retard." },
  ],
  gainEntreprise: { devient: "plus-sereine", pourquoi: "L'entreprise garde une vue claire de son activité." },
  emotion: "soulagement",
};
const REMPLIR = "Vous gardez la vue sur ce qui compte vraiment pour votre journée.";
const base = (): PhraseScript[] => [
  { texte: "Chaque jour, vous perdez du temps à chercher.", temps: "situation", apport: "Le spectateur se reconnaît." },
  { texte: "Vous ne cherchez plus ce qui manque.", temps: "changement", apport: "Il voit ce qui change.", zoneId: "alertes", momentId: "m1" },
  { texte: "Vous voyez tout de suite les commandes en retard.", temps: "changement", apport: "Il voit ce qui change.", zoneId: "commandes", momentId: "m2" },
  { texte: "Votre atelier tourne, sans courir après l'information.", temps: "gain", apport: "Il voit ce que l'entreprise devient." },
];
const allonger = (p: PhraseScript[], secondes: number): PhraseScript[] => {
  const out = [...p];
  const mots = (): number => out.map((x) => x.texte).join(" ").split(/\s+/).length;
  while (mots() / MOTS_PAR_SECONDE < secondes) out.splice(1, 0, { texte: REMPLIR, temps: "situation", apport: "Prolonge la situation reconnue." });
  return out;
};
const milieu = (DUREE_CIBLE_SEC[0] + DUREE_CIBLE_SEC[1]) / 2;
const phrases = (): PhraseScript[] => allonger(base(), milieu);
const version = (id: "A" | "B", p: PhraseScript[]): VersionScript => ({ id, source: "ecrit", phrases: p, empreinte: "x" });
const proposition = (p: PhraseScript[] = phrases()): PropositionScripts => ({ version: "scripts-tutoriel.v1", versions: [version("A", p), version("B", p)] });

/** Un geste par phrase, une étape par phrase ; chaque étape porte un texte de maquette « exemple ». */
function parcoursPour(n: number, o: { sansGeste?: number; zone?: { x: number; y: number; largeur: number; hauteur: number } } = {}): ParcoursTutoriel {
  const idx = Array.from({ length: n }, (_, i) => i);
  return {
    version: "parcours-tutoriel.v1",
    gabarits: ["G-Decision"],
    scenario: {
      version: "scenario-maquette.v1",
      maquette: "demo",
      largeur: 1080,
      hauteur: 1350,
      etapes: idx.map((i) => ({ id: `e${i}`, role: "parcours", aller: `vue-${i}`, ancre: { surMot: "vous" }, zone: i === 1 ? (o.zone ?? { x: 10, y: 10, largeur: 40, hauteur: 30 }) : undefined })),
    },
    plansDessines: [],
    gestes: idx.filter((i) => i !== o.sansGeste).map((i) => ({ etapeId: `e${i}`, phraseIndex: i, geste: "clic" as const })),
    empreinte: "x",
  } as unknown as ParcoursTutoriel;
}
const maquette = (n: number, extra: Record<number, string[]> = {}): { etapeId: string; textes: string[] }[] =>
  Array.from({ length: n }, (_, i) => ({ etapeId: `e${i}`, textes: extra[i] ?? ["Commandes en retard (exemple)"] }));

function avant(o: Partial<EntreeAvantValidation> = {}): EntreeAvantValidation {
  const n = phrases().length;
  return {
    cahier,
    carte,
    fiche,
    proposition: proposition(),
    parcours: parcoursPour(n),
    textesMaquette: maquette(n),
    couleurs: ["#B23F16", "#FAF9F5"],
    polices: ["Manrope"],
    noms: ["Espace démo · Atelier", "Entreprise exemple"],
    ...o,
  };
}
const ctl = (v: VerdictControleur, id: string) => v.controles.find((c) => c.id === id)!;

const donnees: TableauDeBord = {
  version: "tableau-de-bord.v1",
  titre: "Exemple fictif",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "Trimestre (exemple)" },
  source: "Outil exemple",
  indicateurs: [{ id: "retard", libelle: "Commandes en retard", valeur: 12, unite: "commandes", precision: 0, sens: "baisse-bonne" }],
  series: [],
  comparaisons: [],
  alertes: [],
  calculs: [],
};
/** Phrase qui dit un chiffre ; l'indice 2 est la phrase « commandes » (après l'allongement : on la cherche). */
function avecPhrase(texte: string): { p: PhraseScript[]; i: number } {
  const p = phrases();
  const i = p.findIndex((x) => x.momentId === "m2");
  p[i] = { ...p[i]!, texte };
  return { p, i };
}

describe("avant l'écran de validation", () => {
  it("tout bon → ok, aucun échec", () => {
    const v = controlerAvantValidation(avant());
    expect(v.controles.filter((c) => c.etat === "echoue").map((c) => c.id)).toEqual([]);
    expect(v).toMatchObject({ verdict: "ok", nonFaits: [] });
    expect(publiable(v)).toBe(true);
  });

  it("« 37 articles » dit, absent des données → TUT-CHIFFRES échoué", () => {
    const { p, i } = avecPhrase("Vous voyez 37 articles en retard.");
    const n = p.length;
    const v = controlerAvantValidation(avant({ proposition: proposition(p), donnees, parcours: parcoursPour(n), textesMaquette: maquette(n, { [i]: ["37 articles (exemple)"] }) }));
    expect(ctl(v, "TUT-CHIFFRES").etat).toBe("echoue");
    expect(v.verdict).toBe("bloque");
  });

  it("chiffre dans les données mais pas dans les textes de l'étape → échoué « pas à l'écran à ce moment-là »", () => {
    const { p } = avecPhrase("Vous voyez 12 commandes en retard.");
    const n = p.length;
    const v = controlerAvantValidation(avant({ proposition: proposition(p), donnees, textesMaquette: maquette(n, { 0: ["Autres : 12 commandes (exemple)"] }) }));
    const c = ctl(v, "TUT-CHIFFRES");
    expect(c.etat).toBe("echoue");
    expect(c.details.join(" ")).toContain("l'écran ne le montre pas à ce moment-là");
  });

  it("chiffre dit, dans les données ET dans les textes de l'étape → réussi", () => {
    const { p, i } = avecPhrase("Vous voyez 12 commandes en retard.");
    const n = p.length;
    const v = controlerAvantValidation(avant({ proposition: proposition(p), donnees, parcours: parcoursPour(n), textesMaquette: maquette(n, { [i]: ["12 commandes en retard (exemple)"] }), mentionExemple: true }));
    expect(ctl(v, "TUT-CHIFFRES").etat).toBe("reussi");
  });

  it("une phrase sans geste → TUT-GESTES échoué", () => {
    const n = phrases().length;
    const v = controlerAvantValidation(avant({ parcours: parcoursPour(n, { sansGeste: 2 }) }));
    expect(ctl(v, "TUT-GESTES").etat).toBe("echoue");
    expect(ctl(v, "TUT-GESTES").details.join(" ")).toContain("phrase 3");
  });

  it("une phrase avec deux gestes → TUT-GESTES échoué", () => {
    const n = phrases().length;
    const p = parcoursPour(n);
    p.gestes.push({ etapeId: "e1", phraseIndex: 0, geste: "zoom" });
    expect(ctl(controlerAvantValidation(avant({ parcours: p })), "TUT-GESTES").etat).toBe("echoue");
  });

  it("zone 95 + 10 de large → TUT-CADRE échoué ; zone trop petite aussi", () => {
    const n = phrases().length;
    const hors = controlerAvantValidation(avant({ parcours: parcoursPour(n, { zone: { x: 95, y: 10, largeur: 10, hauteur: 30 } }) }));
    expect(ctl(hors, "TUT-CADRE").etat).toBe("echoue");
    const petite = controlerAvantValidation(avant({ parcours: parcoursPour(n, { zone: { x: 10, y: 10, largeur: SEUILS_TUTORIEL.largeurZoomeeMinPct / 2, hauteur: 30 } }) }));
    expect(ctl(petite, "TUT-CADRE").etat).toBe("echoue");
  });

  it("quatre moments → TUT-MOMENTS échoué ; dernière phrase hors entreprise → échoué", () => {
    const p = phrases();
    p[p.length - 1] = { ...p[p.length - 1]!, texte: "Vous cliquez ici une dernière fois." };
    expect(ctl(controlerAvantValidation(avant({ proposition: proposition(p) })), "TUT-MOMENTS").etat).toBe("echoue");
    const quatre = { ...fiche, moments: [...fiche.moments, { id: "m3", zoneId: "resume", geste: "clic" }, { id: "m3", zoneId: "resume", geste: "clic" }] } as unknown as FicheValeur;
    expect(ctl(controlerAvantValidation(avant({ fiche: quatre })), "TUT-MOMENTS").etat).toBe("echoue");
  });

  it("la marque est contrôlée : mot interdit, argent, étiquette, bleu → bloqué", () => {
    const p = phrases();
    p[0] = { ...p[0]!, texte: "Chaque jour, vous perdez 500 euros, résultat garanti." };
    const v = controlerAvantValidation(avant({ proposition: proposition(p), couleurs: ["#1E6FD9"] }));
    expect(v.verdict).toBe("bloque");
    for (const id of ["MARQUE-MOTS", "MARQUE-ARGENT", "MARQUE-COULEURS"]) expect(ctl(v, id).etat).toBe("echoue");
    const q = phrases();
    q[0] = { ...q[0]!, texte: "Solution : vous gagnez du temps." };
    expect(ctl(controlerAvantValidation(avant({ proposition: proposition(q) })), "MARQUE-ETIQUETTES").etat).toBe("echoue");
    /* la mention « exemple » d'un texte de maquette n'est pas une étiquette du Studio */
    const m = controlerAvantValidation(avant({ textesMaquette: maquette(phrases().length, { 0: ["Exemple"] }) }));
    expect(ctl(m, "MARQUE-ETIQUETTES").etat).toBe("reussi");
  });

  it("un script fourni : la trame devient remarque (non bloquante) ; la version écrite trop courte bloque", () => {
    const court = base();
    const v = controlerAvantValidation(avant({ proposition: proposition(court) }));
    expect(ctl(v, "TUT-TRAME").etat).toBe("echoue");
  });
});

/* ---------- Après calage ---------- */
const etape = (i: number, ms: number): EtapeCalee => ({ id: `e${i}`, role: "parcours", debutMs: i * 3000, finMs: i * 3000 + ms });
const nav = (o: Partial<NavigationFilmee> = {}): NavigationFilmee => ({
  version: "navigation-filmee.v1",
  videoCle: "film.mp4",
  maquette: "demo",
  largeur: 1080,
  hauteur: 1350,
  debutFilmMs: 0,
  dureeVoixMs: 10000,
  cibles: [{ etapeId: "e0", instantMs: 1000, finMs: 3000 }],
  ...o,
});
function calage(o: Partial<EntreeApresCalage> = {}): EntreeApresCalage {
  return { script: { phrases: [] }, parcours: parcoursPour(3), etapes: [etape(0, 3000), etape(1, 3000)], dureeVoixMs: 44000, dureeFinMs: 4000, ...o };
}

describe("après le calage de la voix", () => {
  it("durées : 52 s + 4 s échoue ; 38 s échoue ; 48 s réussit", () => {
    expect(ctl(controlerApresCalage(calage({ dureeVoixMs: 52000, dureeFinMs: 4000 })), "TUT-DUREE").etat).toBe("echoue");
    expect(ctl(controlerApresCalage(calage({ dureeVoixMs: 38000, dureeFinMs: 0 })), "TUT-DUREE").etat).toBe("echoue");
    expect(ctl(controlerApresCalage(calage({ dureeVoixMs: 44000, dureeFinMs: 4000 })), "TUT-DUREE").etat).toBe("reussi");
  });
  it("bornes exactes de DUREE_CIBLE_SEC réussissent, ± 1 ms échouent", () => {
    const bas = DUREE_CIBLE_SEC[0] * 1000;
    const haut = DUREE_CIBLE_SEC[1] * 1000;
    const d = (ms: number) => ctl(controlerApresCalage(calage({ dureeVoixMs: ms, dureeFinMs: 0 })), "TUT-DUREE").etat;
    expect([d(bas), d(haut)]).toEqual(["reussi", "reussi"]);
    expect([d(bas - 1), d(haut + 1)]).toEqual(["echoue", "echoue"]);
  });
  it("étape de 1 000 ms → TUT-RYTHME échoué ; 1 200 ms pile → réussi", () => {
    expect(ctl(controlerApresCalage(calage({ etapes: [etape(0, 1000)] })), "TUT-RYTHME").etat).toBe("echoue");
    expect(ctl(controlerApresCalage(calage({ etapes: [etape(0, SEUILS_TUTORIEL.phraseMinMs)] })), "TUT-RYTHME").etat).toBe("reussi");
  });
  it("écran immobile de 2,0 s (caméra et curseur immobiles) → TUT-IMAGE-FIXE échoué", () => {
    const c = ctl(controlerApresCalage(calage({ navigation: nav({ figees: [{ debutMs: 4000, finMs: 6000 }], cibles: [] }) })), "TUT-IMAGE-FIXE");
    expect(c.etat).toBe("echoue");
    expect(c.details[0]).toContain("Écran immobile de 4,0 s à 6,0 s");
  });
  it("écran immobile de 1,2 s → réussi ; figees absent → non fait ; navigation absente → non fait", () => {
    expect(ctl(controlerApresCalage(calage({ navigation: nav({ figees: [{ debutMs: 4000, finMs: 5200 }], cibles: [] }) })), "TUT-IMAGE-FIXE").etat).toBe("reussi");
    const nonFait = controlerApresCalage(calage({ navigation: nav({ figees: undefined }) }));
    expect(ctl(nonFait, "TUT-IMAGE-FIXE").etat).toBe("non-fait");
    expect(nonFait.nonFaits).toContain("Écran immobile");
    expect(publiable(nonFait)).toBe(false);
    expect(ctl(controlerApresCalage(calage()), "TUT-IMAGE-FIXE").etat).toBe("non-fait");
  });
  it("scène « plein » sur l'intervalle d'une cible → échoué (elle cache le film)", () => {
    const plan = { scenes: [{ id: "s1", position: "plein", debutMs: 500, finMs: 2500 }] } as unknown as PlanValide;
    const c = ctl(controlerApresCalage(calage({ navigation: nav({ figees: [] }), plan })), "TUT-IMAGE-FIXE");
    expect(c.etat).toBe("echoue");
    expect(c.details.join(" ")).toContain("cache le film");
    const loin = { scenes: [{ id: "s1", position: "plein", debutMs: 5000, finMs: 6000 }] } as unknown as PlanValide;
    expect(ctl(controlerApresCalage(calage({ navigation: nav({ figees: [] }), plan: loin })), "TUT-IMAGE-FIXE").etat).toBe("reussi");
  });
});

/* ---------- Vidéo d'essai ---------- */
const MESURES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesFigeesHorsFin: 0, dureeSec: 48, vmaf: 95, vmafSeuil: 93 };
const PAGE = { boites: [{ role: "accroche" as const, texte: "Votre patron lit-il vos messages ?", taille: 0.058, couleur: "#141413", fond: "#FAF9F5", x: 0.1, y: 0.2, largeur: 0.6, hauteur: 0.12, debutSec: 0 }] };
const essai = (o: Partial<EntreeVideoEssai> = {}): EntreeVideoEssai => ({
  ratio: "9:16",
  reseaux: ["tiktok", "instagram", "facebook", "youtube-shorts"],
  textesRendus: [{ texte: "Vous voyez vos commandes.", origine: "sous-titres" }],
  couleursRendues: ["#B23F16", "#FAF9F5"],
  policesRendues: ["Manrope"],
  ...o,
});

describe("sur la vidéo d'essai", () => {
  it("sans mesures : contrôles du fichier « non fait », listés, jamais publiable", () => {
    const v = controlerVideoEssai(essai());
    expect(ctl(v, "IMAGE-volume").etat).toBe("non-fait");
    expect(v.nonFaits.length).toBeGreaterThan(0);
    expect(publiable(v)).toBe(false);
  });
  it("mesures et mise en page conformes → tout réussi, publiable", () => {
    const v = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE }));
    expect(v.controles.filter((c) => c.bloquant && c.etat !== "reussi").map((c) => c.id)).toEqual([]);
    expect(v.verdict).toBe("ok");
    expect(publiable(v)).toBe(true);
  });
  it("image figée mesurée > 0 → échoué, bloqué", () => {
    const v = controlerVideoEssai(essai({ mesures: { ...MESURES, imagesFigeesHorsFin: 3 }, miseEnPage: PAGE }));
    expect(ctl(v, "IMAGE-image-figee").etat).toBe("echoue");
    expect(v.verdict).toBe("bloque");
  });
  it("couleur bleue rendue → bloqué ; texte rendu avec argent → bloqué", () => {
    expect(controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, couleursRendues: ["#1E6FD9"] })).verdict).toBe("bloque");
    expect(controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, textesRendus: [{ texte: "Dès 49 $ par mois", origine: "sous-titres" }] })).verdict).toBe("bloque");
  });
});

/* ---------- T-EXT-54c : netteté et mesures de la vidéo finie ---------- */
const CODES_NETTETE = ["TUT-NETTETE", "TUT-AGRANDISSEMENT", "TUT-TEXTE-APRES-ZOOM"];
/** Mesures telles que le rendu les donne aujourd'hui : l'image figée n'y est pas (elle vient de la mesure sur tout le fichier). */
const MESURES_SANS_FIGE = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, dureeSec: 48, vmaf: 95, vmafSeuil: 93 };
const zoneMesure = (id: string, o: Partial<ZoneMesure> = {}): ZoneMesure => ({
  id,
  tSourceSec: 1,
  tVideoSec: 1,
  rectSource: { x: 0, y: 0, largeur: 400, hauteur: 200 },
  rectVideo: { x: 0, y: 0, largeur: 320, hauteur: 160 },
  echelleSource: 0.8,
  policeSourcePx: 60,
  minimumPx: 41,
  ...o,
});
const ZONES = [zoneMesure("e1#q1"), zoneMesure("e1#q2"), zoneMesure("e2#q1")];
/** Rapport bâti par les pièces fusionnées (54a puis 54d) : aucune règle recopiée ici. */
function rapportNettete(ssims: Record<string, number | null> = {}, zones: ZoneMesure[] = ZONES): RapportNettete {
  return rapportNetteteTutoriel(noterZones(zones, { "e1#q1": 0.95, "e1#q2": 0.96, "e2#q1": 0.97, ...ssims }), zones);
}
/** Le verdict d'avant T-EXT-54c, recomposé depuis les pièces que le contrôleur appelait déjà (T-EXT-23). */
function verdictDAvant(e: EntreeVideoEssai): VerdictControleur {
  const finie = controlerVideoFinie({ mesures: e.mesures, miseEnPage: e.miseEnPage, ratio: e.ratio, reseaux: e.reseaux, couleursRendues: e.couleursRendues, policesRendues: e.policesRendues });
  const marque = controlerMarque({ textes: e.textesRendus, couleurs: [], polices: [], noms: e.noms ?? [], chiffresAffiches: e.chiffresAffiches ?? false, mentionExemple: e.mentionExemple ?? false });
  return etablirVerdict([
    ...finie.image.controles.map((c) => ({ id: `IMAGE-${c.id}`, libelle: c.libelle, etat: c.etat, bloquant: c.bloquant, details: [c.raison] })),
    ...finie.charte.map((c) => ({ id: `IMAGE-${c.id}`, libelle: c.libelle, etat: c.etat, bloquant: c.bloquant, details: c.details.length ? c.details : [c.raison] })),
    ...marque.filter((c) => c.id !== "MARQUE-COULEURS" && c.id !== "MARQUE-POLICE"),
  ]);
}

describe("sur la vidéo d'essai : netteté et mesures de la vidéo finie (T-EXT-54c)", () => {
  it("sans `nettete` → exactement le verdict d'avant, aucun contrôle de netteté ajouté", () => {
    const entrees = [essai(), essai({ mesures: MESURES, miseEnPage: PAGE }), essai({ mesures: MESURES_SANS_FIGE, miseEnPage: PAGE }), essai({ mesures: { ...MESURES, imagesFigeesHorsFin: 3 }, miseEnPage: PAGE, couleursRendues: ["#1E6FD9"] })];
    for (const e of entrees) {
      const v = controlerVideoEssai(e);
      expect(v).toEqual(verdictDAvant(e));
      expect(controlerVideoEssai({ ...e, nettete: undefined })).toEqual(verdictDAvant(e));
      expect(v.controles.filter((c) => c.id.startsWith("TUT-"))).toEqual([]);
    }
    /* Sans la mesure sur tout le fichier, l'image figée reste « non fait » : jamais un succès. */
    const sansFige = controlerVideoEssai(essai({ mesures: MESURES_SANS_FIGE, miseEnPage: PAGE }));
    expect(ctl(sansFige, "IMAGE-image-figee").etat).toBe("non-fait");
    expect(publiable(sansFige)).toBe(false);
  });
  it("sans rapport, les trois contrôles de netteté sont « non fait », listés, jamais publiables", () => {
    const trois = controlerNettete(undefined);
    expect(trois.map((c) => c.id)).toEqual(CODES_NETTETE);
    const v = fusionnerVerdicts(controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE })), etablirVerdict(trois));
    for (const id of CODES_NETTETE) {
      expect(ctl(v, id).etat).toBe("non-fait");
      expect(v.nonFaits).toContain(ctl(v, id).libelle);
    }
    expect(publiable(v)).toBe(false);
  });
  it("rapport conforme et mesures du fichier → tout réussi, image figée mesurée, publiable", () => {
    const v = controlerVideoEssai(essai({ mesures: MESURES_SANS_FIGE, miseEnPage: PAGE, nettete: { rapport: rapportNettete(), mesures: mesuresPourControle({ imagesFigeesHorsFin: 0, imageNoireTete: 0, imagesNoiresHorsFin: 0 }) } }));
    for (const id of CODES_NETTETE) expect(ctl(v, id)).toMatchObject({ etat: "reussi", bloquant: true });
    expect(ctl(v, "IMAGE-image-figee").etat).toBe("reussi");
    expect(ctl(v, "IMAGE-image-figee").details).toEqual(["Aucune image figée avant la fin."]);
    expect(ctl(v, "IMAGE-image-noire").details).toEqual(["Aucune image noire avant la fin."]);
    expect(v.controles.filter((c) => c.bloquant && c.etat !== "reussi").map((c) => c.id)).toEqual([]);
    expect(v.nonFaits).toEqual([]);
    expect(v.verdict).toBe("ok");
    expect(publiable(v)).toBe(true);
    /* Les contrôles d'avant restent en tête, dans le même ordre ; les trois de netteté viennent après. */
    const avantNettete = verdictDAvant(essai({ mesures: { ...MESURES_SANS_FIGE, imagesFigeesHorsFin: 0, imagesNoiresHorsFin: 0 }, miseEnPage: PAGE }));
    expect(v.controles.slice(0, avantNettete.controles.length)).toEqual(avantNettete.controles);
    expect(v.controles.slice(avantNettete.controles.length).map((c) => c.id)).toEqual(CODES_NETTETE);
  });
  it("score de netteté 0,84 sur un quart → bloqué, raison citée, sans mot technique", () => {
    const v = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, nettete: { rapport: rapportNettete({ "e1#q2": 0.84 }), mesures: {} } }));
    expect(ctl(v, "TUT-NETTETE").etat).toBe("echoue");
    expect(ctl(v, "TUT-NETTETE").details).toEqual(["Étape 1 : le texte perd en netteté (score 0,84)."]);
    expect(ctl(v, "TUT-AGRANDISSEMENT").etat).toBe("reussi");
    expect(ctl(v, "TUT-TEXTE-APRES-ZOOM").etat).toBe("reussi");
    expect(v.verdict).toBe("bloque");
    expect(publiable(v)).toBe(false);
    const t = resumePourWilliams(v);
    expect(t).toContain("Étape 1 : le texte perd en netteté (score 0,84).");
    expect(t).not.toMatch(/SSIM|TUT-|IMAGE-|[$€]/i);
  });
  it("zoom au-delà de la finesse ou texte trop petit après zoom → bloqué, chacun sous son contrôle", () => {
    const zoom = [zoneMesure("e1#q1", { echelleSource: 1.25 })];
    const a = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, nettete: { rapport: rapportNettete({}, zoom), mesures: {} } }));
    expect(ctl(a, "TUT-AGRANDISSEMENT").etat).toBe("echoue");
    expect(ctl(a, "TUT-NETTETE").etat).toBe("reussi");
    expect(a.verdict).toBe("bloque");
    const petit = [zoneMesure("e1#q1", { policeSourcePx: 26, echelleSource: 0.5 })];
    const b = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, nettete: { rapport: rapportNettete({}, petit), mesures: {} } }));
    expect(ctl(b, "TUT-TEXTE-APRES-ZOOM").etat).toBe("echoue");
    expect(ctl(b, "TUT-TEXTE-APRES-ZOOM").details).toEqual(["Étape 1 : le plus petit texte montré fait 13 px, il en faut 41."]);
    expect(b.verdict).toBe("bloque");
  });
  it("`imagesFigeesHorsFin: 1` mesuré sur tout le fichier → image figée échouée, bloqué (même si le rendu disait 0)", () => {
    for (const mesures of [MESURES, MESURES_SANS_FIGE]) {
      const v = controlerVideoEssai(essai({ mesures, miseEnPage: PAGE, nettete: { rapport: rapportNettete(), mesures: { imagesFigeesHorsFin: 1 } } }));
      expect(ctl(v, "IMAGE-image-figee").etat).toBe("echoue");
      expect(ctl(v, "IMAGE-image-figee").details).toEqual(["1 passage figé avant la fin."]);
      expect(v.verdict).toBe("bloque");
    }
    const noir = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, nettete: { rapport: rapportNettete(), mesures: { imagesNoiresHorsFin: 2 } } }));
    expect(ctl(noir, "IMAGE-image-noire").etat).toBe("echoue");
    expect(noir.verdict).toBe("bloque");
  });
  it("un « non mesuré » n'est jamais un succès : quart non mesuré, rapport vide, mesures vides", () => {
    const quart = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, nettete: { rapport: rapportNettete({ "e2#q1": null }), mesures: {} } }));
    expect(ctl(quart, "TUT-NETTETE").etat).toBe("non-fait");
    expect(quart.nonFaits).toContain(ctl(quart, "TUT-NETTETE").libelle);
    expect(quart.verdict).toBe("ok");
    expect(publiable(quart)).toBe(false);

    const vide = controlerVideoEssai(essai({ mesures: MESURES, miseEnPage: PAGE, nettete: { rapport: { etapes: [] }, mesures: {} } }));
    for (const id of CODES_NETTETE) expect(ctl(vide, id).etat).toBe("non-fait");
    expect(vide.nonFaits).toEqual(CODES_NETTETE.map((id) => ctl(vide, id).libelle));
    expect(publiable(vide)).toBe(false);

    /* Mesures du fichier vides (sortie illisible) : l'image figée reste « non fait », le reste du rendu est gardé. */
    const illisible = controlerVideoEssai(essai({ mesures: MESURES_SANS_FIGE, miseEnPage: PAGE, nettete: { rapport: rapportNettete(), mesures: mesuresPourControle({}) } }));
    expect(ctl(illisible, "IMAGE-image-figee").etat).toBe("non-fait");
    expect(ctl(illisible, "IMAGE-volume").etat).toBe("reussi");
    expect(publiable(illisible)).toBe(false);

    /* Sans aucune mesure du rendu, celles du fichier ne font pas réussir le son ni la durée. */
    const seules = controlerVideoEssai(essai({ miseEnPage: PAGE, nettete: { rapport: rapportNettete(), mesures: { imagesFigeesHorsFin: 0, imageNoireTete: 0 } } }));
    expect(ctl(seules, "IMAGE-image-figee").etat).toBe("reussi");
    expect(ctl(seules, "IMAGE-volume").etat).toBe("non-fait");
    expect(publiable(seules)).toBe(false);
  });
  it("le contrôleur importe la netteté du tutoriel et ne réécrit aucune règle de mesure", () => {
    const t = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/controleur.ts", "utf8");
    expect(t).toContain("controlerNettete");
    for (const interdit of ["ssim", "SEUIL_SSIM_ZONE", "freezedetect", "blackdetect", "ffmpeg", "mesures-video"]) expect(t.toLowerCase()).not.toContain(interdit.toLowerCase());
  });
});

describe("verdicts et résumé pour Williams", () => {
  it("fusionnerVerdicts garde tous les contrôles ; un échec suffit à bloquer", () => {
    const a = controlerApresCalage(calage({ navigation: nav({ figees: [] }) }));
    const b = controlerApresCalage(calage({ dureeVoixMs: 70000 }));
    const f = fusionnerVerdicts(a, b);
    expect(f.controles).toHaveLength(a.controles.length + b.controles.length);
    expect(f.verdict).toBe("bloque");
  });
  it("le résumé ne contient aucun identifiant technique", () => {
    const { p, i } = avecPhrase("Vous voyez 12 commandes en retard.");
    const bloque = controlerAvantValidation(avant({ proposition: proposition(p), donnees, textesMaquette: maquette(p.length, { 0: ["12 commandes (exemple)"] }), couleurs: ["#1E6FD9"] }));
    const v = fusionnerVerdicts(bloque, controlerApresCalage(calage({ dureeVoixMs: 70000 })), controlerVideoEssai(essai()));
    const t = resumePourWilliams(v);
    expect(t).toContain(`La phrase ${i + 1} dit « 12 commandes » mais l'écran ne le montre pas à ce moment-là.`);
    expect(t).not.toMatch(/TUT-|MARQUE-|IMAGE-/);
    expect(resumePourWilliams(controlerAvantValidation(avant()))).toBe("Tout est en ordre.");
  });
  it("aucune constante de durée propre, aucun appel, aucun service", () => {
    const t = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/controleur.ts", "utf8");
    expect(t).toContain("DUREE_CIBLE_SEC");
    expect(t).not.toMatch(/DUREE_M(IN|AX)_SEC/);
    for (const interdit of ["@/services", "@/fournisseurs", "node:fs", "fetch(", "Date.now", "reglages"]) expect(t).not.toContain(interdit);
  });
});
