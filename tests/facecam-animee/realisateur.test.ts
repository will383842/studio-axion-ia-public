/**
 * FACE CAMÉRA ANIMÉE — LOT C « Réalisateur » : contrat du plan (champs optionnels du 14/10 et motions du 15/10, anciens
 * plans toujours valides), contrôles du plan (un cas rouge par règle, message vérifié — dont le cahier « perfection » :
 * littéralité, mini-vidéos, cadrage, densité, variété), règles fixes sur une vraie prise (IMG_7747), déroulé `realiser`
 * avec un faux Claude (essais guidés par les erreurs, version simple), bruitages dérivés du plan (aucune musique),
 * sous-titres, identité de la liste d'icônes avec le rendu. AUCUN appel réseau, aucun rendu.
 * Les règles de diversité R1 à R7 (retour de Will sur la vidéo 5) ont leurs propres cas dans `diversite.test.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { CADRAGE_FENETRE_DEFAUT, PRISE_DEFAUTS, schemaPlanFacecamAnimee, type MotionPlan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { MENTION_PLAFOND_FACECAM_ANIMEE } from "@/moteurs/montage-facecam-animee";
import { ICONES_AUTORISEES } from "@/moteurs/montage-facecam-animee/realisateur/icones";
import { historiqueDuPlan, objetsDuPlan, premierObjet, SEUILS, titreAbstrait, verifierPlan, type HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { MESURE_RYTHME, rythmePrevu, SURFACE_SOUS_ELEMENT_DEFAUT, surfaceSousElement } from "@/moteurs/montage-facecam-animee/realisateur/rythme";
import { bruitagesDuPlan, popsCarte, SONS_DISPONIBLES, ticsCompteur } from "@/moteurs/montage-facecam-animee/realisateur/sons";
import { estPetitMot, groupesSousTitres } from "@/moteurs/montage-facecam-animee/realisateur/sous-titres";
import { MOTS, planValide } from "./plan-reference";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { nombresDits, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import {
  assemblerPlan,
  debutFin,
  realiserParRegles,
  PHRASE_REALISATEUR_PANNE,
  PHRASE_REALISATEUR_REFUSE,
  realiser,
  type EntreeRealisateur,
  type RequeteRealisateur,
  type ReponseRealisateur,
} from "@/moteurs/montage-facecam-animee/realisateur";

const FIXTURE = fileURLToPath(new URL("./fixtures/mots-img7747.json", import.meta.url));
const MOTS_7747: MotTranscrit[] = JSON.parse(readFileSync(FIXTURE, "utf8"));

/* Mini-vidéo synthétique de 22 s et plan de référence (12 apparitions de 12 familles) : `plan-reference.ts`. */
const copie = (p: PlanFacecamAnimee) => JSON.parse(JSON.stringify(p)) as PlanFacecamAnimee;
function avec(modifier: (p: PlanFacecamAnimee) => void, historique?: HistoriqueVideo[]) {
  const p = copie(planValide());
  modifier(p);
  return verifierPlan(p, MOTS, { historique });
}
const contient = (liste: string[], morceau: string) => expect(liste.some((e) => e.includes(morceau)), `attendu « ${morceau} » dans :\n${liste.join("\n")}`).toBe(true);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cas rouges : accès libre au contenu d'une motion
const motion = (p: PlanFacecamAnimee, k: number) => p.motions![k] as MotionPlan & { contenu: Record<string, any> };

/* ---------------- Contrat du plan ---------------- */

describe("réalisateur · contrat du plan (champs optionnels du 14/10, motions du 15/10, version inchangée)", () => {
  it("un ancien plan (sans les nouveaux champs ni motions, mouvement à 1,4) reste valide", () => {
    const ancien = copie(planValide());
    for (const c of ancien.cartes) delete c.illustre;
    for (const f of ancien.fenetres) delete f.illustre;
    delete ancien.motions;
    ancien.mouvements = [{ debut: 7.65, fin: 8.55, type: "recul", echelle: 1.4 }];
    expect(schemaPlanFacecamAnimee.safeParse(ancien).success).toBe(true);
    expect(ancien.version).toBe("plan-facecam-animee/1");
  });

  it("le vrai plan rendu de la vidéo 1 passe toujours le schéma (s'il est présent sur ce poste)", () => {
    const chemin = "<dossier utilisateur>/AppData/Local/Temp/claude/<projet-local>-Documents-Projets-Axion-IA/55133bef-9581-493b-a484-fae7fb25910a/scratchpad/realisateur-essai/plan-rendu.json";
    if (!existsSync(chemin)) return;
    expect(schemaPlanFacecamAnimee.safeParse(JSON.parse(readFileSync(chemin, "utf8"))).success).toBe(true);
  });

  it("les 6 champs optionnels : prise.centreX, prise.largeurVisage, fenetres[].depuisSec, fenetres[].illustre, cartes[].illustre, mouvements[].echelle ≤ 1,5", () => {
    const p = copie(planValide());
    p.prise = { ...p.prise, centreX: 0.46, largeurVisage: 0.38 };
    p.fenetres[0].depuisSec = 1.5;
    p.mouvements = [
      { debut: 7.65, fin: 8.55, type: "recul", echelle: 1.4 },
      { debut: 18.45, fin: 19.3, type: "decale-droite", echelle: 1.5 },
    ];
    expect(schemaPlanFacecamAnimee.safeParse(p).success).toBe(true);
    const refuse = (m: (x: PlanFacecamAnimee) => void) => {
      const x = copie(p);
      m(x);
      return schemaPlanFacecamAnimee.safeParse(x).success;
    };
    expect(refuse((x) => (x.prise.centreX = 0.95))).toBe(false);
    expect(refuse((x) => (x.prise.largeurVisage = 0.1))).toBe(false);
    expect(refuse((x) => (x.fenetres[0].depuisSec = -1))).toBe(false);
    expect(refuse((x) => (x.fenetres[0].illustre = "x".repeat(61)))).toBe(false);
    expect(refuse((x) => (x.cartes[0].illustre = "x".repeat(61)))).toBe(false);
    expect(refuse((x) => (x.mouvements![0].echelle = 1.51))).toBe(false);
    expect(PRISE_DEFAUTS).toMatchObject({ centreX: 0.5, largeurVisage: 0.38 });
    expect(CADRAGE_FENETRE_DEFAUT).toBe("sur-le-visage");
  });

  it("motions : famille connue, contenu validé PAR FAMILLE (champs en plus tolérés pour le rendu)", () => {
    const refuse = (m: (x: PlanFacecamAnimee) => void) => {
      const x = copie(planValide());
      m(x);
      return schemaPlanFacecamAnimee.safeParse(x);
    };
    expect(refuse(() => undefined).success).toBe(true);
    expect(refuse((x) => (motion(x, 0).contenu.reglageDuRendu = 3)).success).toBe(true);
    expect(refuse((x) => ((x.motions![0] as { famille: string }).famille = "confettis")).success).toBe(false);
    const sansTraits = refuse((x) => delete motion(x, 0).contenu.traits);
    expect(sansTraits.success).toBe(false);
    expect(JSON.stringify(sansTraits.error?.issues)).toContain("trait-dessine");
    expect(refuse((x) => (motion(x, 7).contenu.niveaux[0].niveau = 1.5)).success).toBe(false);
    expect(refuse((x) => (motion(x, 2).contenu.valeur = "45")).success).toBe(false);
  });

  it("assemblerPlan transmet prise.centreX et prise.largeurVisage quand ils sont fournis, rien sinon ; les motions seulement s'il y en a", () => {
    const scene = { cartes: [], fenetres: [], calques: [], zooms: [] as [number, number, number][] };
    const avecVisage = assemblerPlan({ ...ENTREE_MINI, prise: { src: "prise-large.mp4", finSec: 20, centreX: 0.46, largeurVisage: 0.38 } }, scene);
    expect(avecVisage.prise).toEqual({ src: "prise-large.mp4", finSec: 20, centreX: 0.46, largeurVisage: 0.38 });
    expect(assemblerPlan(ENTREE_MINI, scene).prise).toEqual({ src: "prise.mp4", finSec: 20 });
    expect("motions" in assemblerPlan(ENTREE_MINI, { ...scene, motions: [] })).toBe(false);
    const avecMotions = assemblerPlan(ENTREE_MINI, { ...scene, motions: planValide().motions });
    expect(avecMotions.motions).toEqual(planValide().motions);
    // Les bruitages du code suivent les motions (le son propre de chaque famille).
    expect(avecMotions.sons.some(([, s]) => s === "tick_004")).toBe(true);
  });
});

