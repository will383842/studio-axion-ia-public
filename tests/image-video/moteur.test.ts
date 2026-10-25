/**
 * L15 · Machine à états et moteur « image → vidéo ». Tout est SIMULÉ (`doubles-fabrication.ts`) : aucun appel payant,
 * aucune date, aucun hasard. Couvre : bout en bout sur les 7 images du jeu d'essai, portes de Will (carte, script) et
 * leurs refus, reprise sans repayer, plafond par vidéo (arrêt net), une seule réservation par appel, contrat du moteur,
 * fiche du format et raccords NON posés (lot L17).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { formatImageVideo, RACCORDS_IMAGE_VIDEO, schemaReglagesImageVideo } from "@/formats/image-video";
import {
  attendWillIV,
  avancerIV,
  avancerJusquAArretIV,
  BRUITAGES_V4_IV,
  CARTES_OBLIGATOIRES,
  centimesEurDeUsd,
  engageCentimes,
  ErreurDecisionIV,
  etatInitialIV,
  imposerTypeIV,
  reprendreIV,
  tarifVoixCentimesEur,
  validerCarteIV,
  validerScriptIV,
  type DecisionCarteIV,
  type DecisionScriptIV,
  type EtatFabricationIV,
  type OutilsFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import { CODE_CARTE_A_VALIDER, CODE_SCRIPT_A_VALIDER, creerMoteurMontageImageVideo, moteurMontageImageVideo, PHRASE_FORMAT_MASQUE } from "@/moteurs/montage-image-video";
import { formatGenerateur, listerFormats } from "@/formats";
import { codeDuFormat } from "@/formats/registre-codes";
import { idMoteurDeCommande, moteurExiste, obtenirMoteur } from "@/moteurs";
import { LECTURE_VIDE, lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { carteFixe, demandeEssai, IMAGES, MESURE_REFERENCE, monde, outilsSimules, type Monde, type OptionsMonde } from "./doubles-fabrication";
import { verdictSurMesureAncienne, VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import { cartesReseaux, refusReessayableIV, vueFabrication } from "@/components/formats/image-video/vue";
import { etapeDeSecoursIV, finsHorsReferenceIV, planDeSecoursIV, secoursApresArretIV } from "@/moteurs/montage-image-video/secours";
import type { CarteImage } from "@/domaine/image-video/carte";

/**
 * 20/10 : la lecture unique de la voix est la règle (`LECTURE_UNIQUE_IV`). Les blocs ci-dessous qui décrivent une voix
 * payée en segments SÉPARÉS (arrêts de fin, fins de secours, replis : « voix-iv/1 », qui existe encore en prod) la
 * remettent à `false` le temps du bloc ; la lecture unique a ses propres tests (`fabrication-lecture-unique.test.ts`).
 */
const reglageVoix = vi.hoisted(() => ({ lectureUnique: true }));
vi.mock("@/moteurs/montage-image-video/voix", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/moteurs/montage-image-video/voix")>();
  return {
    ...vrai,
    get LECTURE_UNIQUE_IV() {
      return reglageVoix.lectureUnique;
    },
  };
});

vi.setConfig({ testTimeout: 120_000 });

/* ------------------------------------------------------------------ */
/* Aides                                                                 */
/* ------------------------------------------------------------------ */

const decisionCarte = (e: EtatFabricationIV, carte?: CarteImage): DecisionCarteIV => ({ proposition: e.propositionCarte!.empreinte, ...(carte ? { carte } : {}), le: "2026-10-15T08:00:00.000Z" });
/** Will garde toutes les formules du script (choix « garder »). */
const decisionScript = (e: EtatFabricationIV, plus: Partial<DecisionScriptIV> = {}): DecisionScriptIV => ({
  proposition: e.propositionScript!.empreinte,
  choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])),
  ...plus,
});

/** Jusqu'à la vidéo prête : carte validée telle quelle, script validé (formules gardées). */
async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<{ etat: EtatFabricationIV; arrets: string[] }> {
  const arrets: string[] = [];
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") {
      arrets.push("carte");
      e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    } else if (attendWillIV(e) === "script") {
      arrets.push("script");
      e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    } else break;
  }
  return { etat: e, arrets };
}

function demarrer(nom: (typeof IMAGES)[number], o: OptionsMonde = {}, plus: Parameters<typeof demandeEssai>[1] = {}) {
  const carte = carteFixe(nom);
  const m = monde();
  return { carte, m, o: outilsSimules(carte, m, o), e: etatInitialIV(demandeEssai(carte, plus)) };
}

