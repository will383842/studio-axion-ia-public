/**
 * Relecture finale des images (18/10) : l'image de contrôle d'une phrase-choc, d'un bandeau de chiffres ou d'un bloc est
 * prise APRÈS le dernier élément visible de l'écran (les mots et les chiffres n'apparaissent qu'au moment où la voix les
 * dit), jamais en pleine animation, et toujours SUR l'écran voulu. Voix SIMULÉE, aucun réseau, aucun appel payant.
 * Les heures attendues sont lues directement dans la ligne de temps (`moments.heures`, `moments.chiffres`, événements),
 * pas recalculées par le même algorithme que le code testé.
 */
import { describe, expect, it } from "vitest";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { CONSIGNE_RELECTURE_FINALE, ENTREE_MOT_SEC, instantsClesIV } from "@/moteurs/montage-image-video/relecture-finale";
import { carteFixe } from "./doubles-fabrication";

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
const PAS_UN_ELEMENT = new Set(["scene", "fond", "camera"]);
const TOL = 0.002;
/** Instant attendu au plus tôt : dernière heure + délai, jamais au-delà de la fin de l'écran − 0,05 s. */
const auPlusTot = (derniere: number, delai: number, finEcran: number) => Math.min(derniere + delai, finEcran - 0.05) - TOL;
const planDe = (l: Pick<LigneDeTempsIV, "plans">, t: number) => l.plans.find((x) => t >= x.debut - 1e-9 && t < x.fin - 1e-9);