/* ---------------- Contrôles ---------------- */

describe("réalisateur · verifierPlan (une règle = un cas rouge)", () => {
  it("le plan de référence passe sans erreur ni avertissement", () => {
    const r = verifierPlan(planValide(), MOTS);
    expect(r.erreurs).toEqual([]);
    expect(r.avertissements).toEqual([]);
    expect(r.rendable).toBe(true);
    expect(r.mesures).toMatchObject({ ruptures: 12, cartes: 1, fenetres: 1, calques: 1, motions: 9, zooms: 0, mouvements: 0, trousPrevus: 0, typesCartes: ["liste"], fenetresVideo: 1, partFenetresVideo: 1, partSurLeVisage: 0, partFenetresEnchainees: 1 });
    expect(r.mesures.grosMouvementsParMinute).toBeGreaterThanOrEqual(SEUILS.grosMouvementsParMinuteVise);
    expect(r.mesures.diversite).toMatchObject({ apparitions: 12, nombreFamilles: 12, famillesNouvelles: 9, repetitionMax: 1, memeFamilleDeSuite: 0, premierObjetSec: 0.8, premiereCouvertureVisageSec: 13.5, premiereCarteSec: 8.95 });
  });

  it("forme : schéma zod", () => {
    const r = avec((p) => ((p as { version: string }).version = "plan/0"));
    contient(r.erreurs, "Forme : version");
    expect(r.rendable).toBe(false);
  });

  it("instants dans la vidéo, début avant fin", () => {
    contient(avec((p) => (p.calques[0].fin = 30)).erreurs, "sort de la vidéo");
    contient(avec((p) => Object.assign(p.fenetres[0], { debut: 7.6, fin: 6.5 })).erreurs, "Fenêtre 1 : le début (7,60 s) doit précéder la fin (6,50 s).");
  });

  it("sous-élément hors de son objet", () => {
    const r = avec((p) => p.cartes[0].contenu.type === "liste" && (p.cartes[0].contenu.lignes[2].a = 7.0));
    contient(r.erreurs, "Carte 1 (liste) : contenu.lignes[2].a à 7,00 s tombe hors de l'objet (8,95 s → 11,60 s).");
    contient(avec((p) => (motion(p, 3).contenu.lignes[2].a = 9.5)).erreurs, "Motion 4 (telephone) : contenu.lignes[2].a à 9,50 s tombe hors de l'objet (7,50 s → 8,85 s).");
  });

  it("ancrage : ± 0,15 s du début d'un mot (cartes et motions)", () => {
    const r = avec((p) => p.cartes[0].contenu.type === "liste" && (p.cartes[0].contenu.lignes[1].a = 9.75));
    contient(r.erreurs, "Carte 1 (liste) : contenu.lignes[1].a à 9,75 s ne tombe sur aucun début de mot (le plus proche : « équipe » à 9,50 s, écart 0,25 s) ; tolérance 0,15 s.");
    contient(avec((p) => (motion(p, 1).contenu.reperes[0].a = 3.25)).erreurs, "Motion 2 (horloge) : contenu.reperes[0].a à 3,25 s ne tombe sur aucun début de mot");
  });

  it("durées : carte 1,5 à 6,5 s, fenêtre 1 à 3 s, calque 0,8 à 4 s, motion 0,6 à 4 s", () => {
    contient(avec((p) => (p.calques[0].fin = 4.3)).erreurs, "Calque 1 (étiquette) : dure 0,30 s ; un calque dure de 0,80 s à 4,00 s.");
    contient(avec((p) => (p.fenetres[0].debut = 4.2)).erreurs, "Fenêtre 1 : dure 3,20 s ; une fenêtre dure de 1,00 s à 3,00 s.");
    contient(avec((p) => (p.cartes[0].fin = 15.65)).erreurs, "Carte 1 (liste) : dure 6,70 s ; une carte dure de 1,50 s à 6,50 s.");
    contient(avec((p) => (motion(p, 5).fin = 13.9)).erreurs, "Motion 6 (mot-geant) : dure 0,40 s ; une motion dure de 0,60 s à 4,00 s.");
  });

  it("jamais deux cartes, ni une carte et une fenêtre, ni deux fenêtres en même temps", () => {
    contient(avec((p) => p.cartes.push({ ...copie(planValide()).cartes[0], debut: 9.4, entree: "glisse" })).erreurs, "carte 1 (liste) et carte 2 (liste) sont à l'écran en même temps (jamais deux cartes à la fois).");
    contient(avec((p) => Object.assign(p.fenetres[0], { debut: 9.0, fin: 10.2 })).erreurs, "jamais une carte et une fenêtre à la fois");
    contient(avec((p) => p.fenetres.push({ ...p.fenetres[0], debut: 6.5, fin: 7.5 })).erreurs, "fenêtre 1 et fenêtre 2 sont à l'écran en même temps (jamais deux fenêtres à la fois).");
  });

  it("jamais deux calques en même temps (aligné sur le rendu, qui couperait le premier)", () => {
    contient(avec((p) => p.calques.push({ ...p.calques[0], debut: p.calques[0].debut + 0.3, fin: p.calques[0].fin + 0.3 })).erreurs, "jamais deux calques à la fois");
    expect(avec(() => undefined).erreurs.some((e) => e.includes("jamais deux calques"))).toBe(false);
  });

  it("une motion est seule à l'écran ; le trait dessiné peut accompagner ce qui ne couvre pas le visage", () => {
    contient(avec((p) => (motion(p, 3).debut = 7.3)).erreurs, "Motion 4 (telephone) et fenêtre 1 sont à l'écran en même temps : une motion est seule à l'écran");
    // Un trait dessiné sur le sous-titre pendant la carte : permis.
    const traitSurCarte = avec((p) => p.motions!.push({ debut: 9.4, fin: 10.6, famille: "trait-dessine", illustre: "équipe dossier", contenu: { forme: "encadre", traits: [{ mot: "équipe", a: 9.5 }, { mot: "dossier", a: 10.0 }] } }));
    expect(traitSurCarte.erreurs.some((e) => e.includes("sont à l'écran en même temps"))).toBe(false);
    // … mais jamais pendant un objet qui couvre le visage.
    contient(avec((p) => p.motions!.push({ debut: 13.6, fin: 14.25, famille: "trait-dessine", illustre: "tableau", contenu: { forme: "encadre", traits: [{ mot: "tableau", a: 14.0 }] } })).erreurs, "sont à l'écran en même temps : une motion est seule à l'écran");
  });

  it("bande : 8 à 35 % du temps (5 cartes au plus pour 90 s depuis les règles de diversité)", () => {
    expect([SEUILS.bande.min, SEUILS.bande.max]).toEqual([8, 35]);
    contient(avec((p) => p.cartes.pop()).erreurs, "Bande à l'écran 0,0 % du temps : il faut entre 8 et 35 %");
  });

  it("rythme : une rupture forte (entrée d'objet) toutes les 2,8 s en moyenne au plus", () => {
    const r = avec((p) => {
      p.calques = [];
      p.fenetres = [];
      p.motions = [];
    });
    contient(r.erreurs, "Rythme trop lent : 1 ruptures fortes");
    contient(r.erreurs, "il en faut au moins 8 (une toutes les 2,8 s");
  });

  it("aucun trou de plus de 0,7 s sans changement VISIBLE, compté comme la mesure (revue passe 3 du 15/10)", () => {
    expect(SEUILS.trouMaxSec).toBe(0.7);
    // Sans sous-titres, une étiquette de 0,9 s sans rien dedans : de son entrée à sa sortie, rien ne se voit.
    const r = avec((p) => {
      p.groupes = [];
      if (p.calques[0].type === "etiquette") delete p.calques[0].icones;
    });
    // (la sortie de l'étiquette et l'entrée du chiffre qui suit forment un seul pic, à 4,96 s)
    contient(r.erreurs, "Trou de 0,96 s sans changement VISIBLE entre 4,04 s et 5,00 s");
    // L'ouverture calme (sous-titres seuls avant 0,8 s, R1a) n'est pas un trou.
    expect(avec((p) => (p.groupes = [])).erreurs.some((e) => e.includes("entre 0,00 s"))).toBe(false);
  });

  it("énergie comptée comme la mesure : 85 gros mouvements par minute au moins, 90 visés (revue passe 3 du 15/10)", () => {
    expect([SEUILS.grosMouvementsParMinuteMin, SEUILS.grosMouvementsParMinuteVise]).toEqual([85, 90]);
    const r = avec((p) => (p.motions = p.motions!.filter((m) => m.famille === "trait-dessine" || m.famille === "bulles")));
    contient(r.erreurs, "Énergie trop basse : ");
    contient(r.erreurs, "il en faut 85 au moins (visez 90");
    contient(r.erreurs, "Passages les plus calmes : ");
  });

  it("décision de Will du 15/10 : tout zoom coupé et tout mouvement de cadrage sont REFUSÉS", () => {
    expect(SEUILS.zoomsAutorises).toBe(false);
    contient(avec((p) => p.zooms.push([1.0, 1.5, 1.2])).erreurs, "Zoom 1 (1,00 s → 1,50 s) : INTERDIT — Will a décidé le 15/10 de supprimer tout zoom");
    contient(avec((p) => (p.mouvements = [{ debut: 7.65, fin: 8.55, type: "recul", echelle: 1.4 }])).erreurs, "Mouvement 1 (recul) (7,65 s → 8,55 s) : INTERDIT");
    contient(avec((p) => p.zooms.push([0, 0.5, 1])).erreurs, "« zooms » doit rester vide []");
    expect(verifierPlan(planValide(), MOTS).erreurs).toEqual([]);
  });

  it("visage seul : une apparition (motion ou calque) au moins toutes les 3 s", () => {
    const r = avec((p) => (p.motions = p.motions!.filter((m) => m.debut < 11 || m.debut > 16)));
    contient(r.erreurs, "Aucune apparition (motion, étiquette, compteur…) entre 11,60 s et 16,50 s (4,90 s de visage seul");
  });

  /* ---- Littéralité ---- */

  it("littéralité : une fenêtre, une carte ou une motion sans « illustre » est refusée", () => {
    contient(avec((p) => delete p.fenetres[0].illustre).erreurs, "Fenêtre 1 : « illustre » manquant");
    contient(avec((p) => delete p.cartes[0].illustre).erreurs, "Carte 1 (liste) : « illustre » manquant");
    contient(avec((p) => delete p.motions![0].illustre).erreurs, "Motion 1 (trait-dessine) : « illustre » manquant");
  });

  it("littéralité : « illustre » recopie des mots dits pendant l'objet", () => {
    contient(avec((p) => (p.fenetres[0].illustre = "robinet qui fuit")).erreurs, "Fenêtre 1 : « illustre » (« robinet qui fuit ») contient « robinet », « fuit », jamais dit entre 4,00 s et 8,40 s");
  });

  it("littéralité : une motion montre les mots DE Will (mot géant, ruban, téléphone, trait, chiffre)", () => {
    contient(avec((p) => (motion(p, 5).contenu.mots[0].texte = "Miracle")).erreurs, "Motion 6 (mot-geant) : « Miracle » n'est pas dit");
    contient(avec((p) => (motion(p, 0).contenu.traits[0].mot = "matin")).erreurs, "Motion 1 (trait-dessine) : le trait entoure « matin » à 1,00 s, mais ce mot n'est pas dit à cet instant");
    contient(avec((p) => (motion(p, 2).contenu.valeur = 30)).erreurs, "Motion 3 (chiffre-eclate) : le nombre 30 doit être prononcé par Will au moment où il éclate");
    contient(avec((p) => (motion(p, 3).contenu.lignes[0].texte = "Tablette")).erreurs, "Motion 4 (telephone) : « Tablette » n'est pas dit");
  });

  it("littéralité : la recherche décrit une scène (sujet + action + lieu)", () => {
    contient(avec((p) => (p.fenetres[0].recherche = "paperasse")).erreurs, "Fenêtre 1 : recherche « paperasse » trop vague ; décrivez la scène concrète, sujet + action + lieu");
    const r = avec((p) => (p.fenetres[0].recherche = "robinet qui fuit dans une cuisine"));
    contient(r.erreurs, "Fenêtre 1 : la recherche « robinet qui fuit dans une cuisine » ne reprend aucun mot de ce qu'elle illustre");
    contient(r.erreurs, "montre une MÉTAPHORE (goutte ou robinet)");
  });

  it("littéralité : titre de carte = nom de la chose, jamais une phrase abstraite", () => {
    contient(avec((p) => (p.cartes[0].titre = "Ou peut-être")).erreurs, "Carte 1 (liste) : titre « Ou peut-être » abstrait");
    contient(avec((p) => (p.cartes[0].titre = "Partout, le même réflexe")).erreurs, "titre « Partout, le même réflexe » abstrait");
    expect(["Boîte mail", "Agenda du dirigeant", "Carnet de commandes", "3 questions"].some(titreAbstrait)).toBe(false);
  });

  it("littéralité : une carte liste ne recopie pas plus de 50 % des mots dits pendant qu'elle est là", () => {
    const r = avec((p) => {
      if (p.cartes[0].contenu.type !== "liste") return;
      p.cartes[0].contenu.lignes[0].texte = "Réunion de l'équipe";
      p.cartes[0].contenu.lignes[2].texte = "Dossier du contrat";
      p.cartes[0].contenu.lignes[4].texte = "Signature du carnet";
    });
    contient(r.erreurs, "Carte 1 (liste) : recopie");
    contient(r.erreurs, "dans des bouts de phrase de 3 mots ou plus) ; 50 % au plus");
  });

  /* ---- Mini-vidéos ---- */

  it("mini-vidéos : une fenêtre toutes les 20 s au moins (6 au plus pour 90 s, R4b)", () => {
    contient(avec((p) => p.fenetres.pop()).erreurs, "Seulement 0 fenêtre pour 20,00 s : il en faut au moins 1 (une toutes les 20 s au pire");
  });

  it("mini-vidéos : 60 % de vidéos au moins", () => {
    contient(avec((p) => delete p.fenetres[0].video).erreurs, "Fenêtres vidéo : 0 sur 1 (0 %) ; il en faut 60 % au moins");
  });

  it("mini-vidéos : la MOITIÉ AU PLUS « sur-le-visage » (R4d, le défaut quand absent)", () => {
    contient(avec((p) => (p.fenetres[0].cadrage = "sur-le-visage")).erreurs, "R4d — 1 fenêtres sur 1 posées « sur-le-visage » ; la moitié au plus");
    contient(avec((p) => delete p.fenetres[0].cadrage).erreurs, "R4d — 1 fenêtres sur 1 posées « sur-le-visage »");
    contient(avec((p) => (p.fenetres[0].etiquette = { texte: "Camion", a: 7.0 })).erreurs, "R4d — 1 fenêtres sur 1 portent une étiquette ; la moitié au plus.");
  });

  it("mini-vidéos : la moitié au moins enchaînées ≤ 0,3 s après une carte, une fenêtre ou une motion", () => {
    contient(avec((p) => (p.fenetres[0].debut = 6.3)).erreurs, "Fenêtres enchaînées : 0 % ; il en faut 50 % au moins qui entrent 0 à 0,3 s après la sortie d'une carte, d'une autre fenêtre ou d'une motion (non enchaînées : 1).");
  });

  /* ---- Variété ---- */

  it("variété : même type ou même entrée deux fois de suite", () => {
    const carte2 = (type: "liste" | "frise", entree: "chute" | "glisse") => (p: PlanFacecamAnimee) => {
      p.motions = p.motions!.filter((m) => m.famille !== "pile-notifications");
      p.cartes.push({
        debut: 11.95, fin: 13.4, titre: "Carnet de commandes", illustre: "commandes stock planning", icone: "dossier", entree,
        contenu: type === "liste" ? { type, lignes: [{ texte: "Commandes", icone: "dossier", a: 12.0 }, { texte: "Stock", icone: "dossier", a: 12.5 }, { texte: "Planning", icone: "calendrier", a: 13.0 }] } : { type, etapes: [{ texte: "Commandes", icone: "dossier", a: 12.0 }, { texte: "Stock", icone: "dossier", a: 12.5 }, { texte: "Planning", icone: "calendrier", a: 13.0 }] },
      });
    };
    contient(avec(carte2("liste", "glisse")).erreurs, "Cartes 1 et 2 : même type « liste » deux fois de suite.");
    contient(avec(carte2("liste", "glisse")).erreurs, "R4c — contenu de carte « liste » utilisé 2 fois");
    contient(avec(carte2("frise", "chute")).erreurs, "Cartes 1 et 2 : même entrée « chute » deux fois de suite.");
  });

  it("variété : 4 types au moins au-delà de 60 s", () => {
    contient(avec((p) => (p.duree = 70)).erreurs, "Seulement 1 type de cartes (liste) : il en faut au moins 4 pour une vidéo de plus de 60 s.");
  });

  it("variété : jamais la même ouverture que la vidéo précédente ; suites, médias et familles déjà vus", () => {
    expect(premierObjet(planValide())).toBe("motion:trait-dessine");
    contient(avec(() => {}, [{ types: [], entrees: [], premier: "motion:trait-dessine" }]).erreurs, "Le premier objet (motion:trait-dessine) est le même que celui de la vidéo précédente");
    const hier = historiqueDuPlan(planValide(), "Vidéo d'hier");
    expect(hier).toMatchObject({ titre: "Vidéo d'hier", types: ["liste"], entrees: ["chute"], premier: "motion:trait-dessine" });
    expect(hier.familles).toEqual(["trait-dessine", "horloge", "etiquette", "chiffre-eclate", "fenetre", "telephone", "carte", "pile-notifications", "mot-geant", "ruban", "jauge", "bulles"]);
    expect(hier.comptesTypes).toMatchObject({ "carte:liste": 1, "fenetre:video": 1, "etiquette:etiquette": 1, "horloge:horloge": 1 });
    expect(hier.echelles).toBeUndefined();
    // La même vidéo deux fois : même ouverture (R7a), mêmes enchaînements (R7b), aucune famille nouvelle (R7c).
    const r = verifierPlan(planValide(), MOTS, { historique: [{ ...hier, premier: "carte:liste" }] });
    contient(r.erreurs, "R7a — la vidéo commence par « trait-dessine » comme la vidéo « Vidéo d'hier »");
    contient(r.erreurs, "R7b — les 20 premières secondes reprennent 100 % des enchaînements de la vidéo « Vidéo d'hier »");
    contient(r.erreurs, "R7c — 0 famille absente de la vidéo précédente");
    contient(r.avertissements, "Recherche « artisan qui charge un camion sur un chantier » déjà utilisée dans la vidéo « Vidéo d'hier »");
  });

  /* ---- Niveaux ---- */

  it("niveaux : 3 sous-éléments datés par carte", () => {
    const r = avec((p) => {
      if (p.cartes[0].contenu.type !== "liste") return;
      p.cartes[0].contenu.lignes.splice(2);
    });
    contient(r.erreurs, "Carte 1 (liste) : 2 sous-éléments datés ; il en faut au moins 3");
  });

  it("frise : une puce au plus par étape (deux débordent de la carte au rendu)", () => {
    const frise = (puces: { etape: number; texte: string; a: number }[]) => (p: PlanFacecamAnimee) => {
      p.cartes[0].contenu = { type: "frise", etapes: [{ texte: "Réunion", icone: "utilisateurs", a: 9.0 }, { texte: "Dossier", icone: "dossier", a: 10.0 }, { texte: "Signature", icone: "document", a: 11.0 }], puces };
    };
    contient(avec(frise([{ etape: 0, texte: "Équipe", a: 9.5 }, { etape: 0, texte: "Contrat", a: 10.5 }])).erreurs, "Carte 1 (frise) : 2 puces sur l'étape 1 ; 1 au plus par étape");
    expect(avec(frise([{ etape: 0, texte: "Équipe", a: 9.5 }, { etape: 1, texte: "Contrat", a: 10.5 }])).erreurs.filter((e) => e.includes("puces sur l'étape"))).toEqual([]);
  });

  it("carte jamais vide : 1er sous-élément ≤ 0,2 s après l'entrée (revue passe 2 du 15/10)", () => {
    expect(SEUILS.carteVideMaxSec).toBe(0.2);
    contient(avec((p) => (p.cartes[0].debut = 8.7)).erreurs, "Carte 1 (liste) : reste vide 0,30 s après son entrée (8,70 s) ; son premier sous-élément doit arriver 0,20 s au plus après le début.");
  });

  it("carte jamais immobile : ≤ 0,8 s entre deux sous-éléments (avertissement au-delà de 0,7 s ; revue passe 2 du 15/10)", () => {
    expect([SEUILS.carteImmobileMaxSec, SEUILS.carteImmobileConseilSec]).toEqual([0.8, 0.7]);
    contient(avec((p) => p.cartes[0].contenu.type === "liste" && p.cartes[0].contenu.lignes.splice(2, 1)).erreurs, "Carte 1 (liste) : immobile 1,00 s entre deux sous-éléments (9,50 s → 10,50 s) ; 0,80 s au plus.");
    const w = avec((p) => {
      if (p.cartes[0].contenu.type !== "liste") return;
      p.cartes[0].contenu.lignes[2].a = 9.86;
      p.cartes[0].contenu.lignes[3].a = 10.64;
    });
    contient(w.avertissements, "Carte 1 (liste) : immobile 0,78 s entre deux sous-éléments (9,86 s → 10,64 s) ; viser 0,70 s au plus.");
  });

  /* ---- Textes ---- */

  it("textes interdits d'Axion-IA", () => {
    contient(avec((p) => (p.cartes[0].titre = "Formation à Villeexemple")).erreurs, "Carte 1 (liste) : texte interdit « Villeexemple » dans titre (« Formation à Villeexemple »).");
    const r = avec((p) => p.calques[0].type === "etiquette" && (p.calques[0].texte = "Organisme certifié Certifexemple"));
    contient(r.erreurs, "texte interdit « Certifexemple »");
    contient(r.erreurs, "texte interdit « certifié / certification »");
    contient(avec((p) => (p.fenetres[0].etiquette = { texte: "Aucun gain garanti", a: 7.0 })).erreurs, "texte interdit « gain garanti »");
    contient(avec((p) => (motion(p, 8).contenu.questions[1].texte = "Certifexemple ?")).erreurs, "Motion 9 (bulles) : texte interdit « Certifexemple »");
  });

  it("aucun chiffre affiché qui ne soit pas dit (sauf numéro de carte et proportions)", () => {
    contient(avec((p) => p.calques[0].type === "etiquette" && (p.calques[0].texte = "30 % de temps")).erreurs, "Calque 1 (étiquette) : le chiffre 30 affiché dans texte (« 30 % de temps ») n'est jamais dit dans la vidéo.");
    contient(avec((p) => (p.calques[0] = { type: "compteur", debut: 4.0, fin: 4.9, de: 0, a: 50 })).erreurs, "Calque 1 (compteur) : le nombre 50 affiché (a) n'est jamais dit dans la vidéo.");
    contient(avec((p) => (motion(p, 2).contenu.valeur = 50)).erreurs, "Motion 3 (chiffre-eclate) : le nombre 50 affiché (contenu.valeur) n'est jamais dit dans la vidéo.");
    // « 45 » est dit ; « 1/1 » est le numéro de la carte ; le niveau d'une jauge n'est pas un chiffre affiché.
    expect(avec((p) => (p.cartes[0].titre = "45 min · 1/1")).erreurs).toEqual([]);
    expect(nombresDits([{ w: "quarante-cinq", a: 0, f: 1 }, { w: "deux", a: 1, f: 2 }, { w: "millions", a: 2, f: 3 }, { w: "troisième", a: 3, f: 4 }])).toEqual(new Set([45, 2, 2_000_000, 3]));
  });

  it("icônes de la liste autorisée seulement", () => {
    contient(avec((p) => (p.cartes[0].icone = "fusee")).erreurs, "Carte 1 (liste) : icône inconnue « fusee » (icone)");
    contient(avec((p) => (motion(p, 4).contenu.notifications[0].icone = "fusee")).erreurs, "Motion 5 (pile-notifications) : icône inconnue « fusee »");
    contient(avec((p) => (p.fin.tuiles = ["licorne"])).erreurs, "Écran de fin : icône inconnue « licorne »");
  });

  it("fin : jamais sur le dernier mot, et aucun objet ne la dépasse", () => {
    contient(avec((p) => (p.fin.debut = 19.0)).erreurs, "Écran de fin à 19,00 s : il coupe le dernier mot « devis. » (fini à 19,90 s)");
    contient(avec((p) => (p.fin.debut = 16.5)).erreurs, "Motion 9 (bulles) : se termine à 19,60 s, après le début de l'écran de fin (16,50 s).");
  });
});

