/**
 * Mission H — briques communes à tous les formats : API unique du motion design (`cartesPourFormat`), rendu commun des
 * cartes, brique monteur (relecture, ancrage, adaptateurs facecam et avocat), multicaméra dans la composition commune,
 * adaptateur face caméra et analyseur réel des angles (calculs purs). Aucun appel réseau, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CATALOGUE_ACTIF, cartesPourFormat, ratiosMotion, type PhraseMotion } from "@/briques/motion";
import { avancerCartesMotion, cartesMotionEcartees, cartesMotionFinies, cartesPleinEcranDuRatio, etatInitialCartesMotion } from "@/briques/motion/rendu-cartes";
import { ancreConsigne as ancreBrique, consignesDites, familleDeLaConsigne, lireReponseOperations, modelesCartes, motsSansCoupe, refusClair, schemaReponsePour, schemaZoomCommun, schemaTitreCommun, schemaRetirerCommun, trierOperations } from "@/briques/monteur";
import { multicameraPourComposition, pisteMulticameraFacecam, poserPlansCamera, partsDesAngles } from "@/briques/multicamera";
import type { PlanScene } from "@/briques/composition/scene";
import { lireReponseMonteur, schemaOperationFacecam, schemaRetirer, schemaTitre, schemaZoom } from "@/moteurs/montage-facecam/monteur/operations";
import { ancreConsigne as ancreFacecam } from "@/moteurs/montage-facecam/monteur/role";
import { adaptateurMonteur } from "@/moteurs/monteurs";
import { analyseurAngleReel, decalageBoucheSon, presenceVisageParSeconde, type EchantillonBouche } from "@/fournisseurs/multicamera/analyseur";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const mots = (texte: string, debut = 0, pas = 0.32) => texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(debut + i * pas).toFixed(3), finSec: +(debut + i * pas + 0.26).toFixed(3) }));

describe("Motion — API unique `cartesPourFormat` (tous les formats)", () => {
  const phrases: PhraseMotion[] = [
    { id: "p1", texte: "La paperasse passe de 12 heures à 3 heures par semaine.", debutSec: 2, finSec: 6.5, place: "illustration" },
    { id: "p2", texte: "Le titre de la vidéo", debutSec: 6.6, finSec: 9, place: "titre", textes: ["Vos *droits* au travail"] },
    { id: "p3", texte: "Bonjour à tous et bienvenue.", debutSec: 12, finSec: 15, place: "illustration" },
  ];

  it("choix du modèle d'après la phrase, titre seulement sur demande, rien quand rien ne s'y prête", () => {
    const cartes = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases, ecartMinSec: 0 });
    expect(cartes.map((c) => [c.phraseId, c.modele, c.origine])).toEqual([
      ["p1", "avant-apres", "automatique"],
      ["p2", "titre", "demande"],
    ]);
    // Le titre n'est jamais choisi tout seul (B.21) : même phrase sans « place titre » → rien.
    expect(cartesPourFormat({ format: "x", ratio: "9:16", phrases: [{ id: "t", texte: "Vos droits au travail", debutSec: 0, finSec: 4 }] })).toEqual([]);
  });

  it("paramètres de l'opération `composition` existante : composition du catalogue, durée bornée 3-8 s, calage au mot", () => {
    const m = mots("La paperasse passe de 12 heures à 3 heures par semaine.", 2);
    const [c] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [phrases[0]], mots: m });
    expect(c.parametres.composition).toBe(CATALOGUE_ACTIF.fiche("avant-apres")!.composition);
    expect(c.finSec - c.debutSec).toBeGreaterThanOrEqual(3);
    expect(c.finSec - c.debutSec).toBeLessThanOrEqual(8);
    const p = c.parametres.proprietes as unknown as { largeur: number; hauteur: number; style?: string; donnees: { aSecApres?: number } };
    expect([p.largeur, p.hauteur]).toEqual([1080, 1920]);
    expect(p.style).toBeUndefined(); // sobre : propriétés identiques au lot C
    expect(p.donnees.aSecApres).toBeGreaterThan(0.5);
  });

  it("style : intensité Très dynamique → spectaculaire ; demande de Will (« plus sobre ») prime ; habitude avant intensité", () => {
    const [a] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [phrases[0]], intensite: "tres-dynamique" });
    expect(a.style).toBe("spectaculaire");
    expect((a.parametres.proprietes as { style?: string }).style).toBe("spectaculaire");
    const [b] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [phrases[0]], intensite: "tres-dynamique", demandes: ["fais les animations plus sobre"] });
    expect(b.style).toBe("sobre");
    const [d] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [phrases[0]], intensite: "sobre", habitude: "spectaculaire" });
    expect(d.style).toBe("spectaculaire");
  });

  it("jamais deux cartes l'une sur l'autre, au plus `maxCartes`, jamais au-delà de la vidéo ; 16:9 sans carte", () => {
    const serrees: PhraseMotion[] = [
      { id: "a", texte: "On passe de 12 heures à 3 heures.", debutSec: 1, finSec: 4, place: "illustration" },
      { id: "b", texte: "On passe de 10 jours à 2 jours.", debutSec: 3, finSec: 6, place: "illustration" },
      { id: "c", texte: "On passe de 9 mois à 1 mois.", debutSec: 8, finSec: 12, place: "illustration" },
    ];
    expect(cartesPourFormat({ format: "x", ratio: "9:16", phrases: serrees }).map((c) => c.phraseId)).toEqual(["a", "c"]);
    expect(cartesPourFormat({ format: "x", ratio: "9:16", phrases: serrees, maxCartes: 1 })).toHaveLength(1);
    expect(cartesPourFormat({ format: "x", ratio: "9:16", phrases: serrees, dureeVideoSec: 10 }).map((c) => c.phraseId)).toEqual(["a"]);
    expect(ratiosMotion(["9:16", "16:9", "1:1"])).toEqual(["9:16", "1:1"]);
  });

  it("le catalogue passe par la brique : les modèles du monteur commun sont ceux du catalogue actif", () => {
    expect(modelesCartes()).toEqual([...CATALOGUE_ACTIF.ids()]);
  });
});

describe("Motion — rendu commun des cartes", () => {
  function service(statuts: EtatRendu["statut"][]) {
    const recues: DemandeRendu[] = [];
    let i = 0;
    const s: ServiceRendu = {
      async soumettre(d) {
        recues.push(d);
        return { idRendu: d.idRendu };
      },
      async etat() {
        const st = statuts[Math.min(i++, statuts.length - 1)];
        if (st === "echec") return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "panne" } };
        if (st === "termine") return { statut: "termine", sortieCle: "x" };
        return { statut: "en_cours", progression: 10 };
      },
    };
    return { recues, s };
  }
  const [carte] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [{ id: "p", texte: "On passe de 12 heures à 3 heures.", debutSec: 2, finSec: 6, place: "illustration" }] });

  it("opération `composition` sans mode, suivie jusqu'au bout, posée en carte plein écran du bon ratio", async () => {
    const { recues, s } = service(["en_cours", "termine"]);
    let e = etatInitialCartesMotion([carte], (c) => `motion/${c.id}.mp4`);
    for (let k = 0; k < 4 && !cartesMotionFinies(e); k++) e = await avancerCartesMotion(e, { rendu: () => s, depot: async (cle) => `https://r2/${cle}?depot` });
    expect(recues[0]).toMatchObject({ operation: "composition", file: "longue", sortie: { cle: `motion/${carte.id}.mp4`, urlDepot: `https://r2/motion/${carte.id}.mp4?depot` } });
    expect((recues[0].parametres as { mode?: string; composition: string }).mode).toBeUndefined();
    expect(cartesPleinEcranDuRatio(e, "9:16")).toEqual([{ debutSec: carte.debutSec, finSec: carte.finSec, carteCle: `motion/${carte.id}.mp4` }]);
    expect(cartesPleinEcranDuRatio(e, "1:1")).toEqual([]);
  });

  it("une carte ratée : un nouvel essai, puis écartée (jamais bloquant)", async () => {
    const { recues, s } = service(["echec"]);
    let e = etatInitialCartesMotion([carte], (c) => `motion/${c.id}.mp4`);
    for (let k = 0; k < 5 && !cartesMotionFinies(e); k++) e = await avancerCartesMotion(e, { rendu: () => s, depot: async () => "u" });
    expect(recues).toHaveLength(2);
    expect(cartesMotionEcartees(e)).toBe(1);
    expect(cartesPleinEcranDuRatio(e, "9:16")).toEqual([]);
  });
});

describe("Monteur — brique commune et adaptateurs", () => {
  it("relecture tolérante : même résultat que le face caméra du lot D sur les mêmes réponses", () => {
    const reponses = [
      { reponse: " C'est fait. ", operations: [{ type: "zoom", debutMot: 3, finMot: 5, style: "punch-in", cible: "visage" }, { type: "inconnue" }, { type: "titre", texte: "X", debutMot: null, finMot: null, pleinEcran: false }], consignes: [{ consigneId: "c1", comprise: true, resume: "Zoom", operations: [0, 1] }, { consigneId: "c2", comprise: true, resume: "?", operations: [1] }] },
      { reponse: 3, operations: "rien", consignes: [] },
      null,
    ];
    for (const r of reponses) {
      const facecam = lireReponseMonteur(r);
      const commune = lireReponseOperations(r, schemaOperationFacecam);
      expect(commune).toEqual(facecam);
    }
  });

  it("schémas communs = ceux du face caméra (zoom, titre, retirer) ; la réponse se construit pour tout vocabulaire", () => {
    expect(z.toJSONSchema(schemaZoomCommun)).toEqual(z.toJSONSchema(schemaZoom));
    expect(z.toJSONSchema(schemaTitreCommun)).toEqual(z.toJSONSchema(schemaTitre));
    expect(z.toJSONSchema(schemaRetirerCommun)).toEqual(z.toJSONSchema(schemaRetirer));
    expect(schemaReponsePour(schemaZoomCommun).safeParse({ reponse: "ok", operations: [], consignes: [] }).success).toBe(true);
  });

  it("ancrage commun : le face caméra réexporte celui de la brique (même fonction)", () => {
    expect(ancreFacecam).toBe(ancreBrique);
    const m = motsSansCoupe(mots("Bonjour je vous parle de Certifexemple aujourd'hui et de la formation"));
    expect(ancreBrique("quand je dis Certifexemple, mets une carte", m)).toMatchObject({ debutMot: 5 });
    expect(ancreBrique("à 0:02 un zoom", m).debutMot).toBe(m.find((x) => x.monteeSec! >= 1.75)!.index);
  });

  it("consignes « Monteur, … » repérées de la même façon pour tous les formats ; familles reconnues", () => {
    const m = [...mots("Monteur, fais-le en trois caméras."), ...mots("Bonjour à tous", 3)];
    const c = consignesDites(m);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ origine: "voix", texte: "fais-le en trois caméras." });
    expect(familleDeLaConsigne(c[0].texte)).toBe("multicamera");
    expect(familleDeLaConsigne("mets-moi à droite pendant l'explication")).toBe("miseEnPage");
    expect(familleDeLaConsigne("une seule caméra s'il te plaît")).toBe("multicamera");
  });

  it("registre : face caméra = vocabulaire complet du lot D ; avocat = ce qu'il sait faire, réponse claire pour le reste", () => {
    const facecam = adaptateurMonteur("facecam")!;
    expect(facecam.typesSupportes).toContain("masquerPersonne");
    const avocat = adaptateurMonteur("avocat")!;
    expect([...avocat.typesSupportes].sort()).toEqual(["multicamera", "zoom"]);
    expect([...adaptateurMonteur("avocat", { motion: true })!.typesSupportes].sort()).toEqual(["ajouterCarte", "multicamera", "titre", "zoom"]);
    expect(adaptateurMonteur("podcast")).toBeNull();
    const m = motsSansCoupe(mots("Bonjour je vous parle du licenciement aujourd'hui"));
    const ancre = (texte: string) => ancreBrique(texte, m);
    const r = avocat.reglesFixes([
      { id: "a", origine: "voix", texte: "fais-le en 3 caméras", ancre: ancre("") },
      { id: "b", origine: "fil", texte: "mets-moi à droite", ancre: ancre("") },
      { id: "c", origine: "fil", texte: "zoome quand je dis licenciement", ancre: ancre("quand je dis licenciement") },
      { id: "d", origine: "fil", texte: "mets une carte avec le chiffre 32 %", ancre: ancre("") },
    ]);
    expect(r.operations.map((o) => o.type)).toEqual(["multicamera", "zoom"]);
    expect(r.consignes.map((x) => x.comprise)).toEqual([true, false, true, false]);
    expect(r.consignes[1].resume).toBe(refusClair("avocat", "miseEnPage"));
    expect(r.consignes[1].resume).toMatch(/^Pour une vidéo avocat, je ne sais pas encore faire une mise en page/);
    expect(r.consignes[3].resume).toBe(refusClair("avocat", "ajouterCarte"));
    expect(trierOperations([{ type: "zoom" }, { type: "son" }], avocat.typesSupportes, "avocat").refusees[0]).toMatchObject({ type: "son", index: 1 });
  });
});

describe("Multicaméra — composition commune et face caméra", () => {
  const plan = (debutSec: number, finSec: number, zoom = 1, zoomFin = zoom): PlanScene => ({ debutSec, finSec, type: "double", angle: "principal", cadrage: { valeur: "large", zoom, zoomFin, pointX: 0.5, pointY: 0.4 } });

  it("les plans « double » sont coupés aux plans de caméra ; zoom continu, appliqué sur l'angle montré ; illustrations intactes", () => {
    const plans: PlanScene[] = [plan(0, 4, 1, 1.06), { ...plan(4, 6), type: "illustration", illustration: { url: "entree:illu", video: false } }, plan(6, 10)];
    const mc = { plans: [{ angle: "face" as const, debutSec: 0, finSec: 2 }, { angle: "cote" as const, debutSec: 2, finSec: 7 }, { angle: "contre-plongee" as const, debutSec: 7, finSec: 10 }], sources: { cote: "c.mp4", "contre-plongee": "k.mp4" } };
    const r = poserPlansCamera(plans, mc);
    expect(r.map((p) => [p.debutSec, p.finSec, p.type, p.camera ?? "face"])).toEqual([
      [0, 2, "double", "face"],
      [2, 4, "double", "cote"],
      [4, 6, "illustration", "face"],
      [6, 7, "double", "cote"],
      [7, 10, "double", "contre-plongee"],
    ]);
    expect(r[0].cadrage.zoomFin).toBeCloseTo(1.03, 5);
    expect(r[1].cadrage.zoom).toBeCloseTo(1.03, 5);
    expect(r[1].cadrage.zoomFin).toBeCloseTo(1.06, 5);
    // Sans piste ou sans source : mêmes plans (même objet).
    expect(poserPlansCamera(plans, undefined)).toBe(plans);
    expect(poserPlansCamera(plans, { plans: mc.plans, sources: {} })).toBe(plans);
    // Un angle écarté (sans source) reste de face.
    expect(poserPlansCamera(plans, { plans: mc.plans, sources: { cote: "c.mp4" } }).some((p) => p.camera === "contre-plongee")).toBe(false);
    expect(partsDesAngles(mc, 10)).toEqual({ face: 2, cote: 5, "contre-plongee": 3 });
  });

  it("face caméra : même brique, face = la vidéo de Will, coupée par défaut ; jamais une clé simulée dans un rendu réel", () => {
    const m = mots("Aujourd'hui je vous montre trois erreurs que font les dirigeants avec l'intelligence artificielle. D'abord, la première erreur est simple : ils veulent tout automatiser d'un coup, sans méthode et sans priorité claire. Ensuite, la deuxième coûte très cher : 9 heures perdues chaque semaine ! Concrètement, on commence toujours par un diagnostic de vos tâches répétitives et de vos outils. Enfin, écrivez-moi en commentaire.");
    expect(pisteMulticameraFacecam({ mots: m, sources: { face: "montage.mov" }, dureeSec: 15 })).toBeNull();
    const piste = pisteMulticameraFacecam({ actif: true, mots: m, sources: { face: "montage.mov", cote: "c.mp4", "contre-plongee": "k.mp4" }, dureeSec: m.at(-1)!.finSec + 0.5, simulation: true })!;
    expect(piste.sources.face).toBe("montage.mov");
    expect(piste.plans[0].angle).toBe("face");
    expect(piste.simulation).toBe(true);
    expect(multicameraPourComposition(piste, true)).toBeUndefined();
    expect(multicameraPourComposition(piste, false)?.sources).toEqual({ cote: "c.mp4", "contre-plongee": "k.mp4" });
    expect(multicameraPourComposition({ ...piste, simulation: undefined }, true)).toBeDefined();
  });
});

describe("Analyseur réel des angles (calculs purs)", () => {
  const parole = [
    { debutSec: 0.5, finSec: 1.4 },
    { debutSec: 2.0, finSec: 2.6 },
    { debutSec: 3.4, finSec: 4.6 },
    { debutSec: 5.3, finSec: 5.8 },
    { debutSec: 6.6, finSec: 8.0 },
  ];
  const bouche = (retardMs: number, trous: number[] = []): EchantillonBouche[] => {
    const e: EchantillonBouche[] = [];
    for (let t = 0; t < 9; t = +(t + 0.08).toFixed(2)) {
      const ts = t - retardMs / 1000;
      const ouvert = parole.some((p) => ts >= p.debutSec && ts < p.finSec);
      e.push({ t, bouche: ouvert ? 0.7 : 0.05, confiance: trous.includes(Math.floor(t)) ? 0 : 1 });
    }
    return e;
  };

  it("synchro bouche/son : décalage retrouvé (± 40 ms) ; aucun signal : écarté", () => {
    expect(Math.abs(decalageBoucheSon(bouche(0), parole, 9))).toBeLessThanOrEqual(40);
    expect(Math.abs(decalageBoucheSon(bouche(160), parole, 9) - 160)).toBeLessThanOrEqual(40);
    expect(Math.abs(decalageBoucheSon(bouche(-120), parole, 9) + 120)).toBeLessThanOrEqual(40);
    expect(decalageBoucheSon([], parole, 9)).toBe(Infinity);
  });

  it("présence du visage comptée à ~1 image par seconde ; mesure complète par les trois services injectés", async () => {
    expect(presenceVisageParSeconde(bouche(0), 9)).toBe(100);
    expect(presenceVisageParSeconde(bouche(0, [3, 4]), 9)).toBeCloseTo(77.8, 1);
    const a = analyseurAngleReel({ duree: async () => 9.02, visages: async () => bouche(0), motsReference: async () => parole });
    const m = await a.mesurer({ videoCle: "angle.mp4", audioCle: "son.wav", dureeReferenceSec: 9 });
    expect(m).toMatchObject({ dureeSec: 9.02, visagePresentPct: 100 });
    expect(Math.abs(m.decalageAudioMs)).toBeLessThanOrEqual(40);
  });
});