describe("relecture finale · instants des images après la voix (images A à F, voix simulée)", () => {
  for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
    it(`image ${nom} : phrase-choc, chiffres et blocs pris après leur dernier élément, sur le bon écran`, () => {
      const carte = carteFixe(nom);
      const fiche = FICHES_SIMULEES[IMAGES[nom]];
      const plan = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit });
      let verifies = 0;
      for (const fin of plan.fins) {
        const voix = pisteSimulee(fiche, fin.muet ? null : fin);
        const ligne = mettreEnSceneIV({ carte, fiche, voix, fin: fin.muet ? null : fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
        for (const i of instantsClesIV(ligne, carte)) {
          const p = planDe(ligne, i.instantSec);
          expect(p, `${nom} ${fin.id} ${i.nom}`).toBeDefined();
          expect(i.instantSec).toBeLessThanOrEqual(p!.fin - 0.05 + 1e-6);
          const dans = (t: number) => t >= p!.debut - 1e-6 && t < p!.fin - 1e-6;
          if (i.sorte === "phrase-choc" || i.sorte === "chiffre") {
            const heures: number[] = [];
            for (const b of ligne.blocs) {
              if (b.sorte !== "moments") continue;
              for (const m of b.moments) {
                // Une phrase-choc ou un bandeau peut couvrir plusieurs écrans : on prend toutes les heures de l'écran de l'image.
                if (m.sorte === "phrase-choc") heures.push(...m.heures.map((h) => b.debut + h).filter(dans));
                if (m.sorte === "bandeau") heures.push(...m.chiffres.map((c) => b.debut + c.t).filter(dans));
              }
            }
            for (const e of ligne.evenements) if (e.visible && !PAS_UN_ELEMENT.has(e.genre) && dans(e.instantSec)) heures.push(e.instantSec);
            if (heures.length) {
              const dernier = Math.max(...heures);
              const dernierEcran = p!.id === ligne.plans[ligne.plans.length - 1]!.id;
              expect(i.instantSec, `${nom} ${fin.id} ${i.nom} (${i.sorte}) à ${i.instantSec} s, dernier élément à ${dernier} s`).toBeGreaterThanOrEqual(auPlusTot(dernier, 0.5, p!.fin));
              // Entrée du mot finie (~0,34 s) : écart ≥ 0,26 s, sauf sur le dernier écran de la vidéo. Non contournable par la borne de fin d'écran.
              if (!dernierEcran) expect(i.instantSec - dernier, `${nom} ${fin.id} ${i.nom} : image trop près du dernier mot`).toBeGreaterThanOrEqual(0.26);
              verifies++;
            }
          } else if (i.sorte === "bloc") {
            const evts = ligne.evenements.filter((e) => e.visible && e.ref === i.ref && e.genre !== "camera").sort((a, b) => a.instantSec - b.instantSec);
            const premier = evts[0]!;
            const pPremier = planDe(ligne, premier.instantSec)!;
            // Le bloc est photographié sur l'écran où il apparaît (jamais sur un autre).
            expect(p!.id, `${nom} ${fin.id} ${i.nom} bloc ${i.ref} : image à ${i.instantSec} s sur « ${p!.scene} »`).toBe(pPremier.id);
            expect(p!.ecran).toBe(premier.ecran);
            const derniere = Math.max(...evts.filter((e) => e.plan === pPremier.id).map((e) => e.instantSec));
            // Plancher : dernier élément + 0,3 s ; plafond : au plus tard 0,2 s avant la fin de l'écran (fondu de sortie de l'en-tête),
            // sauf si le plancher est lui-même plus tard (écran très court).
            const plancher = Math.min(derniere + 0.3, p!.fin - 0.05);
            expect(i.instantSec).toBeGreaterThanOrEqual(plancher - TOL);
            expect(i.instantSec).toBeLessThanOrEqual(Math.max(plancher, p!.fin - 0.2) + TOL);
            // Jamais après le départ de la caméra vers un autre bloc (sauf plancher).
            const depart = ligne.evenements.find((e) => e.genre === "camera" && e.instantSec > derniere + 1e-6)?.instantSec;
            if (depart !== undefined) expect(i.instantSec).toBeLessThanOrEqual(Math.max(plancher, depart - 0.05) + TOL);
            verifies++;
          }
        }
      }
      expect(verifies).toBeGreaterThan(0);
    });
  }

  it("phrase-choc sur 2 écrans : l'image du 2e écran est prise après le dernier mot, dit dans ce 2e écran", () => {
    const plan = (id: string, debut: number, fin: number) => ({ id, debut, fin, scene: "phrase-choc", sorte: "moment", fond: "sombre", textes: ["x"], coupe: "sous-plan", partie: "resultat", marque: "axion-ia.com" });
    const ligne = {
      plans: [plan("p1", 10, 12), plan("p2", 12, 14.5)],
      evenements: [],
      dureeSec: 20,
      segmentFin: { debut: 19, question: false, muet: true },
      // Une seule phrase-choc de 4,5 s répartie sur les deux écrans : mots à 0,2 / 1 / 2,5 / 3,2 s du début du bloc.
      blocs: [{ id: "b1", debut: 10, fin: 14.5, sorte: "moments", moments: [{ sorte: "phrase-choc", debut: 0, fin: 4.5, fond: "sombre", phrase: "a b c d", heures: [0.2, 1, 2.5, 3.2] }] }],
    } as unknown as Parameters<typeof instantsClesIV>[0];
    const chocs = instantsClesIV(ligne, { noeuds: [] }).filter((i) => i.sorte === "phrase-choc");
    expect(chocs).toHaveLength(2);
    expect(chocs[0]!.instantSec).toBeCloseTo(11.5, 2); // dernier mot de l'écran 1 à 11 s + 0,5 s
    expect(chocs[1]!.instantSec).toBeCloseTo(13.7, 2); // dernier mot de l'écran 2 à 13,2 s + 0,5 s (avant la fin 14,5 − 0,05)
  });

  it("dernier mot d'un écran dit juste avant sa fin et phrase-choc qui continue : pas d'image sur cet écran, celle du suivant montre tout", () => {
    const plan = (id: string, debut: number, fin: number) => ({ id, debut, fin, scene: "phrase-choc", sorte: "moment", fond: "sombre", textes: ["x"], coupe: "sous-plan", partie: "resultat", marque: "axion-ia.com" });
    const ligne = {
      plans: [plan("p1", 10, 12), plan("p2", 12, 14.5)],
      evenements: [],
      dureeSec: 20,
      segmentFin: { debut: 19, question: false, muet: true },
      blocs: [{ id: "b1", debut: 10, fin: 14.5, sorte: "moments", moments: [{ sorte: "phrase-choc", debut: 0, fin: 4.5, fond: "sombre", phrase: "a b c d", heures: [0.2, 1, 1.86, 3.2] }] }],
    } as unknown as Parameters<typeof instantsClesIV>[0];
    const chocs = instantsClesIV(ligne, { noeuds: [] }).filter((i) => i.sorte === "phrase-choc");
    expect(chocs).toHaveLength(1);
    expect(chocs[0]!.instantSec).toBeCloseTo(13.7, 2);
  });

  it("bloc apparu dans les 50 dernières ms de son écran : aucune image (jamais avant son apparition)", () => {
    const ligne = {
      plans: [{ id: "p1", debut: 10, fin: 12, scene: "titre", sorte: "emotion", fond: "sombre", textes: [], coupe: "ecran", partie: "resultat", marque: "x", ecran: "e1" }],
      evenements: [{ id: "x", genre: "objet", instantSec: 11.97, visible: true, ref: "n1", ecran: "e1", plan: "p1", chiffres: [] }],
      dureeSec: 20,
      segmentFin: { debut: 19, question: false, muet: true },
      blocs: [],
    } as unknown as Parameters<typeof instantsClesIV>[0];
    const carte = { noeuds: [{ id: "n1", libelle: "Bloc" }] } as unknown as Parameters<typeof instantsClesIV>[1];
    expect(instantsClesIV(ligne, carte).filter((i) => i.sorte === "bloc")).toEqual([]);
  });

  it("images A à F : l'ouverture du segment de fin est prise 1,0 s après son début (bornée à la fin de son écran − 0,05 s)", () => {
    let verifies = 0;
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      const carte = carteFixe(nom);
      const fiche = FICHES_SIMULEES[IMAGES[nom]];
      const plan = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit });
      for (const fin of plan.fins) {
        if (fin.muet) continue;
        const voix = pisteSimulee(fiche, fin);
        const ligne = mettreEnSceneIV({ carte, fiche, voix, fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV }).ligne;
        const pF = ligne.plans.find((x) => ligne.segmentFin.debut >= x.debut - 1e-6 && ligne.segmentFin.debut < x.fin - 1e-6);
        // Dernier élément visible de l'écran de fin, lu directement dans les événements de la ligne de temps.
        const dansF = ligne.evenements.filter((x) => x.visible && !PAS_UN_ELEMENT.has(x.genre) && pF && x.instantSec >= pF.debut - 1e-6 && x.instantSec < pF.fin - 1e-6);
        const dernier = dansF.length ? Math.max(...dansF.map((x) => x.instantSec)) : null;
        const attendu = Math.max(ligne.segmentFin.debut, Math.min(Math.max(ligne.segmentFin.debut + 1, dernier === null ? 0 : dernier + 0.5), (pF?.fin ?? Infinity) - 0.05));
        const ouverture = instantsClesIV(ligne, carte).find((i) => i.legende.startsWith("Ouverture du segment de fin"));
        expect(ouverture, `${nom} ${fin.id}`).toBeDefined();
        expect(Math.abs(ouverture!.instantSec - attendu), `${nom} ${fin.id}`).toBeLessThanOrEqual(TOL);
        // Indépendant de la formule : jamais avant le dernier élément de l'écran de fin + le temps d'entrée d'un mot (borné à la fin de l'écran).
        if (dernier !== null) expect(ouverture!.instantSec, `${nom} ${fin.id}`).toBeGreaterThanOrEqual(Math.min(dernier + ENTREE_MOT_SEC, (pF?.fin ?? Infinity) - 0.05) - TOL);
        expect(ouverture!.instantSec, `${nom} ${fin.id}`).toBeGreaterThanOrEqual(ligne.segmentFin.debut - TOL);
        verifies++;
      }
    }
    expect(verifies).toBeGreaterThan(0);
  });

  it("bloc : image au plus tard 0,2 s avant la fin de son écran et 0,05 s avant le départ suivant de la caméra, jamais avant dernier élément + 0,3 s", () => {
    const mk = (fin: number, camera?: number) => ({
      plans: [{ id: "p1", debut: 10, fin, scene: "titre", sorte: "emotion", fond: "sombre", textes: [], coupe: "ecran", partie: "resultat", marque: "x", ecran: "e1" }],
      evenements: [
        { id: "x", genre: "objet", instantSec: 11, visible: true, ref: "n1", ecran: "e1", plan: "p1", chiffres: [] },
        ...(camera !== undefined ? [{ id: "c", genre: "camera", instantSec: camera, visible: true, ref: "n2", ecran: "e1", plan: "p1", chiffres: [] }] : []),
      ],
      dureeSec: 30,
      segmentFin: { debut: 29, question: false, muet: true },
      blocs: [],
    } as unknown as Parameters<typeof instantsClesIV>[0]);
    const carte = { noeuds: [{ id: "n1", libelle: "Bloc" }] } as unknown as Parameters<typeof instantsClesIV>[1];
    const bloc = (l: Parameters<typeof instantsClesIV>[0]) => instantsClesIV(l, carte).find((i) => i.sorte === "bloc")!.instantSec;
    expect(bloc(mk(20))).toBeCloseTo(11.6, 2); // cas normal : + 0,6 s
    expect(bloc(mk(11.7))).toBeCloseTo(11.5, 2); // fin − 0,2 s
    expect(bloc(mk(20, 11.4))).toBeCloseTo(11.35, 2); // départ caméra − 0,05 s
    expect(bloc(mk(20, 11.2))).toBeCloseTo(11.3, 2); // plancher + 0,3 s
    expect(bloc(mk(11.2))).toBeCloseTo(11.15, 2); // plancher borné à fin − 0,05 s
  });

  const ligneAlerte = (scene: string, genre: string) => ({
    plans: [{ id: "p1", debut: 10, fin: 20, scene, sorte: "moment", fond: "sombre", textes: [], coupe: "ecran", partie: "resultat", marque: "x", ecran: "e1" }],
    evenements: [{ id: "x", genre, instantSec: 11, visible: true, ref: "n1", ecran: "e1", plan: "p1", chiffres: [] }],
    dureeSec: 30,
    segmentFin: { debut: 29, question: false, muet: true },
    blocs: [],
  }) as unknown as Parameters<typeof instantsClesIV>[0];
  const legendeBloc = (l: Parameters<typeof instantsClesIV>[0], noeud: Record<string, unknown>) =>
    instantsClesIV(l, { noeuds: [{ id: "n1", ...noeud }] } as unknown as Parameters<typeof instantsClesIV>[1]).find((i) => i.sorte === "bloc")!.legende;

  it("légende d'un nœud posé comme l'alerte (écran « alerte ») : nom de l'application et message, sans « Alerte », « : : » ni émoji", () => {
    const l = legendeBloc(ligneAlerte("alerte", "alerte"), { libelle: "Alerte Telegram:", detail: "🔔 Intervention requise" });
    expect(l).toBe("La notification « Telegram : Intervention requise » est à l'écran, entière et lisible.");
    expect(l).not.toMatch(/Alerte|🔔|: :/);
  });

  it("légende de notification sans message : ni « : » ni « Alerte »", () => {
    const l = legendeBloc(ligneAlerte("alerte", "alerte"), { libelle: "Alerte Telegram:", detail: "🔔" });
    expect(l).toBe("La notification « Telegram » est à l'écran, entière et lisible.");
  });

  it("un nœud « Alerte Telegram » dessiné comme bloc ordinaire (autre scène, ou autre rôle) garde la légende générique", () => {
    expect(legendeBloc(ligneAlerte("titre", "objet"), { libelle: "Alerte Telegram", detail: "x" })).toBe("Le bloc « Alerte Telegram » est à l'écran, entier et lisible.");
    expect(legendeBloc(ligneAlerte("titre", "alerte"), { libelle: "Alerte Telegram", detail: "x" })).toBe("Le bloc « Alerte Telegram » est à l'écran, entier et lisible.");
    expect(legendeBloc(ligneAlerte("alerte", "objet"), { libelle: "Alerte Telegram", detail: "x" })).toBe("Le bloc « Alerte Telegram » est à l'écran, entier et lisible.");
  });

  it("segment de fin court : l'image d'ouverture ne tombe jamais avant le début du segment ni hors de son écran", () => {
    const l = {
      plans: [{ id: "pf", debut: 29, fin: 29.5, scene: "question", sorte: "fin", fond: "sombre", textes: [], coupe: "ecran", partie: "fin", marque: "x", ecran: "ef" }],
      evenements: [],
      dureeSec: 29.5,
      segmentFin: { debut: 29, question: true, muet: false },
      blocs: [],
    } as unknown as Parameters<typeof instantsClesIV>[0];
    const o = instantsClesIV(l, { noeuds: [] }).find((i) => i.legende.startsWith("Ouverture du segment de fin"))!;
    expect(o.instantSec).toBeGreaterThanOrEqual(29);
    expect(o.instantSec).toBeLessThanOrEqual(29.5 - 0.05 + 1e-6);
    // Segment de fin de 0,02 s : le plancher (début du segment) l'emporte sur la borne de fin d'écran.
    const l2 = { ...l, plans: [{ ...(l.plans[0] as object), fin: 29.02 }], dureeSec: 30 } as unknown as Parameters<typeof instantsClesIV>[0];
    const o2 = instantsClesIV(l2, { noeuds: [] }).find((i) => i.legende.startsWith("Ouverture du segment de fin"))!;
    expect(o2.instantSec).toBeGreaterThanOrEqual(29);
  });

  it("la consigne dit que la notification n'a ni « Alerte » ni émoji, et ne tolère pas un mot manquant une fois la phrase dite", () => {
    expect(CONSIGNE_RELECTURE_FINALE).toMatch(/sans le mot « Alerte » et sans émoji/);
    expect(CONSIGNE_RELECTURE_FINALE).toMatch(/en train d'entrer à l'instant de l'image/);
    expect(CONSIGNE_RELECTURE_FINALE).not.toMatch(/image suivante/);
  });
});