/* ---------------- Rythme compté comme la mesure (revue passe 3 du 15/10, priorité 1) ---------------- */

describe("réalisateur · rythme prévu = mesure (`rythme.ts`, même calcul que dynamisme.py)", () => {
  const base = (): PlanFacecamAnimee => ({ ...copie(planValide()), groupes: [], cartes: [], fenetres: [], calques: [], motions: [], fin: { ...planValide().fin, debut: 9 }, duree: 10 });
  const gros = (p: PlanFacecamAnimee) => rythmePrevu(p).pics.filter((x) => x.gros >= 0.5);

  it("une étiquette au-dessus de la tête : la prise descend puis remonte (2 gros mouvements) ; enchaînée à 0,2 s d'une autre, la prise reste en bas", () => {
    const p = base();
    p.calques = [{ type: "etiquette", debut: 2, fin: 3, texte: "Devis" }];
    const g = gros(p).filter((x) => x.t < 8);
    expect(g.map((x) => x.quoi.join(" "))).toEqual([expect.stringContaining("descente de la prise (0.06 H)"), expect.stringContaining("remontée de la prise (0.06 H)")]);
    p.calques.push({ type: "etiquette", debut: 3.4, fin: 4.4, texte: "Relances" });
    expect(gros(p).filter((x) => x.t < 8).length).toBe(4);
    p.calques[1] = { ...p.calques[1], debut: 3.2, fin: 4.2 };
    expect(gros(p).filter((x) => x.t < 8).length).toBe(2);
  });

  it("une motion : son entrée, sa sortie et chaque élément sont comptés (la prise ne bouge pas)", () => {
    const p = base();
    p.motions = [{ debut: 2, fin: 3.5, famille: "telephone", contenu: { appli: "mail", lignes: [{ texte: "Devis", a: 2.5 }, { texte: "Relances", a: 3.0 }] } }];
    const g = gros(p).filter((x) => x.t < 8);
    expect(g.length).toBe(4);
    expect(g.some((x) => x.quoi.join(" ").includes("descente"))).toBe(false);
    expect(g.map((x) => x.quoi.join(" ")).join(" | ")).toContain("entrée motion 1 (telephone)");
  });

  it("surfaces : une ligne de liste ou une étape de frise est un gros mouvement, une puce, une coche ou un badge de frise ne se voient pas", () => {
    expect(surfaceSousElement("liste", "contenu.lignes[3].a")).toBeGreaterThan(MESURE_RYTHME.seuilGros);
    expect(surfaceSousElement("frise", "contenu.etapes[0].a")).toBeGreaterThan(MESURE_RYTHME.seuilGros);
    expect(surfaceSousElement("grille", "contenu.vignettes[1].a")).toBeGreaterThan(MESURE_RYTHME.seuilGros);
    for (const [t, c] of [["frise", "contenu.puces[0].a"], ["frise", "contenu.cocheA"], ["frise", "contenu.badge.a"]]) expect(surfaceSousElement(t, c)).toBeLessThan(MESURE_RYTHME.picSur);
    expect(surfaceSousElement("liste", "contenu.inconnu.a")).toBe(SURFACE_SOUS_ELEMENT_DEFAUT);
  });

  it("le temps sous une mini-vidéo, une horloge, un ruban, un compteur qui défile ou l'écran de fin ne fait pas de trou ; une photo, si", () => {
    const p = base();
    p.fenetres = [{ debut: 1, fin: 3.5, media: "f", recherche: "artisan qui charge un camion", video: true }];
    expect(rythmePrevu(p).trous.filter(([d, a]) => d > 0.7 && a >= 1 && a < 3.4)).toEqual([]);
    delete p.fenetres[0].video;
    expect(rythmePrevu(p).trous.some(([d, a]) => d > 0.7 && a >= 1 && a < 3.4)).toBe(true);
    p.fenetres = [];
    p.motions = [{ debut: 1, fin: 3.5, famille: "horloge", contenu: { mode: "horloge", a: 1.5 } }];
    expect(rythmePrevu(p).trous.filter(([d, a]) => d > 0.7 && a >= 1 && a < 3.4)).toEqual([]);
  });

  it("le plan de référence et le contrôle parlent de la même chose : même nombre de gros mouvements que les mesures", () => {
    const r = verifierPlan(planValide(), MOTS);
    expect(r.mesures.grosMouvementsParMinute).toBe(rythmePrevu(planValide()).grosParMinute);
    expect(r.mesures.plusLongTrouSec).toBe(rythmePrevu(planValide()).plusLongTrouSec);
  });

  // ÉTALONNAGE sur les vrais plans rendus (s'ils sont présents sur ce poste) : la mesure `dynamisme.py` de la vidéo 3 a
  // donné 64,5 gros mouvements par minute et un trou de 1,12 s (42,52 s) ; la vidéo 4, 58,1 et 1,20 s (63,36 s).
  const ESSAIS = "<dossier utilisateur>/AppData/Local/Temp/claude/<projet-local>-Documents-Projets-Axion-IA/55133bef-9581-493b-a484-fae7fb25910a/scratchpad";
  for (const [nom, dossier, grosMesure, trouMesure, debutTrou] of [
    ["vidéo 3", "realisateur-essai-3", 64.5, 1.12, 42.52],
    ["vidéo 4", "realisateur-essai-4", 58.1, 1.2, 63.36],
  ] as const) {
    const fichier = `${ESSAIS}/${dossier}/plan-rendu.json`;
    it.skipIf(!existsSync(fichier))(`étalonnage ${nom} : gros mouvements à ± 10 % de la mesure, et le trou mesuré retrouvé au même endroit`, () => {
      const r = rythmePrevu(JSON.parse(readFileSync(fichier, "utf8")));
      expect(Math.abs(r.grosParMinute - grosMesure) / grosMesure).toBeLessThanOrEqual(0.1);
      const trou = r.trous.find(([, a]) => Math.abs(a - debutTrou) <= 0.12);
      expect(trou).toBeDefined();
      expect(Math.abs(trou![0] - trouMesure) / trouMesure).toBeLessThanOrEqual(0.1);
    });
  }
});