/** Chaque appel payant (Claude, HeyGen) est précédé, dans l'ordre, d'une réservation. */
function chaqueAppelReserve(m: Monde): void {
  let reserves = 0;
  let appels = 0;
  for (const x of m.ordre) {
    if (x.startsWith("réserve ")) reserves++;
    else if (x.startsWith("claude ") || x === "heygen" || x === "transcription") {
      appels++;
      expect(reserves, `appel « ${x} » sans réservation`).toBeGreaterThanOrEqual(appels);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Bout en bout                                                          */
/* ------------------------------------------------------------------ */

/**
 * Q21 (mise en page aux instants clés) est MESURÉE depuis le moteur, avec les plans mêmes des composants
 * (`@/briques/schema-motion/emprise`). Sur le jeu d'essai, elle relève des défauts RÉELS sur B, E, F et le faux
 * schéma à 16 blocs en version courte (écran vide, objets qui ne remplissent pas la zone, chiffres de la vue d'ensemble dans la bande des
 * sous-titres, même icône pour plusieurs blocs) : ces vidéos sont refusées AVANT toute écoute ou relecture payante.
 */
// B n'y est plus (#323) : son « 0 % » venait de l'écran e11 (carte-bénéfice citant les 5 bénéfices = récapitulatif)
// rendu en moment « bénéfices » VIDE ; il est désormais rendu en récapitulatif.
const REFUS_Q21: Partial<Record<(typeof IMAGES)[number], RegExp>> = {
  // E : sa vue d'ensemble (« 23 min » dans la bande des sous-titres) tient désormais dans la zone utile (vue réduite de
  // `planEnsemble`) ; reste refusée par Q21 pour le remplissage d'un autre écran.
  E: /Remplissage vertical de 25 %/,
  F: /Remplissage vertical de 67 %/,
};

describe("bout en bout en simulation, avec les arrêts « carte » et « script »", () => {
  for (const nom of IMAGES.filter((x) => !REFUS_Q21[x])) {
    it(`${nom} : prête pour les 4 réseaux, chaque appel payant réservé, plafond tenu`, async () => {
      const { m, o, e } = demarrer(nom);
      const { etat, arrets } = await jusquAuBout(e, o);
      expect(etat.refus).toBeUndefined();
      expect(etat.etape).toBe("prete");
      expect(arrets).toEqual(["carte", "script"]);
      expect(etat.carte?.par).toBe("will");
      expect(etat.livraison?.map((l) => l.reseau)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
      for (const l of etat.livraison ?? []) {
        expect(l.version).not.toBe("aucune");
        expect(l.fichierCle).toMatch(/^final\//);
        expect(l.texte?.length).toBeGreaterThan(0);
        expect(l.lien).toMatch(/utm_campaign=0042-IV-/);
      }
      expect(etat.controles?.verdict?.ok).toBe(true);
      // Corps lu une fois, une lecture par fin distincte (LinkedIn muet) : aucune relecture.
      expect(m.lus.length).toBe((etat.voix?.segments.fins.length ?? 0) + 1);
      chaqueAppelReserve(m);
      expect(engageCentimes(etat)).toBeLessThanOrEqual(etat.caisse.plafondCentimes);
      // Une seule réservation par appel et par tentative.
      expect(new Set(etat.caisse.reservations.map((r) => r.cle)).size).toBe(etat.caisse.reservations.length);
    });
  }

  for (const [nom, defaut] of Object.entries(REFUS_Q21) as [(typeof IMAGES)[number], RegExp][]) {
    it(`${nom} : refusée par la mise en page (Q21) avant toute écoute ou relecture, chaque appel payant réservé, plafond tenu`, async () => {
      const { m, o, e } = demarrer(nom);
      const { etat, arrets } = await jusquAuBout(e, o);
      expect(arrets).toEqual(["carte", "script"]);
      expect(etat.etape).toBe("refusee");
      expect(etat.refus?.code).toBe("IV_CONTROLES");
      const phrases = etat.refus?.phrases ?? [];
      expect(phrases.some((p) => defaut.test(p))).toBe(true);
      // Les seuls défauts constatés sont de mise en page ; le reste attend l'écoute (non lancée : rien de payé pour rien).
      expect(phrases.filter((p) => !/\(non vérifié\)/.test(p) && !/Mise en page/.test(p))).toEqual([]);
      expect(m.ordre.filter((x) => x === "transcription" || /relecture/.test(x))).toEqual([]);
      chaqueAppelReserve(m);
      expect(engageCentimes(etat)).toBeLessThanOrEqual(etat.caisse.plafondCentimes);
    });
  }

  it("très complexe (faux schéma à 16 blocs), voix lente : versions courtes pour Shorts et LinkedIn, taillées dans la même voix", async () => {
    const { m, o, e } = demarrer("faux-16-noeuds", { voixLente: true });
    const { etat } = await jusquAuBout(e, o);
    // Versions courtes faites ; la vue d'ensemble de la version courte ne répète plus l'icône « document » sur 9 blocs
    // (seul le premier la porte) : plus refusée par Q21, la vidéo est prête.
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");
    const courtes = etat.courtes?.filter((c) => c.resultat) ?? [];
    expect(courtes.flatMap((c) => c.reseaux).sort()).toEqual(["linkedin", "youtube-shorts"]);
    // Aucune lecture de plus pour les versions courtes.
    expect(m.lus.length).toBe((etat.voix?.segments.fins.length ?? 0) + 1);
  });

  it("déterministe : deux fabrications de la même image donnent le même état", async () => {
    const a = await jusquAuBout(demarrer("C").e, demarrer("C").o);
    const x = demarrer("C");
    const b = await jusquAuBout(x.e, x.o);
    expect(JSON.stringify(b.etat)).toBe(JSON.stringify(a.etat));
  });
});

/* ------------------------------------------------------------------ */
/* Porte « carte »                                                       */
/* ------------------------------------------------------------------ */

describe("porte « carte » : obligatoire pour les 10 premières, puis selon le réglage", () => {
  it(`moins de ${CARTES_OBLIGATOIRES} cartes validées : arrêt même en « si-doute » et sans doute`, async () => {
    const { o, e } = demarrer("B", { cartesValidees: CARTES_OBLIGATOIRES - 1 });
    const apres = await avancerJusquAArretIV(e, o);
    expect(apres.etape).toBe("carte-a-valider");
    expect(apres.propositionCarte?.doutes).toEqual([]);
  });

  it("11e carte sans doute, en « si-doute » : l'arrêt est sauté, la carte est validée par le réglage", async () => {
    const { m, o, e } = demarrer("B", { cartesValidees: CARTES_OBLIGATOIRES });
    const apres = await avancerJusquAArretIV(e, o);
    expect(apres.etape).toBe("script-a-valider");
    expect(apres.carte?.par).toBe("reglage");
    expect(apres.carte?.carte.validation?.par).toBe("reglage");
    expect(apres.carte?.carte.validation?.empreinteCarte).toBe("essai-b");
    expect(m.lus).toEqual([]);
  });

  it("11e carte avec un écart entre les deux lectures : l'arrêt revient", async () => {
    const carte = carteFixe("B");
    const b = lectureDeCarte(carte);
    b.noeuds[0] = { ...b.noeuds[0], libelle: `${b.noeuds[0].libelle} bis` };
    const { o, e } = demarrer("B", { cartesValidees: 25, lectures: { b } });
    const apres = await avancerJusquAArretIV(e, o);
    expect(apres.etape).toBe("carte-a-valider");
    expect(apres.propositionCarte?.doutes.join(" ")).toMatch(/écart/);
  });

  it("réglage « toujours » : l'arrêt reste après 10 cartes", async () => {
    const { o, e } = demarrer("B", { cartesValidees: 40 }, { validationCarte: "toujours" });
    expect((await avancerJusquAArretIV(e, o)).etape).toBe("carte-a-valider");
  });

  it("avant la validation de la carte, seules les deux lectures dépensent", async () => {
    const { m, o, e } = demarrer("C");
    const apres = await avancerJusquAArretIV(e, o);
    expect(apres.etape).toBe("carte-a-valider");
    expect(new Set(apres.caisse.reservations.map((r) => r.etape))).toEqual(new Set(["lecture"]));
    expect(m.appelsClaude.map((a) => a.role)).toEqual(["lecture-image", "lecture-image"]);
    // Rien ne bouge tant que Will n'a pas décidé.
    expect(JSON.stringify(await avancerIV(apres, o))).toBe(JSON.stringify(apres));
  });

  it("refus : carte corrigée avec un défaut bloquant, ou décision sur une autre proposition ; rien n'est gardé", async () => {
    const { o, e } = demarrer("C");
    const arret = await avancerJusquAArretIV(e, o);
    const carte = arret.propositionCarte!.carte;
    // Un bloc posé sans aucune flèche (hors branche) reste un défaut que le code ne peut pas deviner : refus. Une flèche
    // vers un bloc absent, elle, est réparée seule (R2, tests/image-video/reparation-carte.test.ts).
    const cassee = { ...carte, noeuds: [...carte.noeuds, { ...carte.noeuds[0]!, id: "n99", libelle: "Bloc perdu", ordre: 99 }] };
    try {
      validerCarteIV(arret, decisionCarte(arret, cassee));
      throw new Error("aurait dû refuser");
    } catch (err) {
      expect(err).toBeInstanceOf(ErreurDecisionIV);
      expect((err as ErreurDecisionIV).phrases.join(" ")).toMatch(/relié à rien/);
    }
    expect(() => validerCarteIV(arret, { proposition: "autre", le: "x" })).toThrow(/a changé/);
    expect(arret.etape).toBe("carte-a-valider");
  });

  it("carte corrigée par Will : chiffres recalculés par le code, validation posée", async () => {
    const { o, e } = demarrer("C");
    const arret = await avancerJusquAArretIV(e, o);
    const carte = structuredClone(arret.propositionCarte!.carte);
    carte.titre = `${carte.titre} (corrigé)`;
    const apres = validerCarteIV(arret, decisionCarte(arret, carte));
    expect(apres.etape).toBe("ecriture");
    expect(apres.carte?.carte.titre).toMatch(/corrigé/);
    expect(apres.carte?.carte.validation).toMatchObject({ par: "will", empreinteCarte: "essai-c" });
  });

  it("la décision gardée par les services (outil `decisions`) n'est lue que pour la proposition qu'elle valide", async () => {
    const { o, e } = demarrer("C");
    const arret = await avancerJusquAArretIV(e, o);
    const perimee: OutilsFabricationIV = { ...o, decisions: { carte: async () => ({ proposition: "ancienne", le: "x" }) } };
    expect((await avancerIV(arret, perimee)).etape).toBe("carte-a-valider");
    const bonne: OutilsFabricationIV = { ...o, decisions: { carte: async () => decisionCarte(arret) } };
    expect((await avancerIV(arret, bonne)).etape).toBe("ecriture");
  });

  it("ancien état « type à choisir » (IV_TYPE_A_CHOISIR) : le type imposé par Will reprend les lectures payées, 0 appel", async () => {
    const carte = carteFixe("C");
    const inconnue = { ...lectureDeCarte(carte), type: "inconnu" as const };
    const { m, o, e } = demarrer("C", { lectures: { a: LECTURE_VIDE, b: LECTURE_VIDE } });
    const ancien = structuredClone(e);
    ancien.etape = "refusee";
    ancien.refus = { etape: "lecture", code: "IV_TYPE_A_CHOISIR", message: "Je ne reconnais pas ce type d'image : choisissez-le", reessayable: false };
    ancien.lectures = { a: inconnue, b: inconnue };
    const apres = await avancerJusquAArretIV(imposerTypeIV(ancien, "embranchement"), o);
    expect(apres.lectures).toBeUndefined();
    expect(apres.etape).toBe("carte-a-valider");
    expect(apres.propositionCarte?.carte.types).toEqual(["embranchement"]);
    expect(m.appelsClaude.length).toBe(0);
  });

  it("type inconnu des deux lectures : plus de refus (R1), le code déduit le type et le dit", async () => {
    const carte = carteFixe("C");
    const inconnue = { ...lectureDeCarte(carte), type: "inconnu" as const };
    const { o, e } = demarrer("C", { lectures: { a: inconnue, b: inconnue } });
    const apres = await avancerJusquAArretIV(e, o);
    expect(apres.refus).toBeUndefined();
    expect(apres.etape).toBe("carte-a-valider");
    expect(apres.propositionCarte?.carte.types).toEqual(carte.types);
    expect(apres.propositionCarte?.carte.adaptations?.some((x) => /type déduit/.test(x))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Porte « script »                                                      */
/* ------------------------------------------------------------------ */

describe("porte « script » : rien de plus n'est payé avant la validation", () => {
  async function auScript(nom: (typeof IMAGES)[number] = "C", opt: OptionsMonde = {}) {
    const d = demarrer(nom, opt);
    const e = await avancerJusquAArretIV(validerCarteIV(await avancerJusquAArretIV(d.e, d.o), decisionCarte(await avancerJusquAArretIV(d.e, d.o))), d.o);
    return { ...d, e };
  }

  it("à l'arrêt « script » : lecture et écriture seules ont dépensé, aucune voix ; le prix de la suite est annoncé", async () => {
    const { m, e } = await auScript();
    expect(e.etape).toBe("script-a-valider");
    expect(new Set(e.caisse.reservations.map((r) => r.etape))).toEqual(new Set(["lecture", "ecriture"]));
    expect(m.lus).toEqual([]);
    expect(m.transcriptions).toEqual([]);
    const p = e.propositionScript!.prix;
    expect(p.habituelCentimes).toBeGreaterThan(0);
    expect(p.auPlusCentimes).toBeGreaterThanOrEqual(p.habituelCentimes);
    expect(p.engageCentimes).toBe(engageCentimes(e));
    expect(e.propositionScript!.formules.map((f) => f.texte)).toEqual(expect.arrayContaining(["Zéro demande perdue"]));
  });

  it("refus : formule absolue non tranchée, mot « machine » ajouté par Will, décision périmée", async () => {
    const { e } = await auScript();
    expect(() => validerScriptIV(e, { proposition: e.propositionScript!.empreinte })).toThrow(/ne passe pas encore/);
    const fiche = structuredClone(e.propositionScript!.fiche);
    fiche.ecrans[1] = { ...fiche.ecrans[1], texteDit: `${fiche.ecrans[1].texteDit.replace(/\.$/, "")}, comme une machine.` };
    let phrases: string[] = [];
    try {
      validerScriptIV(e, decisionScript(e, { fiche }));
    } catch (err) {
      phrases = (err as ErreurDecisionIV).phrases;
    }
    expect(phrases.join(" ")).toMatch(/machine/);
    expect(() => validerScriptIV(e, { ...decisionScript(e), proposition: "autre" })).toThrow(/a changé/);
    expect(e.etape).toBe("script-a-valider");
  });

  it("validé : plan des fins posé, la voix part ensuite", async () => {
    const { o, m, e } = await auScript();
    const v = validerScriptIV(e, decisionScript(e));
    expect(v.etape).toBe("voix");
    expect(v.plan?.fins.find((f) => f.reseaux.includes("linkedin"))?.muet).toBe(true);
    await avancerIV(v, o);
    expect(m.lus.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Reprise sans repayer                                                  */
/* ------------------------------------------------------------------ */

describe("reprise après erreur, sans repayer", () => {
  // Voix payée en segments séparés (« voix-iv/1 ») : corps puis une lecture par fin, secours et replis.
  beforeAll(() => {
    reglageVoix.lectureUnique = false;
  });
  afterAll(() => {
    reglageVoix.lectureUnique = true;
  });

  it("15/10 · arrêt Q16 « part de parole −14 % » sur l'ancienne mesure (v-dd3049053f88) : « Refaire cette partie » re-mesure, aucune voix relue ni réservée", async () => {
    // Prod : la fin courte mesurée avant la version 2 (bords silencieux comptés), studio-rendu pas encore à jour.
    let serviceAJour = false;
    const ancienne = Object.fromEntries(Object.entries({ ...REFERENCE_V4_IV, partieParole: REFERENCE_V4_IV.partieParole * 0.86 }).map(([k, v]) => [`voix.${k}`, v]));
    const { m, o, e } = demarrer("C", { mesureVoix: (n) => (serviceAJour ? MESURE_REFERENCE : n === 1 ? MESURE_REFERENCE : ancienne) });
    const { etat } = await jusquAuBout(e, o);
    // Avec ce correctif, la re-mesure part dès la voix finie : studio-rendu « ancien » → panne claire, réessayable.
    expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_PANNE", reessayable: true });
    expect(etat.refus?.message).toMatch(/version 1 : mettez-le à jour/);
    // L'état tel qu'il est gardé en prod (écrit AVANT ce correctif) : voix finie, mesures anciennes, refus Q16 non réessayable.
    const voix = structuredClone(etat.voix!);
    for (const p of [voix.voix.corps.prise, ...voix.voix.fins.map((f) => f.prise)]) if (p && (p.etat.phase === "a-remesurer" || p.etat.phase === "remesure")) p.etat = { phase: "faite", audio: p.etat.audio };
    voix.voix.issue = { statut: "faite" };
    const prod: EtatFabricationIV = { ...etat, voix, refus: { etape: "voix", code: "IV_VOIX", message: "La voix de la fin pour tiktok, youtube-shorts, instagram ne ressemble pas assez à la voix de référence (part de parole -14 % (toléré 12 %)).", reessayable: false } };
    expect(vueFabrication(prod).refus?.reessayable).toBe(true);
    const lus = m.lus.length;
    const reservationsVoix = prod.caisse.reservations.filter((r) => r.etape === "voix").length;
    serviceAJour = true;
    const fin = await jusquAuBout(reprendreIV(prod), o);
    expect(fin.etat.etape).toBe("prete");
    expect(m.lus).toHaveLength(lus);
    expect(fin.etat.caisse.reservations.filter((r) => r.etape === "voix")).toHaveLength(reservationsVoix);
  });

  describe("15/10 · fin Facebook hors référence en mesure v2 (v-dd3049053f88, trav-f2b26bba35ac) : fin de secours", () => {
    /** Prod : « … Le lien est en commentaire. » mesurée à 177,78 Hz (hauteur +17 %), deux lectures, mesure version 2. */
    const HORS_REFERENCE = { ...Object.fromEntries(Object.entries({ ...REFERENCE_V4_IV, hauteurHz: REFERENCE_V4_IV.hauteurHz * 1.17 }).map(([k, v]) => [`voix.${k}`, v])), "voix.versionMesure": VERSION_MESURE_VOIX };
    const FIN_FB = "Le lien est en commentaire.";
    const SECOURS = "Le lien est dans le premier commentaire.";

    /** Arrêt Q16 tel qu'il est gardé en prod ; `secoursHors` : la fin de secours s'écarte aussi de la référence. */
    async function arretProd(secoursHors = false) {
      const ref: { m?: Monde } = {};
      // La mesure suit la lecture qu'elle mesure : la dernière lue dit de quelle fin il s'agit.
      const d = demarrer("C", { mesureVoix: () => (ref.m!.lus.at(-1)!.endsWith(FIN_FB) || (secoursHors && ref.m!.lus.at(-1)!.endsWith(SECOURS)) ? HORS_REFERENCE : MESURE_REFERENCE) });
      ref.m = d.m;
      const { etat } = await jusquAuBout(d.e, d.o);
      return { ...d, etat };
    }

    it("état de prod : refus Q16 non réessayable → « Refaire cette partie » proposé avec la fin de secours ; la reprise lit SEULEMENT la fin de secours Facebook", async () => {
      const { m, o, etat } = await arretProd();
      expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
      expect(etat.refus?.message).toMatch(/La voix de la fin pour facebook ne ressemble pas assez à la voix de référence \(hauteur \+17 % par rapport au corps \(toléré 8 %\)\)/);
      // Deux lectures payées de la fin Facebook (relance de ressemblance), mesure déjà à la version 2 : rien à re-mesurer.
      expect(m.lus.filter((t) => t.endsWith(FIN_FB))).toHaveLength(2);
      const v = vueFabrication(etat);
      expect(v.refus?.reessayable).toBe(true);
      expect(v.refus?.details[0]).toMatch(/Fin de secours validée par Will pour facebook : « Le lien est dans le premier commentaire\. »/);

      const lus = [...m.lus];
      const voixAvant = etat.caisse.reservations.filter((r) => r.etape === "voix");
      const repris = reprendreIV(etat);
      expect(repris.plan!.fins.find((f) => f.reseaux.includes("facebook"))).toMatchObject({ secours: true });
      // Les autres fins du plan ne bougent pas.
      for (const f of etat.plan!.fins.filter((x) => !x.reseaux.includes("facebook"))) expect(repris.plan!.fins.find((x) => x.id === f.id)).toEqual(f);
      const fin = await jusquAuBout(repris, o);
      expect(fin.etat.refus).toBeUndefined();
      expect(fin.etat.etape).toBe("prete");
      // UNE lecture payée de plus : la fin de secours (question + diagnostic + nouvelle phrase), aucune autre.
      const nouvelles = m.lus.slice(lus.length);
      expect(nouvelles).toHaveLength(1);
      expect(nouvelles[0]).toMatch(/Faites votre diagnostic gratuit en quelques minutes\. Le lien est dans le premier commentaire\.$/);
      expect(nouvelles[0].length).toBeLessThan(200);
      const voixApres = fin.etat.caisse.reservations.filter((r) => r.etape === "voix");
      expect(voixApres.slice(0, voixAvant.length)).toEqual(voixAvant);
      expect(voixApres.slice(voixAvant.length)).toHaveLength(1);
      expect(voixApres.at(-1)!.cle).toMatch(/iv-voix-fin-facebook-[0-9a-f]{10}-\d+$/);
      expect(engageCentimes(fin.etat)).toBeLessThanOrEqual(fin.etat.caisse.plafondCentimes);
      // Le texte de la version Facebook suit la nouvelle phrase : carton de fin, sous-titres (mots de la voix), publication.
      const fb = fin.etat.plan!.fins.find((f) => f.reseaux.includes("facebook"))!;
      expect(fb.appels.at(-1)).toMatchObject({ id: "fin-fb-lien-premier-commentaire", dit: SECOURS, ecran: "Diagnostic gratuit · lien en premier commentaire" });
      const rendu = m.rendus.filter((r) => r.reseaux.includes("facebook")).at(-1)!;
      expect(JSON.stringify(rendu.ligne)).toContain("lien en premier commentaire");
      expect(rendu.piste.mots.map((x) => x.mot).join(" ")).toMatch(/Le lien est dans le premier commentaire\.?$/);
      expect(fin.etat.livraison?.find((l) => l.reseau === "facebook")?.premierCommentaire).toBeTruthy();
      expect(fin.etat.journal.join(" ")).toMatch(/Fin de secours pour facebook/);
    });

    /** Enveloppe la lecture simulée : un « euh » est inséré (après le 2ᵉ mot) quand le texte finit par `fin`. */
    function hesiterSur(d: ReturnType<typeof demarrer>, fin: string): void {
      const voix = d.o.voix.voix() as unknown as { lire: (x: { texte: string }) => Promise<{ mots: { mot: string; debutSec: number; finSec: number }[] }> };
      const lire = voix.lire.bind(voix);
      voix.lire = async (x) => {
        const r = await lire(x);
        if (!x.texte.endsWith(fin)) return r;
        const [a, b, ...reste] = r.mots;
        return { ...r, mots: [a, b, { mot: "euh", debutSec: b.finSec, finSec: b.finSec + 0.3 }, ...reste.map((w) => ({ ...w, debutSec: +(w.debutSec + 0.4).toFixed(2), finSec: +(w.finSec + 0.4).toFixed(2) }))] };
      };
    }

    describe("15/10 · 2ᵉ fin de secours puis repli Instagram (prod : v-dd3049053f88, trav-f2b26bba35ac, studio 039c3f62)", () => {
      /** Prod : « … Le lien est dans le premier commentaire. » mesurée hauteur +24 %, dynamique +20 % (mesure version 2). */
      const SECOURS_HORS = { ...Object.fromEntries(Object.entries({ ...REFERENCE_V4_IV, hauteurHz: REFERENCE_V4_IV.hauteurHz * 1.19, dynamique: REFERENCE_V4_IV.dynamique * 1.202 }).map(([k, v]) => [`voix.${k}`, v])), "voix.versionMesure": VERSION_MESURE_VOIX };
      const SECOURS_2 = "Le lien est juste sous la vidéo.";
      const PROFIL = "Le lien est dans mon profil.";
      const REPLI = "Facebook reprend la version Instagram : la voix des fins Facebook ne ressemblait pas à la référence.";

      /**
       * L'état EXACT gardé en prod : fin Facebook habituelle hors référence (deux lectures), « Refaire » → secours 1 lu une
       * fois, hors référence (+24 %), refus Q16 « Aucune autre lecture n'est faite ». `secours2` : comportement du 2ᵉ.
       */
      async function etatDeProd(secours2: "ok" | "hors" | "hesite") {
        const ref: { m?: Monde } = {};
        const mesure = () => {
          const t = ref.m!.lus.at(-1)!;
          if (t.endsWith(FIN_FB) || (secours2 === "hors" && t.endsWith(SECOURS_2))) return HORS_REFERENCE;
          return t.endsWith(SECOURS) ? SECOURS_HORS : MESURE_REFERENCE;
        };
        const d = demarrer("C", { mesureVoix: mesure });
        ref.m = d.m;
        if (secours2 === "hesite") hesiterSur(d, SECOURS_2);
        const premier = (await jusquAuBout(d.e, d.o)).etat;
        const etat = (await jusquAuBout(reprendreIV(premier), d.o)).etat;
        return { ...d, etat };
      }

      it("état de prod : secours 1 lu une fois et refusé (+24 %, +20 %) → « Refaire cette partie » proposé, avec le secours 2 et le repli annoncés", async () => {
        const { m, etat } = await etatDeProd("ok");
        expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
        expect(etat.refus?.message).toMatch(/La voix de la fin de secours pour facebook ne ressemble pas non plus à la voix de référence \(hauteur \+19 % \(toléré 8 %\), dynamique \+20 % \(toléré 20 %\)\)\. Aucune autre lecture n'est faite/); // 23/10 : référence Image → vidéo recalibrée sur la nouvelle voix (188,2 Hz) ; facteur 1,19 = +19 % (toujours refusée)
        expect(m.lus.filter((t) => t.endsWith(SECOURS))).toHaveLength(1);
        expect(m.lus.some((t) => t.endsWith(SECOURS_2))).toBe(false);
        const v = vueFabrication(etat);
        expect(v.refus?.reessayable).toBe(true);
        expect(v.refus?.details[0]).toMatch(/Fin de secours validée par Will pour facebook : « Le lien est juste sous la vidéo\. »\. « Refaire cette partie » lit seulement cette fin \(une lecture payée\).*Si elle ne ressemble pas non plus à la référence ou hésite, Facebook reprend la version Instagram, sans autre lecture\./);
        expect(planDeSecoursIV(etat)).toMatchObject({ lecture: true, reseaux: ["facebook"], phrases: [SECOURS_2], replis: [] });
      });

      it("secours 2 OK : UNE seule lecture de plus (le secours 2), vidéo prête ; Facebook dit, affiche et publie « Le lien est juste sous la vidéo. », lien en premier commentaire", async () => {
        const { m, o, etat } = await etatDeProd("ok");
        const lus = m.lus.length;
        const voixAvant = etat.caisse.reservations.filter((r) => r.etape === "voix");
        const fin = await jusquAuBout(reprendreIV(etat), o);
        expect(fin.etat.refus).toBeUndefined();
        expect(fin.etat.etape).toBe("prete");
        expect(fin.etat.controles?.verdict?.ok).toBe(true);
        const nouvelles = m.lus.slice(lus);
        expect(nouvelles).toHaveLength(1);
        expect(nouvelles[0]).toMatch(/Faites votre diagnostic gratuit en quelques minutes\. Le lien est juste sous la vidéo\.$/);
        const voixApres = fin.etat.caisse.reservations.filter((r) => r.etape === "voix");
        expect(voixApres.slice(0, voixAvant.length)).toEqual(voixAvant);
        expect(voixApres.slice(voixAvant.length).map((r) => r.cle)).toEqual([expect.stringMatching(/iv-voix-fin-facebook-[0-9a-f]{10}-\d+$/)]);
        expect(engageCentimes(fin.etat)).toBeLessThanOrEqual(fin.etat.caisse.plafondCentimes);
        // Dit (sous-titres = mots de la voix), affiché (carton de fin), publié (texte du post, lien en premier commentaire).
        const fb = fin.etat.plan!.fins.find((f) => f.reseaux.includes("facebook"))!;
        expect(fb).toMatchObject({ secours: true });
        expect(fb.repli).toBeUndefined();
        expect(fb.appels.at(-1)).toMatchObject({ id: "fin-fb-lien-sous-video", dit: SECOURS_2, ecran: "Diagnostic gratuit · lien juste sous la vidéo" });
        const rendu = m.rendus.filter((r) => r.reseaux.includes("facebook")).at(-1)!;
        expect(JSON.stringify(rendu.ligne)).toContain("lien juste sous la vidéo");
        expect(rendu.piste.mots.map((x) => x.mot).join(" ")).toMatch(/Le lien est juste sous la vidéo\.?$/);
        const l = fin.etat.livraison!.find((x) => x.reseau === "facebook")!;
        expect(l.texte).toContain(SECOURS_2);
        expect(l.premierCommentaire).toContain(l.lien!);
        expect(l.consigneLien).toMatch(/premier commentaire/);
        expect(l.mention).toBeUndefined();
        expect(fin.etat.journal.join(" ")).toMatch(/Fin de secours pour facebook : « Le lien est juste sous la vidéo\. »/);
        // Les autres réseaux gardent leur fin (Instagram : « … dans mon profil. »).
        expect(fin.etat.livraison!.find((x) => x.reseau === "instagram")!.texte).toContain(PROFIL);
        // Plus rien à refaire, même en relevant le plafond.
        const encore = await jusquAuBout(reprendreIV(fin.etat, { plafondCentimes: fin.etat.caisse.plafondCentimes + 500 }), o);
        expect(encore.etat.etape).toBe("prete");
        expect(m.lus.slice(lus)).toHaveLength(1);
      });

      for (const cas of ["hors", "hesite"] as const) {
        it(`secours 2 ${cas === "hors" ? "hors référence" : "HÉSITANT (« euh »)"} : UNE seule lecture de plus, puis repli Instagram dans le même passage (0 lecture), vidéo prête, mention claire ; rien de plus après « Relever le plafond »`, async () => {
          const { m, o, etat } = await etatDeProd(cas);
          const lus = m.lus.length;
          const voixAvant = etat.caisse.reservations.filter((r) => r.etape === "voix").length;
          const fin = await jusquAuBout(reprendreIV(etat), o);
          expect(fin.etat.refus).toBeUndefined();
          expect(fin.etat.etape).toBe("prete");
          expect(fin.etat.controles?.verdict?.ok).toBe(true);
          // Une lecture : le secours 2 ; aucune après (ni relance, ni corps, ni autre fin).
          expect(m.lus.slice(lus)).toHaveLength(1);
          expect(m.lus.at(-1)!.endsWith(SECOURS_2)).toBe(true);
          expect(fin.etat.caisse.reservations.filter((r) => r.etape === "voix")).toHaveLength(voixAvant + 1);
          expect(m.lus.filter((t) => t.endsWith(SECOURS_2))).toHaveLength(1);
          expect(m.lus.filter((t) => t.endsWith(SECOURS))).toHaveLength(1);
          expect(engageCentimes(fin.etat)).toBeLessThanOrEqual(fin.etat.caisse.plafondCentimes);
          expect(fin.etat.journal.join(" ")).toMatch(cas === "hors" ? /Fin de secours refusée : La voix de la fin de secours pour facebook ne ressemble pas non plus/ : /Fin de secours refusée : La fin de secours pour facebook hésite/);
          expect(fin.etat.journal.join(" ")).toContain(REPLI);

          // Facebook = la version Instagram : même fin dite, même son, même rendu.
          const ig = fin.etat.plan!.fins.find((f) => f.reseaux.includes("instagram"))!;
          const fb = fin.etat.plan!.fins.find((f) => f.reseaux.includes("facebook"))!;
          expect(fb).toMatchObject({ repli: "instagram", reseaux: ["facebook"], question: ig.question, appels: ig.appels });
          expect(fb.secours).toBeUndefined();
          const segFb = fin.etat.voix!.segments.versions.find((x) => x.id === fb.id)!.segment;
          expect(segFb).toBe(fin.etat.voix!.segments.versions.find((x) => x.id === ig.id)!.segment);
          const renduFb = m.rendus.filter((r) => r.reseaux.includes("facebook")).at(-1)!;
          const renduIg = m.rendus.filter((r) => r.reseaux.includes("instagram")).at(-1)!;
          expect(renduFb.piste.mots).toEqual(renduIg.piste.mots);
          expect(JSON.stringify(renduFb.ligne.segmentFin)).toEqual(JSON.stringify(renduIg.ligne.segmentFin));
          expect(renduFb.piste.mots.map((x) => x.mot).join(" ")).toMatch(/Le lien est dans mon profil\.?$/);

          // Écran et rapport : mention claire ; publication cohérente avec ce qui est dit, lien aussi prêt en premier commentaire.
          const l = fin.etat.livraison!.find((x) => x.reseau === "facebook")!;
          expect(l.mention).toBe(REPLI);
          expect(l.texte).toContain(PROFIL);
          expect(l.texte).not.toMatch(/commentaire\.|sous la vidéo/);
          expect(l.premierCommentaire).toContain(l.lien!);
          expect(l.consigneLien).toMatch(/profil/);
          expect(l.consigneLien).toContain(REPLI);
          expect(l.consigneLien).toMatch(/vous pouvez aussi poser ce lien en premier commentaire/);
          expect(l.lien).toMatch(/utm_source=facebook/);
          const carte = cartesReseaux(fin.etat.livraison!).find((c) => c.reseau === "facebook")!;
          expect(carte).toMatchObject({ ton: "orange" });
          expect(carte.phrase).toContain("Facebook reprend la version Instagram");
          expect(fin.etat.controles?.verdict?.mentions).toContain(REPLI);

          // Plus aucune lecture payante au-delà, même après « Relever le plafond ».
          const encore = await jusquAuBout(reprendreIV(fin.etat, { plafondCentimes: fin.etat.caisse.plafondCentimes + 500 }), o);
          expect(encore.etat.etape).toBe("prete");
          expect(m.lus.slice(lus)).toHaveLength(1);
        });
      }

      it("repli : une fin déjà en repli n'a plus d'étape ; un arrêt de la voix après le repli n'est plus « Refait » par une lecture", async () => {
        const { o, etat } = await etatDeProd("hors");
        const fin = await jusquAuBout(reprendreIV(etat), o);
        const fb = fin.etat.plan!.fins.find((f) => f.reseaux.includes("facebook"))!;
        expect(etapeDeSecoursIV(fin.etat.plan!, fb.id)).toBeNull();
        // Arrêt Q16 fabriqué sur l'état final (même voix) : aucune étape de secours, rien à lire.
        const arrete: EtatFabricationIV = { ...fin.etat, etape: "refusee", refus: { etape: "voix", code: "IV_VOIX", message: "x", reessayable: false } };
        expect(planDeSecoursIV(arrete)).toBeNull();
      });

      it("chaîne : habituelle → secours 1 → secours 2 → repli Instagram ; une étape passée ne revient jamais", async () => {
        const { e, o } = demarrer("C");
        const plan = (await jusquAuBout(e, o)).etat.plan!;
        const id = plan.fins.find((f) => f.reseaux.includes("facebook"))!.id;
        const e1 = etapeDeSecoursIV(plan, id)!;
        expect(e1).toMatchObject({ lecture: true, phrase: SECOURS });
        const p1 = { ...plan, fins: plan.fins.map((f) => (f.id === id ? e1.fin : f)) };
        const e2 = etapeDeSecoursIV(p1, id)!;
        expect(e2).toMatchObject({ lecture: true, phrase: SECOURS_2 });
        expect(e2.fin.appels.map((a) => a.id)).not.toContain("fin-fb-lien-premier-commentaire");
        const p2 = { ...plan, fins: plan.fins.map((f) => (f.id === id ? e2.fin : f)) };
        const e3 = etapeDeSecoursIV(p2, id)!;
        expect(e3).toMatchObject({ lecture: false, phrase: REPLI });
        expect(e3.fin.appels.at(-1)).toMatchObject({ id: "fin-ig-lien-profil", dit: PROFIL });
        const p3 = { ...plan, fins: plan.fins.map((f) => (f.id === id ? e3.fin : f)) };
        expect(etapeDeSecoursIV(p3, id)).toBeNull();
        // 19/10 : Instagram et Shorts ont leur fin de secours (une seule, sans repli) ; LinkedIn (muet) n'a pas de chaîne.
        for (const f of plan.fins.filter((x) => x.id !== id && (x.muet || !x.reseaux.some((r) => r === "instagram" || r === "youtube-shorts")))) expect(etapeDeSecoursIV(plan, f.id)).toBeNull();
        for (const f of plan.fins.filter((x) => x.reseaux.some((r) => r === "instagram" || r === "youtube-shorts"))) expect(etapeDeSecoursIV(plan, f.id)).toMatchObject({ lecture: true, phrase: "Vous trouverez le lien juste en haut de mon profil." });
      });
    });

    it("mesure ancienne (versionMesure 1) à refaire : pas de fin de secours, la re-mesure gratuite passe d'abord", async () => {
      const ref: { m?: Monde } = {};
      const ANCIENNE = { ...HORS_REFERENCE, "voix.versionMesure": 1 };
      const d = demarrer("C", { mesureVoix: () => (ref.m!.lus.at(-1)!.endsWith(FIN_FB) ? ANCIENNE : MESURE_REFERENCE) });
      ref.m = d.m;
      const panne = (await jusquAuBout(d.e, d.o)).etat;
      // Studio-rendu « ancien » : la re-mesure part dès la voix finie (panne claire). État tel qu'il est gardé en prod :
      // voix finie, mesure version 1 gardée, refus Q16 non réessayable.
      expect(panne.refus).toMatchObject({ etape: "voix", code: "IV_PANNE" });
      const voix = structuredClone(panne.voix!);
      for (const x of [voix.voix.corps.prise, ...voix.voix.fins.map((f) => f.prise)]) if (x && (x.etat.phase === "a-remesurer" || x.etat.phase === "remesure")) x.etat = { phase: "faite", audio: x.etat.audio };
      voix.voix.issue = { statut: "faite" };
      const etat: EtatFabricationIV = { ...panne, voix, refus: { etape: "voix", code: "IV_VOIX", message: "La voix de la fin pour facebook ne ressemble pas assez à la voix de référence (hauteur +17 % (toléré 8 %)).", reessayable: false } };
      expect(voix.voix.fins.some((f) => f.prise?.etat.phase === "faite" && verdictSurMesureAncienne(f.prise.etat.audio))).toBe(true);
      expect(finsHorsReferenceIV(etat.voix)).toEqual([]);
      expect(planDeSecoursIV(etat)).toBeNull();
      // La re-mesure gratuite est proposée, mais pas comme fin de secours.
      expect(vueFabrication(etat).refus?.reessayable).toBe(true);
      expect(vueFabrication(etat).refus?.details.join(" ")).not.toMatch(/Fin de secours validée/);
      expect(reprendreIV(etat).plan).toEqual(etat.plan);
    });

    it("fin Facebook hors référence + une AUTRE fin hésitante : pas de fin de secours, l'écran ne la propose pas", async () => {
      const ref: { m?: Monde } = {};
      const d = demarrer("C", { mesureVoix: () => (ref.m!.lus.at(-1)!.endsWith(FIN_FB) ? HORS_REFERENCE : MESURE_REFERENCE) });
      ref.m = d.m;
      hesiterSur(d, "Le lien est dans mon profil.");
      const { etat } = await jusquAuBout(d.e, d.o);
      expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
      expect(d.m.lus.some((t) => t.endsWith(FIN_FB))).toBe(true);
      expect(planDeSecoursIV(etat)).toBeNull();
      expect(refusReessayableIV(etat)).toBe(false);
      expect(vueFabrication(etat).refus?.reessayable).toBe(false);
    });

    describe("19/10 · fin Instagram hors référence (v-6a3b74364711) : fin de secours, puis relecture de la seule fin", () => {
      const IG = "Le lien est dans mon profil.";
      const IG_S = "Vous trouverez le lien juste en haut de mon profil.";
      const FB_S1 = "Le lien est dans le premier commentaire.";
      const FB_S2 = "Le lien est juste sous la vidéo.";
      type Verdict = "ok" | "hors";

      /**
       * Monde où chaque lecture est jugée selon sa fin de texte et son rang de lecture : `verdicts[fin]` vaut un verdict pour
       * toutes les lectures, ou une liste (verdict de la 1ʳᵉ, de la 2ᵉ… lecture de ce texte, le dernier ensuite). Les appels à la
       * voix sont gardés avec leur indicateur de lecture neuve.
       */
      function monter(verdicts: Record<string, Verdict | Verdict[]>) {
        const ref: { m?: Monde } = {};
        const mesure = () => {
          const lus = ref.m!.lus;
          const t = lus.at(-1)!;
          const cle = Object.keys(verdicts).find((k) => t.endsWith(k));
          if (!cle) return MESURE_REFERENCE;
          const n = lus.filter((x) => x.endsWith(cle)).length;
          const v = verdicts[cle];
          return (Array.isArray(v) ? (v[n - 1] ?? v.at(-1)) : v) === "hors" ? HORS_REFERENCE : MESURE_REFERENCE;
        };
        const d = demarrer("C", { mesureVoix: mesure });
        ref.m = d.m;
        const appels: { texte: string; neuve: boolean }[] = [];
        const voix = d.o.voix.voix() as unknown as { lire: (x: { texte: string; nouvelleLecture?: boolean }) => Promise<unknown> };
        const lire = voix.lire.bind(voix);
        voix.lire = async (x) => {
          appels.push({ texte: x.texte, neuve: !!x.nouvelleLecture });
          return lire(x);
        };
        return { ...d, appels };
      }
      type Banc = ReturnType<typeof monter>;
      const reprendre = async (b: Banc, etat: EtatFabricationIV, plus: { plafondCentimes?: number } = {}) => (await jusquAuBout(reprendreIV(etat, plus), b.o)).etat;
      /** Le départ : vidéo montée jusqu'à l'arrêt Q16 (tel que gardé en prod). */
      const partir = async (b: Banc) => (await jusquAuBout(b.e, b.o)).etat;
      const fin = (etat: EtatFabricationIV, reseau: "instagram" | "facebook" | "youtube-shorts") => etat.plan!.fins.find((f) => f.reseaux.includes(reseau))!;
      const liv = (etat: EtatFabricationIV, reseau: string) => etat.livraison!.find((l) => l.reseau === reseau)!;

      it("(a) état de prod : fin Instagram hors référence après ses 2 lectures → « Refaire » proposé avec la fin de secours ; UNE lecture de plus, vidéo prête, lien dans le profil", async () => {
        const b = monter({ [IG]: "hors" });
        const etat = await partir(b);
        expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
        expect(etat.refus?.message).toMatch(/La voix de la fin pour youtube-shorts, instagram ne ressemble pas assez à la voix de référence/);
        expect(b.m.lus.filter((t) => t.endsWith(IG))).toHaveLength(2);
        const v = vueFabrication(etat);
        expect(v.refus?.reessayable).toBe(true);
        expect(v.refus?.details[0]).toMatch(/Fin de secours validée par Will pour youtube-shorts, instagram : « Vous trouverez le lien juste en haut de mon profil\. »\. « Refaire cette partie » lit seulement cette fin \(une lecture payée\)/);
        expect(v.refus?.details[0]).toContain("« Refaire cette partie » pourra la relire une dernière fois (une lecture payée)");
        expect(planDeSecoursIV(etat)).toMatchObject({ lecture: true, reseaux: ["youtube-shorts", "instagram"], phrases: [IG_S], replis: [], relire: [] });

        const lus = b.m.lus.length;
        const voixAvant = etat.caisse.reservations.filter((r) => r.etape === "voix");
        const apres = await reprendre(b, etat);
        expect(apres.refus).toBeUndefined();
        expect(apres.etape).toBe("prete");
        const nouvelles = b.m.lus.slice(lus);
        expect(nouvelles).toHaveLength(1);
        expect(nouvelles[0]).toMatch(/Faites votre diagnostic gratuit en quelques minutes\. Vous trouverez le lien juste en haut de mon profil\.$/);
        const voixApres = apres.caisse.reservations.filter((r) => r.etape === "voix");
        expect(voixApres.slice(0, voixAvant.length)).toEqual(voixAvant);
        expect(voixApres.slice(voixAvant.length)).toHaveLength(1);
        expect(voixApres.at(-1)!.cle).toMatch(/iv-voix-fin-[a-z-]+-[0-9a-f]{10}-\d+$/);
        expect(engageCentimes(apres)).toBeLessThanOrEqual(apres.caisse.plafondCentimes);
        // Instagram : écran identique à la fin normale, secours sans repli ; Shorts : sa propre ligne, même texte dit.
        expect(fin(apres, "instagram")).toMatchObject({ secours: true });
        expect(fin(apres, "instagram").appels.at(-1)).toMatchObject({ id: "fin-ig-lien-profil-secours", dit: IG_S, ecran: "Diagnostic gratuit · lien dans le profil" });
        expect(fin(apres, "youtube-shorts").appels.at(-1)).toMatchObject({ id: "fin-ys-lien-profil-secours", dit: IG_S });
        // Dite, affichée, publiée : le lien reste dans le PROFIL (pas en premier commentaire).
        const rendu = b.m.rendus.filter((r) => r.reseaux.includes("instagram")).at(-1)!;
        expect(rendu.piste.mots.map((x) => x.mot).join(" ")).toMatch(/Vous trouverez le lien juste en haut de mon profil\.?$/);
        expect(JSON.stringify(rendu.ligne)).toContain("lien dans le profil");
        const ig = liv(apres, "instagram");
        expect(ig.texte).toContain(IG_S);
        expect(ig.premierCommentaire).toBeUndefined();
        expect(ig.consigneLien).toMatch(/profil/);
        expect(ig.consigneLien).not.toMatch(/commentaire/);
        expect(liv(apres, "youtube-shorts").premierCommentaire).toBeUndefined();
        expect(apres.journal.join(" ")).toMatch(/Fin de secours pour youtube-shorts, instagram/);
        // La fin Facebook ne change pas.
        expect(fin(apres, "facebook")).toEqual(fin(etat, "facebook"));
        expect(liv(apres, "facebook").texte).toContain("Le lien est en commentaire.");
      });

      it("(b) secours Instagram refusé à son tour → l'écran propose de relire seulement cette fin ; UNE lecture neuve du même texte (essai ≥ 3), vidéo prête si elle est bonne", async () => {
        const b = monter({ [IG]: "hors", [IG_S]: ["hors", "ok"] });
        const e1 = await partir(b);
        const e2 = await reprendre(b, e1);
        expect(e2.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
        expect(e2.refus?.message).toMatch(/La voix de la fin de secours pour .*ne ressemble pas non plus à la voix de référence/);
        expect(b.m.lus.filter((t) => t.endsWith(IG_S))).toHaveLength(1);
        const v = vueFabrication(e2);
        expect(v.refus?.reessayable).toBe(true);
        expect(v.refus?.details[0]).toMatch(/Relecture de la seule fin pour youtube-shorts, instagram : « Refaire cette partie » la relit à l'identique \(1 lecture payée au plus, environ \d+,\d\d €\) ; le corps et les autres fins déjà payés sont gardés\. Si elle ne ressemble toujours pas à la référence, la vidéo s'arrête pour de bon\./);
        expect(v.refus?.details[0]).not.toMatch(/Fin de secours validée/);
        const s = planDeSecoursIV(e2)!;
        expect(s).toMatchObject({ lecture: true, phrases: [], replis: [] });
        expect(s.relire).toHaveLength(1);
        expect(s.relire[0]).toMatch(/Vous trouverez le lien juste en haut de mon profil\.$/);
        expect(s.plan).toEqual(e2.plan);

        const lus = b.m.lus.length;
        const appels = b.appels.length;
        const voixAvant = e2.caisse.reservations.filter((r) => r.etape === "voix");
        const e3 = await reprendre(b, e2);
        expect(e3.refus).toBeUndefined();
        expect(e3.etape).toBe("prete");
        const nouvelles = b.m.lus.slice(lus);
        expect(nouvelles).toEqual([s.relire[0]]);
        expect(b.appels.slice(appels)).toEqual([{ texte: s.relire[0], neuve: true }]);
        const voixApres = e3.caisse.reservations.filter((r) => r.etape === "voix");
        expect(voixApres.slice(0, voixAvant.length)).toEqual(voixAvant);
        expect(voixApres.slice(voixAvant.length)).toHaveLength(1);
        expect(voixApres.at(-1)!.cle).toMatch(/iv-voix-fin-[a-z-]+-[0-9a-f]{10}-\d+$/);
        const prise = e3.voix!.voix.fins.find((f) => f.texte === s.relire[0])!.prise!;
        expect(prise.essai).toBeGreaterThanOrEqual(3);
        expect(e3.voix!.relues).toEqual([s.relire[0]]);
        expect(e3.voix!.relire).toBeUndefined();
        expect(engageCentimes(e3)).toBeLessThanOrEqual(e3.caisse.plafondCentimes);
        expect(liv(e3, "instagram").texte).toContain(IG_S);
        expect(liv(e3, "instagram").premierCommentaire).toBeUndefined();
        expect(e3.journal.join(" ")).toMatch(/Relecture de la seule fin pour youtube-shorts, instagram \(lecture neuve du même texte\)/);
        // Les fins déjà payées et la fin Facebook ne bougent pas.
        expect(fin(e3, "facebook")).toEqual(fin(e2, "facebook"));
      });

      it("(c) la relecture est refusée aussi : la vidéo s'arrête pour de bon (pas de « Refaire »), même après « Relever le plafond » ; rien n'est relu", async () => {
        const b = monter({ [IG]: "hors", [IG_S]: "hors" });
        const e2 = await reprendre(b, await partir(b));
        const e3 = await reprendre(b, e2);
        expect(e3.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: false });
        expect(b.m.lus.filter((t) => t.endsWith(IG_S))).toHaveLength(2);
        expect(planDeSecoursIV(e3)).toBeNull();
        expect(vueFabrication(e3).refus?.reessayable).toBe(false);
        expect(refusReessayableIV(e3)).toBe(false);
        const lus = b.m.lus.length;
        const e4 = await reprendre(b, e3, { plafondCentimes: e3.caisse.plafondCentimes + 500 });
        expect(e4.etape).toBe("refusee");
        expect(e4.refus).toMatchObject({ code: "IV_VOIX", reessayable: false });
        expect(b.m.lus).toHaveLength(lus);
        expect(b.m.lus.filter((t) => t.endsWith(IG_S))).toHaveLength(2);
      });

      it("(d) plafond trop bas pour la relecture : refus « budget » réessayable, rien n'est lu ; une fois le plafond relevé, UNE seule lecture", async () => {
        const b = monter({ [IG]: "hors", [IG_S]: ["hors", "ok"] });
        const e2 = await reprendre(b, await partir(b));
        const lus = b.m.lus.length;
        const e3 = await reprendre(b, e2, { plafondCentimes: engageCentimes(e2) });
        expect(e3.etape).toBe("refusee");
        expect(e3.refus).toMatchObject({ etape: "voix", reessayable: true });
        expect(e3.refus!.code).toMatch(/IV_PLAFOND|IV_BUDGET/);
        expect(b.m.lus).toHaveLength(lus);
        const e4 = await reprendre(b, e3, { plafondCentimes: engageCentimes(e3) + 500 });
        expect(e4.etape).toBe("prete");
        expect(b.m.lus).toHaveLength(lus + 1);
        expect(b.m.lus.at(-1)).toMatch(/Vous trouverez le lien juste en haut de mon profil\.$/);
      });

      it("(e) Facebook ET Instagram hors référence ensemble, chacun jusqu'au bout de sa chaîne : secours 2 de Facebook + relecture d'Instagram, jamais « condamnée » ; chaque texte lu au plus le nombre de fois permis", async () => {
        const b = monter({ [FIN_FB]: "hors", [IG]: "hors", [FB_S1]: "hors", [IG_S]: ["hors", "ok"] });
        let etat = await partir(b);
        for (let i = 0; i < 6 && etat.etape !== "prete"; i++) {
          expect(etat.refus, `tour ${i}`).toMatchObject({ code: "IV_VOIX" });
          expect(vueFabrication(etat).refus?.reessayable, `tour ${i}`).toBe(true);
          etat = await reprendre(b, etat);
        }
        expect(etat.etape).toBe("prete");
        const lus = (f: string) => b.m.lus.filter((t) => t.endsWith(f)).length;
        expect([lus(FIN_FB), lus(FB_S1), lus(FB_S2), lus(IG), lus(IG_S)]).toEqual([2, 1, 1, 2, 2]);
        expect(engageCentimes(etat)).toBeLessThanOrEqual(etat.caisse.plafondCentimes);
        expect(fin(etat, "facebook").appels.at(-1)).toMatchObject({ id: "fin-fb-lien-sous-video", dit: FB_S2 });
        expect(fin(etat, "instagram").appels.at(-1)).toMatchObject({ id: "fin-ig-lien-profil-secours" });
        expect(liv(etat, "facebook").premierCommentaire).toBeTruthy();
        expect(liv(etat, "instagram").premierCommentaire).toBeUndefined();
      });

      it("(e bis) secours 1 de Facebook ET secours d'Instagram refusés dans le même état : secours 2 de Facebook + relecture d'Instagram, deux lectures payées au plus, pas de refus définitif", () => {
        const texte = (dit: string) => `Question ? Faites votre diagnostic gratuit en quelques minutes. ${dit}`;
        const diag = { id: "fin-if-diagnostic-gratuit", groupe: "instagram-facebook", type: "rendez-vous", dit: "Faites votre diagnostic gratuit en quelques minutes.", ecran: "x" };
        const plan = {
          fins: [
            { id: "fin-facebook", reseaux: ["facebook"], muet: false, secours: true, appels: [diag, { id: "fin-fb-lien-premier-commentaire", groupe: "instagram-facebook", type: "lien", dit: FB_S1, ecran: "x" }] },
            { id: "fin-instagram", reseaux: ["instagram"], muet: false, secours: true, appels: [diag, { id: "fin-ig-lien-profil-secours", groupe: "instagram-facebook", type: "lien", dit: IG_S, ecran: "x" }] },
          ],
          reduites: [],
          sansFin: [],
        } as unknown as Parameters<typeof secoursApresArretIV>[1];
        const refusee = (dit: string) => ({ texte: dit, empreinte: "e", etat: { phase: "a-relire", texte: dit, prises: [{ ecarts: ["hauteur +24 %"] }] } });
        const t1 = texte(FB_S1);
        const t2 = texte(IG_S);
        const voix = {
          segments: {
            corps: "c",
            fins: [{ id: "fin-facebook", texte: t1, reseaux: ["facebook"], secours: true }, { id: "fin-instagram", texte: t2, reseaux: ["instagram"], secours: true }],
            versions: [{ id: "fin-facebook", reseaux: ["facebook"], segment: "fin-facebook" }, { id: "fin-instagram", reseaux: ["instagram"], segment: "fin-instagram" }],
          },
          voix: { corps: { texte: "c", lectures: 1, retenu: true, prise: { texte: "c", empreinte: "c", etat: { phase: "faite", audio: {} }, controle: { ok: true } } }, fins: [{ id: "fin-facebook", texte: t1, prise: refusee(t1) }, { id: "fin-instagram", texte: t2, prise: refusee(t2) }], payees: [], reformulations: [] },
        } as unknown as Parameters<typeof secoursApresArretIV>[0];
        const s = secoursApresArretIV(voix, plan)!;
        expect(s).not.toBeNull();
        expect(s.phrases).toEqual([FB_S2]);
        expect(s.relire).toEqual([t2]);
        expect(s.lecture).toBe(true);
        expect(s.plan.fins.find((f) => f.reseaux.includes("facebook"))!.appels.at(-1)).toMatchObject({ id: "fin-fb-lien-sous-video" });
        expect(s.plan.fins.find((f) => f.reseaux.includes("instagram"))).toEqual(plan.fins[1]);
        // Deux lectures au plus : une nouvelle fin de secours (1) + une relecture (1).
        expect(s.coutMaxCentimes).toBeGreaterThan(0);
        // Relecture déjà faite pour ce texte : plus de relecture, donc plus rien à proposer.
        expect(secoursApresArretIV({ ...voix, relues: [t2] } as never, plan)).toBeNull();
      });

      it("(f) Instagram en secours accepté, secours 2 de Facebook refusé aussi : Facebook reprend la version Instagram de secours, sans lecture de plus", async () => {
        const b = monter({ [FIN_FB]: "hors", [FB_S1]: "hors", [FB_S2]: "hors", [IG]: "hors", [IG_S]: "ok" });
        let etat = await partir(b);
        for (let i = 0; i < 6 && etat.etape !== "prete"; i++) {
          expect(etat.refus, `tour ${i}`).toMatchObject({ code: "IV_VOIX" });
          etat = await reprendre(b, etat);
        }
        expect(etat.etape).toBe("prete");
        const lus = (f: string) => b.m.lus.filter((t) => t.endsWith(f)).length;
        expect([lus(FB_S1), lus(FB_S2), lus(IG_S)]).toEqual([1, 1, 1]);
        const ig = fin(etat, "instagram");
        const fb = fin(etat, "facebook");
        expect(fb).toMatchObject({ repli: "instagram", reseaux: ["facebook"], appels: ig.appels });
        expect(fb.secours).toBeUndefined();
        expect(fb.appels.at(-1)).toMatchObject({ id: "fin-ig-lien-profil-secours", dit: IG_S });
        const l = liv(etat, "facebook");
        expect(l.texte).toContain(IG_S);
        expect(l.mention).toMatch(/Facebook reprend la version Instagram/);
        expect(l.premierCommentaire).toContain(l.lien!);
      });

      it("(g) ancien état (sans `relire` ni `relues`) : tout marche ; un plan sans secours donne des segments de voix inchangés (aucun champ de plus)", async () => {
        const b = monter({});
        const etat = await partir(b);
        expect(etat.etape).toBe("prete");
        expect(etat.voix!.relire).toBeUndefined();
        expect(etat.voix!.relues).toBeUndefined();
        for (const s of etat.voix!.segments.fins) expect(Object.keys(s).sort()).toEqual(["id", "reseaux", "texte"]);
        for (const v of etat.voix!.segments.versions) expect(Object.keys(v).sort()).toEqual(["id", "reseaux", "segment"]);
        // Une voix gardée avant ce correctif (sans `relues`) se lit comme avant : rien à proposer quand tout est accepté.
        expect(secoursApresArretIV(etat.voix!, etat.plan!)).toBeNull();
      });
    });
  });

  it("panne de HeyGen sur une fin : refus réessayable ; la reprise ne relit pas le corps payé", async () => {
    const { m, o, e } = demarrer("C", { pannesVoix: [2] });
    const { etat } = await jusquAuBout(e, o);
    expect(etat.etape).toBe("refusee");
    expect(etat.refus).toMatchObject({ etape: "voix", code: "IV_PANNE", reessayable: true });
    const corps = m.lus.length;
    expect(corps).toBe(1);
    const fin = await jusquAuBout(reprendreIV(etat), o);
    expect(fin.etat.etape).toBe("prete");
    // Le corps n'est jamais relu : seules les fins sont lues après la reprise.
    expect(m.lus.filter((t) => t === m.lus[0]).length).toBe(1);
    expect(fin.etat.tentatives.voix).toBe(2);
  });

  it("rendu en cours : attente, rien n'est perdu ni compté deux fois, le pas suivant reprend", async () => {
    const { m, o, e } = demarrer("D", { rendusEnCours: [1] });
    let etat = (await jusquAuBout(e, o)).etat;
    // `jusquAuBout` relance après une attente : la vidéo finit prête, avec un seul rendu par version.
    expect(etat.etape).toBe("prete");
    expect(m.rendus.length).toBe(Object.keys(etat.rendus ?? {}).length);
    // Une attente garde l'état et la caisse.
    const x = demarrer("D", { rendusEnCours: [1, 2, 3] });
    etat = await avancerJusquAArretIV(validerScriptIV(await auScriptDe(x), decisionScript(await auScriptDe(x))), x.o);
    for (let i = 0; i < 10 && !etat.attente; i++) etat = await avancerIV(etat, x.o);
    expect(etat.attente).toMatch(/en cours/);
    expect(etat.etape).toBe("rendu");
    const avant = engageCentimes(etat);
    etat = await avancerIV(etat, x.o);
    expect(engageCentimes(etat)).toBe(avant);
  });

  it("écriture refusée deux fois : refus réessayable, la nouvelle tentative est comptée à part (jamais gratuite en silence)", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let vide = true;
    const o: OutilsFabricationIV = { ...base, ecriture: { appeler: async (role, entree) => (vide ? { ok: true, simule: true, texte: "" } : base.ecriture.appeler(role, entree)) } };
    let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte)), o);
    e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    expect(e.refus).toMatchObject({ etape: "ecriture", code: "IV_ECRITURE", reessayable: true });
    expect(e.caisse.reservations.filter((r) => r.etape === "ecriture")).toHaveLength(2);
    vide = false;
    e = await avancerJusquAArretIV(reprendreIV(e), o);
    expect(e.etape).toBe("script-a-valider");
    expect(e.caisse.reservations.filter((r) => r.etape === "ecriture")).toHaveLength(3);
  });

  it("contrôles refusés puis repris : transcriptions et relectures déjà payées ne sont pas redemandées", async () => {
    const { m, o, e } = demarrer("C");
    const prete = (await jusquAuBout(e, o)).etat;
    const transcriptions = m.transcriptions.length;
    const relectures = m.appelsClaude.filter((a) => a.role === "relecture-finale-iv").length;
    expect(transcriptions).toBeGreaterThan(0);
    // On rejoue la porte depuis les mêmes rendus (état gardé) : rien n'est repayé.
    const rejeu = await avancerIV({ ...structuredClone(prete), etape: "controles" }, o);
    expect(rejeu.etape).toBe("livraison");
    expect(m.transcriptions.length).toBe(transcriptions);
    expect(m.appelsClaude.filter((a) => a.role === "relecture-finale-iv").length).toBe(relectures);
  });
});

async function auScriptDe(x: ReturnType<typeof demarrer>): Promise<EtatFabricationIV> {
  const e = await avancerJusquAArretIV(x.e, x.o);
  return avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), x.o);
}

/* ------------------------------------------------------------------ */
/* Plafond par vidéo et budget                                           */
/* ------------------------------------------------------------------ */

describe("plafond par vidéo : arrêt net, jamais dépassé", () => {
  it("plafond trop bas pour la lecture : aucun appel, refus « plafond »", async () => {
    const { m, o, e } = demarrer("C", {}, { plafondCentimes: 10 });
    const apres = await avancerJusquAArretIV(e, o);
    expect(apres.refus).toMatchObject({ code: "IV_PLAFOND", etape: "lecture" });
    expect(apres.refus?.message).toMatch(/Plafond de cette vidéo atteint \(0,10 €/);
    expect(m.appelsClaude).toEqual([]);
    expect(m.depenses).toEqual([]);
  });

  it("plafond atteint à la voix : aucune lecture HeyGen ; relevé par Will, la fabrication reprend sans rien repayer", async () => {
    // Depuis #248, l'écriture réserve plus : le plafond bas se pose une fois le script écrit, comme le ferait Will.
    const x = demarrer("C", {}, { plafondCentimes: 500 });
    let e = await auScriptDe(x);
    e = reprendreIV(e, { plafondCentimes: engageCentimes(e) });
    expect(e.etape).toBe("script-a-valider");
    e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), x.o);
    expect(e.refus).toMatchObject({ code: "IV_PLAFOND", etape: "voix", reessayable: true });
    expect(x.m.lus).toEqual([]);
    const appels = x.m.appelsClaude.length;
    const fin = await jusquAuBout(reprendreIV(e, { plafondCentimes: 500 }), x.o);
    expect(fin.etat.etape).toBe("prete");
    // Lecture et écriture ne sont jamais refaites ; seule la relecture finale appelle Claude ensuite.
    expect(x.m.appelsClaude.slice(appels).every((a) => a.role === "relecture-finale-iv")).toBe(true);
  });

  it("plafond atteint au milieu de la voix : le corps payé est gardé, jamais relu", async () => {
    const x = demarrer("C", {}, { plafondCentimes: 500 });
    let e = await auScriptDe(x);
    e = validerScriptIV(e, decisionScript(e));
    // Un pas : le corps est lu (et payé).
    e = await avancerIV(e, x.o);
    expect(x.m.lus.length).toBe(1);
    // Will baisse le plafond à ce qui est déjà engagé : la première fin ne peut plus être réservée.
    e = reprendreIV(e, { plafondCentimes: engageCentimes(e) });
    e = await avancerJusquAArretIV(e, x.o);
    expect(e.refus?.code).toBe("IV_PLAFOND");
    expect(x.m.lus.length).toBe(1);
    expect(engageCentimes(e)).toBeLessThanOrEqual(e.caisse.plafondCentimes);
    const fin = await jusquAuBout(reprendreIV(e, { plafondCentimes: 500 }), x.o);
    expect(fin.etat.etape).toBe("prete");
    expect(x.m.lus.filter((t) => t === x.m.lus[0]).length).toBe(1);
  });

  it("budget du studio refusé (crédit) : refus « budget », rien n'est lu", async () => {
    const x = demarrer("C", { refuserDepense: (d) => (d.fournisseur === "heygen" ? "Crédit insuffisant chez le fournisseur." : null) });
    let e = await auScriptDe(x);
    e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), x.o);
    expect(e.refus).toMatchObject({ code: "IV_BUDGET", etape: "voix" });
    expect(x.m.lus).toEqual([]);
  });

  it("taux prudent : jamais moins d'1 € pour 1 $ ; le tarif de la voix est majoré de même", () => {
    expect(centimesEurDeUsd(1, 0.9)).toBe(100);
    expect(centimesEurDeUsd(1, 1.1)).toBe(110);
    expect(centimesEurDeUsd(0.0012, 0.9)).toBe(1);
    expect(tarifVoixCentimesEur(0.03, 0.9)).toBe(0.03);
    expect(tarifVoixCentimesEur(0.03, 1.2)).toBeCloseTo(0.036, 10);
  });
});

/* ------------------------------------------------------------------ */
/* Bruitages                                                             */
/* ------------------------------------------------------------------ */

describe("bruitages : ceux de la v4 comptent comme validés", () => {
  it("les 5 familles, variantes 1 à 4, fichiers présents ; ni verre ni tableau", () => {
    expect(BRUITAGES_V4_IV).toHaveLength(20);
    expect(new Set(BRUITAGES_V4_IV.map((b) => b.declencheur))).toEqual(new Set(["chiffre", "document", "telephone", "illustration-forte", "impact"]));
    for (const b of BRUITAGES_V4_IV) {
      expect(b.variante).toBeGreaterThanOrEqual(1);
      expect(b.variante).toBeLessThanOrEqual(4);
      expect(existsSync(join(process.cwd(), "public", b.cle))).toBe(true);
    }
    expect(BRUITAGES_V4_IV.some((b) => /verre|tableau/.test(b.cle))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Moteur (contrat MoteurVideo)                                          */
/* ------------------------------------------------------------------ */

function commande(carte: CarteImage, plus: Record<string, unknown> = {}): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-image-video",
    videoId: `v-${carte.image.empreinte}`,
    formatId: "image-video",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [],
    styles: {},
    briques: {},
    entrees: { imageVideo: { imageCle: carte.image.cle, empreinte: carte.image.empreinte, plafondCentimes: 500, codeSuivi: "essai", accordEssaiReel: true, ...plus } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 500, devise: "EUR" },
    tauxUsdEur: 0.9,
    construiteLe: "2026-10-15T08:00:00.000Z",
  } as unknown as CommandeFabrication;
}

const T0 = Date.UTC(2026, 9, 15, 8, 0, 0);
const CONTEXTE = { travailId: "t-iv", versionId: "ver-1", titre: "Essai", maintenant: T0 };

describe("moteur « montage-image-video » (contrat MoteurVideo)", () => {
  it("refuse tout lancement réel tant que le format est masqué et que Will n'a pas donné son accord", async () => {
    const carte = carteFixe("C");
    const moteur = creerMoteurMontageImageVideo();
    expect(moteur.refusAuLancement?.(commande(carte, { accordEssaiReel: false }))).toEqual({ code: "IV_FORMAT_MASQUE", message: PHRASE_FORMAT_MASQUE });
    const t = await moteur.lancer(commande(carte, { accordEssaiReel: false }), CONTEXTE);
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("IV_FORMAT_MASQUE");
    expect(moteur.refusAuLancement?.(commande(carte))).toBeNull();
    expect(moteur.refusAuLancement?.(commande(carte, { imageCle: "" }))?.code).toBe("IV_SANS_IMAGE");
    expect(creerMoteurMontageImageVideo({ statutFormat: "actif" }).refusAuLancement?.(commande(carte, { accordEssaiReel: false }))).toBeNull();
  });

  it("portes de Will en échec réessayable, puis vidéo terminée : une sortie 9:16, la voix payée en lignes réelles", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    const decisions: { carte?: DecisionCarteIV; script?: DecisionScriptIV } = {};
    const outils: OutilsFabricationIV = { ...base, decisions: { carte: async () => decisions.carte ?? null, script: async () => decisions.script ?? null } };
    const moteur = creerMoteurMontageImageVideo({ outils: async () => outils, numeroVersion: async () => 42 });
    const c = commande(carte);
    let t: Travail = await moteur.lancer(c, CONTEXTE);
    let resultat: Awaited<ReturnType<typeof moteur.avancer>>["resultat"];
    const tourner = async () => {
      for (let i = 0; i < 400 && t.statut !== "echec" && t.statut !== "termine"; i++) {
        const r = await moteur.avancer(t, c, T0 + i * 1000);
        t = JSON.parse(JSON.stringify(r.travail));
        resultat = r.resultat ?? resultat;
      }
    };
    await tourner();
    expect(t.statut).toBe("echec");
    expect(t.erreur).toMatchObject({ code: CODE_CARTE_A_VALIDER, reessayable: true });
    expect(t.etapes.find((x) => x.statut === "echec")?.cle).toBe("carte-a-valider");
    const etat = t.parametres!.imageVideo as EtatFabricationIV;
    decisions.carte = decisionCarte(etat);
    t = await moteur.reessayer(t, T0);
    await tourner();
    expect(t.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER, reessayable: true });
    decisions.script = decisionScript(t.parametres!.imageVideo as EtatFabricationIV);
    t = await moteur.reessayer(t, T0);
    await tourner();
    expect(t.statut).toBe("termine");
    expect(t.etapes.every((x) => x.statut === "terminee")).toBe(true);
    expect(resultat!.sorties).toHaveLength(1);
    expect(resultat!.sorties[0].ratio).toBe("9:16");
    expect(moteur.lignesPayees?.(t, c)).toEqual([expect.objectContaining({ etape: "Voix", nature: "reel", fournisseur: "heygen-simule" })]);
  });

  it("estime en LigneCout, total cohérent ; étapes enchaînées", async () => {
    const moteur = creerMoteurMontageImageVideo();
    const e = await moteur.estimer(commande(carteFixe("C")));
    expect(e.total.centimes).toBe(e.lignes.reduce((s, l) => s + l.total.centimes, 0));
    expect(e.lignes.every((l) => Number.isInteger(l.total.centimes) && l.total.centimes >= 0)).toBe(true);
    const etapes = moteur.etapes(commande(carteFixe("C")));
    expect(etapes.map((x) => x.cle)).toEqual(["lecture", "carte-a-valider", "ecriture", "script-a-valider", "voix", "mise-en-scene", "rendu", "controles", "livraison"]);
    etapes.forEach((x, i) => expect(x.dependDe).toEqual(i ? [etapes[i - 1].cle] : []));
  });
});

/* ------------------------------------------------------------------ */
/* Fiche du format et raccords                                           */
/* ------------------------------------------------------------------ */

describe("fiche du format « image-video » (code IV)", () => {
  it("masquée, code IV, sans musique, 9:16, moteur montage-image-video, réglages par défaut", () => {
    expect(formatImageVideo).toMatchObject({ id: "image-video", statut: "masque", codeClassement: "IV", musique: "interdite", moteur: "montage-image-video", ratios: ["9:16"] });
    expect(formatImageVideo.reseauxConseilles).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    expect(schemaReglagesImageVideo.parse({})).toEqual({ decoupage: "chapitres", appelCommentaire: "question-puis-fin", validationCarte: "si-doute", bruitages: "discrets" });
    expect(schemaReglagesImageVideo.safeParse({ decoupage: "deux-videos" }).success).toBe(false);
    expect(schemaReglagesImageVideo.safeParse({ bruitages: "forts" }).success).toBe(false);
  });

  it("L17 : les 5 raccords partagés sont posés, un seul chacun, et le format reste masqué", () => {
    expect(RACCORDS_IMAGE_VIDEO.map((r) => r.fichier)).toEqual(["src/formats/registre-codes.ts", "src/formats/index.ts", "src/moteurs/ids.ts", "src/moteurs/index.ts", "studio-rendu/compositions/Racine.tsx"]);
    const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    const compte = (texte: string, motif: RegExp) => texte.match(new RegExp(motif.source, "g"))?.length ?? 0;
    expect(compte(lire("src/formats/registre-codes.ts"), /\{ code: "IV", formatId: "image-video", creeLe: "2026-10-15" \}/)).toBe(1);
    expect(compte(lire("src/formats/index.ts"), /formatImageVideo/)).toBe(2); // import + liste FORMATS
    expect(compte(lire("src/moteurs/ids.ts"), /"montage-image-video"/)).toBe(1);
    expect(compte(lire("src/moteurs/index.ts"), /moteurMontageImageVideo/)).toBe(2); // import + table MOTEURS
    expect(compte(lire("studio-rendu/compositions/Racine.tsx"), /CompositionsImageVideo/)).toBe(2); // import + <CompositionsImageVideo />
    // La ligne FA (face caméra animée) reste en place, juste avant la nôtre.
    expect(lire("src/formats/registre-codes.ts")).toMatch(/code: "FA", formatId: "facecam-animee"[^\n]*\n\s*\{ code: "IV"/);
  });

  it("L17 : inscrit mais MASQUÉ — absent des menus, présent pour le générateur et le moteur", () => {
    expect(listerFormats().some((f) => f.id === "image-video")).toBe(false);
    expect(listerFormats({ inclureMasques: true }).some((f) => f.id === "image-video")).toBe(true);
    expect(formatGenerateur("image-video").codeClassement).toBe("IV");
    expect(codeDuFormat("image-video")).toBe("IV");
    expect(moteurExiste("montage-image-video")).toBe(true);
    expect(obtenirMoteur("montage-image-video")).toBe(moteurMontageImageVideo);
    expect(idMoteurDeCommande({ formatId: "image-video" })).toBe("montage-image-video");
  });
});