/* ---------------- Règles fixes sur une vraie prise ---------------- */

const ENTREE_7747: EntreeRealisateur = {
  mots: MOTS_7747,
  dureeSec: 93,
  titre: "Le diagnostic fuite",
  prise: { src: "prise.mp4", finSec: 91.1 },
  fin: { marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["former", "boussole", "loupe", "eclair"], appel: "Le lien en commentaire" },
};
/** Les règles fixes essaient plusieurs variantes puis reprennent la meilleure : quelques secondes par vidéo. */
const LONG = 60_000;

/** L'ancienne version simple (règles fixes, ancien catalogue) : `realiser` ne l'appelle plus depuis le Lot I (repli = plan v4 minimal) ; le code reste testé. */
function reglesFixes(entree: EntreeRealisateur) {
  const scene = realiserParRegles({ mots: entree.mots, dureeSec: entree.dureeSec, finDebut: debutFin(entree), motCle: entree.fin.motCle, historique: entree.historique, prise: entree.prise });
  const plan = assemblerPlan(entree, scene);
  const v = verifierPlan(plan, entree.mots, { historique: entree.historique });
  return { plan, version: "simple" as const, essais: 0, ...(v.erreurs.length ? { erreurs: v.erreurs } : {}), avertissements: v.avertissements, mesures: v.mesures, rendable: v.rendable };
}

describe("réalisateur · règles fixes de l'ancien catalogue (plus appelées par realiser depuis le Lot I) sur IMG_7747", () => {
  it(
    "plan valide, 0 erreur : 15 familles qui tournent, ouverture sur le visage entier, toutes les cibles du cahier « perfection » tenues",
    async () => {
      const r = reglesFixes(ENTREE_7747);
      expect(r.version).toBe("simple");
      expect(r.essais).toBe(0);
      expect(r.erreurs).toBeUndefined();
      expect(r.rendable).toBe(true);
      expect(schemaPlanFacecamAnimee.safeParse(r.plan).success).toBe(true);
      const v = verifierPlan(r.plan, MOTS_7747);
      expect(v.erreurs).toEqual([]);
      // Seul conseil toléré : l'énergie « juste » (au-dessus du minimum de 85, sous les 90 visés).
      expect(v.avertissements.filter((x) => !x.startsWith("Énergie juste"))).toEqual([]);
      const m = v.mesures;
      const d = m.diversite;
      // Diversité (R1 à R5) : 10 familles au moins dont 6 motions, jamais deux fois la même de suite, 7 par minute.
      expect(d.nombreFamilles).toBeGreaterThanOrEqual(10);
      expect(d.famillesNouvelles).toBeGreaterThanOrEqual(6);
      expect(d.repetitionMax).toBe(1);
      expect(d.memeFamilleDeSuite).toBe(0);
      expect(d.partFamilleMax).toBeLessThanOrEqual(0.2);
      expect(d.famillesMinPar60s).toBeGreaterThanOrEqual(7);
      expect(d.famillesMinPar20s).toBeGreaterThanOrEqual(4);
      expect(d.premierObjetSec).toBeGreaterThanOrEqual(0.8);
      expect(d.premiereCouvertureVisageSec).toBeGreaterThanOrEqual(5);
      expect(d.premiereCarteSec).toBeGreaterThanOrEqual(8);
      expect(d.partVisageCouvert).toBeLessThanOrEqual(0.3);
      expect(d.partVisageEnPlace).toBeGreaterThanOrEqual(0.45);
      expect(d.intervalleMoyenSec).toBeLessThanOrEqual(2.5);
      expect(d.plusLongSansEvenementSec).toBeLessThanOrEqual(3);
      expect(d.partSonMax).toBeLessThanOrEqual(0.3);
      // Densité : bande 8-35 %, aucun trou de plus de 0,7 s, 85 gros mouvements par minute au moins.
      expect(m.pourcentageBande).toBeGreaterThanOrEqual(8);
      expect(m.pourcentageBande).toBeLessThanOrEqual(35);
      expect(m.plusLongTrouSec).toBeLessThanOrEqual(SEUILS.trouMaxSec);
      expect(m.trousPrevus).toBe(0);
      expect(m.grosMouvementsParMinute).toBeGreaterThanOrEqual(SEUILS.grosMouvementsParMinuteMin);
      // Cartes pleines (revue passe 2 du 15/10) : 1er sous-élément ≤ 0,2 s après l'entrée, jamais plus de 0,8 s sans sous-élément.
      for (const o of objetsDuPlan(r.plan).filter((x) => x.genre === "carte")) {
        const s = o.sous.filter((x) => x.ancre).map((x) => x.a).sort((x, y) => x - y);
        expect(s[0] - o.debut).toBeLessThanOrEqual(SEUILS.carteVideMaxSec + 1e-6);
        for (let k = 1; k < s.length; k++) expect(s[k] - s[k - 1]).toBeLessThanOrEqual(SEUILS.carteImmobileMaxSec + 1e-6);
      }
      expect(m.typesCartes.length).toBeGreaterThanOrEqual(4);
      expect(new Set(m.typesCartes).size).toBe(r.plan.cartes.length);
      // Mini-vidéos : 5 à 6 fenêtres, 60 % de vidéos, la moitié au plus sur le visage, la moitié enchaînées.
      expect(m.fenetres).toBeGreaterThanOrEqual(5);
      expect(m.fenetres).toBeLessThanOrEqual(6);
      expect(m.partFenetresVideo).toBeGreaterThanOrEqual(0.6);
      expect(m.partSurLeVisage).toBeLessThanOrEqual(0.5);
      expect(m.partFenetresEnchainees).toBeGreaterThanOrEqual(0.5);
      // Décision de Will du 15/10 : aucun zoom ni mouvement de cadrage.
      expect(r.plan.zooms).toEqual([]);
      expect(r.plan.mouvements ?? []).toEqual([]);
      expect(m.zooms + m.mouvements).toBe(0);
      // Littéralité : « illustre » partout, titres concrets, recherches sujet + action + lieu.
      expect(r.plan.cartes.every((c) => !!c.illustre && !titreAbstrait(c.titre))).toBe(true);
      expect(r.plan.fenetres.every((f) => !!f.illustre && f.recherche.split(" ").length >= 4)).toBe(true);
      expect((r.plan.motions ?? []).every((x) => !!x.illustre)).toBe(true);
      // Le code a rempli ce que le réalisateur n'écrit pas.
      expect(r.plan).toMatchObject({ largeur: 1080, hauteur: 1920, fps: 25, charte: "interface-claire/1", fin: { debut: 90.72 } });
      expect(r.plan.sons.length).toBeGreaterThan(50);
      expect(r.plan.groupes.length).toBeGreaterThan(60);
      console.info(`[règles fixes IMG_7747] ${JSON.stringify(m)}`);
    },
    LONG,
  );

  it(
    "déterministe ; l'historique change l'ouverture et la première famille (deux vidéos ne commencent pas pareil)",
    async () => {
      const a = reglesFixes(ENTREE_7747);
      const b = reglesFixes(ENTREE_7747);
      expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
      const hier = historiqueDuPlan(a.plan, "Hier");
      const c = reglesFixes({ ...ENTREE_7747, historique: [hier] });
      expect(c.rendable).toBe(true);
      expect(premierObjet(c.plan)).not.toBe(hier.premier);
      expect(c.mesures.diversite.familles[0]).not.toBe(hier.familles![0]);
      const r7 = verifierPlan(c.plan, MOTS_7747, { historique: [hier] }).erreurs.filter((e) => /^R7/.test(e));
      expect(r7).toEqual([]);
    },
    LONG,
  );
});

/* ---------------- realiser avec un faux Claude ---------------- */

const ENTREE_MINI: EntreeRealisateur = {
  mots: MOTS,
  dureeSec: 22,
  prise: { src: "prise.mp4", finSec: 20 },
  fin: { debut: 20, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
};

/** La réponse de Claude : le plan sans ce que remplit le code, zooms en objets. */
function sortie(p: PlanFacecamAnimee) {
  return { cartes: p.cartes, fenetres: p.fenetres, calques: p.calques, motions: p.motions, zooms: p.zooms.map(([debut, fin, echelle]) => ({ debut, fin, echelle })), mouvements: p.mouvements, motsForts: ["Relances"] };
}
function fauxClaude(reponses: ReponseRealisateur[]) {
  const requetes: RequeteRealisateur[] = [];
  const appeler = vi.fn(async (r: RequeteRealisateur) => {
    requetes.push(r);
    return reponses[Math.min(requetes.length - 1, reponses.length - 1)];
  });
  return { appeler, requetes };
}
const invalide = () => {
  const p = copie(planValide());
  if (p.cartes[0].contenu.type === "liste") p.cartes[0].contenu.lignes[1].a = 9.75;
  return p;
};

describe("réalisateur · realiser (faux Claude injecté)", () => {
  it("(a) réponse valide du premier coup → version complète, 1 essai", async () => {
    const { appeler, requetes } = fauxClaude([{ ok: true, donnees: sortie(planValide()) }]);
    const r = await realiser(ENTREE_MINI, { appeler });
    expect(r.erreurs).toBeUndefined();
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(1);
    expect(r.rendable).toBe(true);
    expect(requetes[0].systeme).toContain("Tu es le RÉALISATEUR");
    expect(requetes[0].message).toContain("0.00–0.40 Vos");
    expect(JSON.stringify(requetes[0].schema)).not.toContain('"sons"');
    expect(JSON.stringify(requetes[0].schema)).toContain('"illustre"');
    // La sortie demandée porte les motions, typées par famille.
    expect(JSON.stringify(requetes[0].schema)).toContain('"motions"');
    expect(JSON.stringify(requetes[0].schema)).toContain('"pile-notifications"');
    expect(r.plan.cartes).toEqual(planValide().cartes);
    expect(r.plan.motions).toEqual(planValide().motions);
    expect(r.plan.zooms).toEqual([]);
    expect(r.plan.mouvements ?? []).toEqual([]);
    expect(r.plan.groupes.some((g) => g.mots.some((m) => m.fort))).toBe(true);
    expect(r.plan.sons.length).toBeGreaterThan(10);
  });

  it("(b) réponse invalide puis valide → 2 essais, l'erreur EXACTE renvoyée dans le 2e message", async () => {
    const attendue = verifierPlan(assemblerPlan(ENTREE_MINI, { ...sortie(invalide()), motions: invalide().motions, zooms: invalide().zooms }), MOTS).erreurs;
    expect(attendue.length).toBeGreaterThan(0);
    const { appeler, requetes } = fauxClaude([{ ok: true, donnees: sortie(invalide()) }, { ok: true, donnees: sortie(planValide()) }]);
    const r = await realiser(ENTREE_MINI, { appeler });
    expect(r.version).toBe("complete");
    expect(r.essais).toBe(2);
    expect(appeler).toHaveBeenCalledTimes(2);
    expect(requetes[1].message).toContain("<erreurs_essai_precedent>");
    for (const e of attendue) expect(requetes[1].message).toContain(`- ${e}`);
    expect(requetes[1].message).toContain("ne tombe sur aucun début de mot");
    expect(requetes[0].message).not.toContain("<erreurs_essai_precedent>");
  });

  it(
    "(c) 3 réponses refusées → version simple (règles fixes), phrase claire pour Will",
    async () => {
      const { appeler, requetes } = fauxClaude([{ ok: true, donnees: { cartes: "rien" } }, { ok: true, donnees: sortie(invalide()) }, { ok: true, donnees: sortie(invalide()) }]);
      const r = await realiser(ENTREE_MINI, { appeler });
      expect(r.version).toBe("simple");
      expect(r.essais).toBe(3);
      expect(appeler).toHaveBeenCalledTimes(3);
      expect(r.phrase).toBe(PHRASE_REALISATEUR_REFUSE);
      expect(requetes[1].message).toContain("Forme : cartes");
      expect(r.erreurs?.some((e) => e.includes("ne tombe sur aucun début de mot"))).toBe(true);
    },
    LONG,
  );

  it(
    "(d) plafond atteint → aucun appel, version simple avec la mention du plafond",
    async () => {
      const { appeler } = fauxClaude([{ ok: true, donnees: sortie(planValide()) }]);
      const r = await realiser({ ...ENTREE_MINI, plafondAtteint: true }, { appeler });
      expect(appeler).not.toHaveBeenCalled();
      expect(r.version).toBe("simple");
      expect(r.essais).toBe(0);
      expect(r.phrase).toBe(MENTION_PLAFOND_FACECAM_ANIMEE);
    },
    LONG,
  );

  it(
    "Claude en panne → version simple tout de suite, sans nouvel essai",
    async () => {
      const { appeler } = fauxClaude([{ ok: false, message: "crédit épuisé" }]);
      const r = await realiser(ENTREE_MINI, { appeler });
      expect(appeler).toHaveBeenCalledTimes(1);
      expect(r.version).toBe("simple");
      expect(r.phrase).toBe(PHRASE_REALISATEUR_PANNE);
    },
    LONG,
  );
});

/* ---------------- Bruitages ---------------- */

describe("réalisateur · bruitagesDuPlan (volumes de la galerie, un son propre par famille, aucune musique)", () => {
  it("instants et volumes attendus sur un mini-plan (souffle court au recul)", () => {
    const p = copie(planValide());
    p.motions = [];
    p.cartes = [{ debut: 2, fin: 6, titre: "Liste", icone: "document", entree: "chute", contenu: { type: "liste", lignes: [{ texte: "A", icone: "mail", a: 2.5 }, { texte: "B", icone: "mail", a: 3 }, { texte: "C", icone: "mail", a: 3.5 }], cocheA: 4 } }];
    p.fenetres = [{ debut: 9, fin: 10, media: "f", recherche: "bureau", noirEtBlancA: 9.2, etiquette: { texte: "X", a: 9.5 } }];
    p.calques = [
      { type: "etiquette", debut: 7, fin: 8, texte: "Y", icones: [{ nom: "horloge", a: 7.5 }] },
      { type: "compteur", debut: 10, fin: 11.5, de: 0, a: 3 },
    ];
    p.zooms = [[8, 9, 1.1]];
    p.mouvements = [
      { debut: 6.2, fin: 6.9, type: "recul", echelle: 1.15 },
      { debut: 11.0, fin: 11.8, type: "decale-gauche", echelle: 1.15 },
    ];
    p.fin = { ...p.fin, debut: 12, tuiles: ["loupe", "eclair"] };
    const r3 = (x: number) => Math.round(x * 1000) / 1000;
    const tics = ticsCompteur(10, 0, 3, 1.5).map((a) => [r3(a), "tick_001", 0.05]);
    expect(tics).toHaveLength(3);
    const attendu = [
      [1.98, "whoosh-in", 0.25],
      [2.5, "drop_002", 0.04],
      [3, "drop_002", 0.04],
      [3.5, "drop_002", 0.04],
      [4, "drop_002", 0.04],
      [4.08, "drop_002", 0.04],
      [4.16, "drop_002", 0.04],
      [5.88, "whoosh-out", 0.18],
      [6.2, "whoosh-out", 0.12],
      [7, "maximize_004", 0.07],
      [7.5, "maximize_004", 0.04],
      [8, "click_002", 0.05],
      [8.98, "whoosh-in", 0.25],
      [9.2, "minimize_004", 0.06],
      [9.5, "drop_004", 0.04],
      [9.88, "whoosh-out", 0.18],
      ...tics,
      [11, "click_002", 0.05],
      [11.98, "whoosh-in", 0.3],
      [12.25, "drop_004", 0.05],
      [12.45, "tick_001", 0.05],
      [12.54, "tick_001", 0.05],
      [12.95, "confirmation_002", 0.06],
    ].sort((x, y) => (x[0] as number) - (y[0] as number));
    expect(bruitagesDuPlan(p)).toEqual(attendu);
  });

  it("un whoosh par entrée de carte et de fenêtre, un pop par sous-élément, le son propre de chaque motion, aucune musique", () => {
    const p = planValide();
    const sons = bruitagesDuPlan(p);
    const a = (t: number, nom: string) => sons.some(([x, n]) => Math.abs(x - t) < 1e-6 && n === nom);
    for (const o of [...p.cartes, ...p.fenetres]) expect(a(Math.round((o.debut - 0.02) * 1000) / 1000, "whoosh-in")).toBe(true);
    for (const c of p.cartes) for (const t of popsCarte(c.contenu)) expect(a(t, "drop_002")).toBe(true);
    // Motions : l'horloge fait « tick_004 », le téléphone « click_001 », le mot géant « maximize_008 »… jamais de whoosh
    // pour ce qui apparaît sur place.
    expect(a(2.3, "tick_004")).toBe(true);
    expect(a(8.0, "click_001")).toBe(true);
    expect(a(13.5, "maximize_008")).toBe(true);
    expect(sons.filter(([t, n]) => n.startsWith("whoosh") && t > 13 && t < 18)).toEqual([]);
    expect(p.zooms).toEqual([]);
    expect(sons.every(([, n]) => (SONS_DISPONIBLES as readonly string[]).includes(n))).toBe(true);
    expect(SONS_DISPONIBLES.some((n) => /musi|music|ambian|loop|theme|nappe|jingle/i.test(n))).toBe(false);
  });

  it("chaque son existe dans le dossier des sons du rendu", () => {
    for (const n of SONS_DISPONIBLES) expect(existsSync(fileURLToPath(new URL(`../../studio-rendu/compositions/interface-claire/sons/${n}.wav`, import.meta.url))), n).toBe(true);
  });
});

/* ---------------- Sous-titres ---------------- */

describe("réalisateur · sous-titres (contrat minimal)", () => {
  it("1 à 3 mots par groupe (4 quand un groupe de petits mots est absorbé, passe 4), « ? » seul jamais affiché, les mots du réalisateur sur plaque", () => {
    const g = groupesSousTitres(MOTS_7747);
    expect(g.every((x) => x.mots.length >= 1 && (x.mots.length <= 3 || (x.mots.length === 4 && x.mots.filter((m) => estPetitMot(m.w, m.fort)).length >= 2)))).toBe(true);
    expect(g.flatMap((x) => x.mots).some((m) => m.w === "?")).toBe(false);
    expect(groupesSousTitres(MOTS_7747, { motsForts: ["Petites"] }).flatMap((x) => x.mots).find((m) => m.w === "Petites")?.fort).toBe(true);
  });
});

/* ---------------- Icônes et consigne ---------------- */

describe("réalisateur · icônes et consigne", () => {
  it("la liste des icônes autorisées est identique à NOMS_ICONES du rendu", () => {
    const source = readFileSync(fileURLToPath(new URL("../../studio-rendu/compositions/interface-claire/elements.tsx", import.meta.url)), "utf8");
    const bloc = source.slice(source.indexOf("const TRACES"), source.indexOf("export const NOMS_ICONES"));
    const noms = [...bloc.matchAll(/^ {2}([a-zA-Z_]+):/gm)].map((m) => m[1]);
    expect(noms.length).toBeGreaterThan(20);
    expect([...ICONES_AUTORISEES]).toEqual(noms);
  });

  it("la consigne porte la littéralité, les mini-vidéos, le cadrage, les seuils, les 15 familles, les règles R1 à R7 et l'historique étendu", () => {
    const c = consigneRealisateur([{ titre: "Hier", types: ["grille", "liste"], entrees: ["chute"], premier: "calque:etiquette", recherches: ["artisan qui tape un devis"], echelles: [1, 1.2], familles: ["horloge", "fenetre", "etiquette"], debutsFamilles: [1, 5, 8], comptesFamilles: { horloge: 1, fenetre: 1, etiquette: 1 }, duree: 90 }]);
    for (const x of [
      "LITTÉRALITÉ",
      "« illustre »",
      "sujet + action + lieu",
      "« Boîte mail », « Agenda du dirigeant »",
      "10 exemples « phrase → ce qu'on montre »",
      "6. « il y a cinq ans",
      "MINI-VIDÉO",
      "« video »: true",
      "UN OBJET CACHE SOIT LE VISAGE ENTIER, SOIT RIEN",
      "il faut supprimer le zoom car ça bouge trop",
      "« zooms » vaut TOUJOURS []",
      "ÉNERGIE SANS ZOOM",
      "1,5 à 6,5 s",
      "entre 8 et 35 %",
      "2,4 s",
      "2,8 s",
      "JAMAIS plus de 0,7 s",
      "COMME LA MESURE",
      "Au moins 85 GROS MOUVEMENTS par minute",
      "AU MOINS 5 % DE L'IMAGE",
      "NE SE VOIENT PAS",
      "UNE PHRASE = UN OBJET",
      "± 0,15 s",
      "JAMAIS VIDE",
      "Villeexemple",
      "AUCUN CHIFFRE AFFICHÉ",
      "Vouvoiement",
      "« Hier » : types grille → liste",
      "ouverture calque:etiquette",
      "médias « artisan qui tape un devis »",
      "Aucune musique",
      "« mouvements »",
      // Retour de Will sur la vidéo 5 (15/10) et règles du directeur artistique.
      "SUR LA VIDÉO 5",
      "15 FAMILLES",
      "## Motions (« motions »)",
      "mot-geant — Mot géant cinétique plein écran",
      "trait-dessine — Soulignement ou encadré dessiné",
      "R1 OUVERTURE SUR LE VISAGE ENTIER",
      "JAMAIS la même famille deux fois de suite",
      "R4 PLAFONDS",
      "R5 VARIÉTÉ : (a) 7 familles différentes au moins sur toute fenêtre glissante de 60 s",
      "R6 BRUITAGES",
      "R7a : la PREMIÈRE famille de cette vidéo n'est aucune de celles-ci : horloge",
      "R7c : au moins 3 familles ABSENTES de la vidéo précédente",
      "familles horloge → fenetre → etiquette",
      "la MOITIÉ AU PLUS des fenêtres « sur-le-visage »",
      ICONES_AUTORISEES.join(", "),
    ])
      expect(c).toContain(x);
    expect(consigneRealisateur()).toContain("L'historique éventuel des vidéos précédentes est dans le message");
    expect(SEUILS.carte.max).toBe(6.5);
  });
});
