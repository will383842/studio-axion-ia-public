/**
 * S-09a : opération « modifierCarte » du monteur face caméra (changer le modèle d'animation d'une carte déjà posée).
 * Chemin réel : vraie `appliquerOperations`, vrai `signatureMontage` / `partiesARefaire`, aucun objet monté à la main.
 * La carte garde son id, son ancre (son moment), ses textes et sa disposition ; seul le modèle change.
 */
import { describe, expect, it } from "vitest";
import { entreesFacecamVides } from "@/domaine/facecam";
import { partiesARefaire, signatureMontage } from "@/moteurs/montage-facecam/retouche";
import {
  appliquerOperations,
  reglagesMonteurVides,
  schemaOperationFacecam,
  SIGNATURES_OPERATIONS_FACECAM,
  TYPES_OPERATION_FACECAM,
  type EtatMonteur,
  type OperationFacecam,
  type PassageMonteur,
} from "@/moteurs/montage-facecam/monteur";
import { CONVENTION_TEXTES_TOUS } from "@/briques/motion";

const MOTS = Array.from({ length: 100 }, (_, i) => ({ index: i, mot: `mot${i}`, debutPriseSec: 1 + i * 0.5, finPriseSec: 1.4 + i * 0.5, monteeSec: 1 + i * 0.5, retire: false }));
let n = 0;
const nouvelId = (p: string) => `${p}-${++n}`;

function appliquer(ops: OperationFacecam[], etat: EtatMonteur) {
  return appliquerOperations(etat, ops, { mots: MOTS, dureePriseSec: 60, origine: "demande", consigneId: "k1", nouvelId });
}

const carte = (debutMot: number, finMot: number, textes: string[], modele: "liste" | "chiffre" = "liste"): OperationFacecam => ({
  type: "ajouterCarte", debutMot, finMot, modele, textes, html: null, disposition: "plein-ecran", description: "Les trois étapes", animationGardeeId: null,
});

const TROIS_POINTS = ["Les 3 étapes", "Écouter", "Former", "Mesurer"];

/** État réel : 2 cartes « liste » posées par le vrai moteur ; on rend l'état et les deux passages. */
function etatAvecDeuxCartes() {
  const r = appliquer([carte(2, 10, TROIS_POINTS), carte(30, 38, ["Autre carte", "Un", "Deux", "Trois"])], { facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() });
  expect(r.refusees).toEqual([]);
  const [p1, p2] = r.etat.facecam.passages as PassageMonteur[];
  return { etat: r.etat, p1, p2 };
}

const entreesDe = (etat: EtatMonteur) => ({ facecam: etat.facecam, facecamMonteur: etat.reglages }) as unknown as Record<string, unknown>;

describe("S-09a · modifierCarte", () => {
  it("a) le schéma connaît l'opération ; elle est appliquée : même carte, seul le modèle change", () => {
    const { etat, p1 } = etatAvecDeuxCartes();
    const op = { type: "modifierCarte", passageId: p1.id, modele: "check-list" };
    expect(schemaOperationFacecam.safeParse(op).success).toBe(true);
    const r = appliquer([op as OperationFacecam], etat);
    expect(r.refusees).toEqual([]);
    expect(r.appliquees).toHaveLength(1);
    const apres = (r.etat.facecam.passages as PassageMonteur[]).find((p) => p.id === p1.id)!;
    expect(r.etat.facecam.passages).toHaveLength(2);
    expect(apres).toEqual({ ...p1, operation: { ...p1.operation, modele: "check-list" } });
    expect(apres.id).toBe(p1.id);
    expect(apres.ancre).toEqual(p1.ancre);
    // l'état de départ n'est pas modifié en place
    expect((etat.facecam.passages as PassageMonteur[])[0].operation).toEqual(p1.operation);
  });

  it("b) seule la piste habillée est à refaire ; la carte change d'empreinte, l'autre non", () => {
    const { etat, p1, p2 } = etatAvecDeuxCartes();
    const avant = signatureMontage(entreesDe(etat));
    const r = appliquer([{ type: "modifierCarte", passageId: p1.id, modele: "check-list" } as OperationFacecam], etat);
    const apres = signatureMontage(entreesDe(r.etat));
    expect([...partiesARefaire(avant, apres)]).toEqual(["habillage"]);
    expect(apres.habillage).not.toBe(avant.habillage);
    const autre = (r.etat.facecam.passages as PassageMonteur[]).find((p) => p.id === p2.id)!;
    expect(autre).toEqual(p2);
    // changer le même modèle pour le même modèle ne bouge rien
    const idem = appliquer([{ type: "modifierCarte", passageId: p1.id, modele: "liste" } as OperationFacecam], etat);
    expect(signatureMontage(entreesDe(idem.etat)).habillage).toBe(avant.habillage);
  });

  it("c) des textes qui ne tiennent pas dans le nouveau modèle : refus avec la convention, état inchangé", () => {
    const { etat, p1 } = etatAvecDeuxCartes();
    const r = appliquer([{ type: "modifierCarte", passageId: p1.id, modele: "graphique" } as OperationFacecam], etat);
    expect(r.refusees).toEqual([0]);
    expect(r.appliquees).toEqual([]);
    expect(r.alertes.join(" ")).toContain(CONVENTION_TEXTES_TOUS.graphique);
    expect(r.etat.facecam.passages).toEqual(etat.facecam.passages);
  });

  it("d) carte sur mesure, id inconnu et carte automatique : refus clairs, rien de changé", () => {
    const { etat, p1 } = etatAvecDeuxCartes();
    const surMesure = appliquer([{ ...carte(50, 58, []), modele: null, html: { html: "<p>x</p>", css: "", timeline: "" } } as OperationFacecam], etat);
    const idSurMesure = (surMesure.etat.facecam.passages as PassageMonteur[]).at(-1)!.id;
    const r1 = appliquer([{ type: "modifierCarte", passageId: idSurMesure, modele: "liste" } as OperationFacecam], surMesure.etat);
    expect(r1.refusees).toEqual([0]);
    expect(r1.alertes.join(" ")).toContain("faite sur mesure");
    expect(r1.etat.facecam.passages).toEqual(surMesure.etat.facecam.passages);

    const r2 = appliquer([{ type: "modifierCarte", passageId: "inconnu", modele: "liste" } as OperationFacecam], etat);
    expect(r2.refusees).toEqual([0]);
    expect(r2.alertes.join(" ")).toContain("introuvable");

    const avecAuto: EtatMonteur = { ...etat, facecam: { ...etat.facecam, cartesAuto: [{ id: "auto-abc", debutSec: 5, finSec: 9, modele: "liste", texte: "Texte" }] } };
    const r3 = appliquer([{ type: "modifierCarte", passageId: "auto-abc", modele: "check-list" } as OperationFacecam], avecAuto);
    expect(r3.refusees).toEqual([0]);
    expect(r3.alertes.join(" ")).toContain("cartes automatiques");
    expect(r3.etat.facecam.passages).toEqual(avecAuto.facecam.passages);
    // un passage qui n'est pas une carte (un zoom) : refusé aussi
    const zoom = appliquer([{ type: "zoom", debutMot: 14, finMot: 16, style: "punch-in", cible: "visage" }], etat);
    const idZoom = (zoom.etat.facecam.passages as PassageMonteur[]).find((p) => p.operation.type === "zoom")!.id;
    expect(appliquer([{ type: "modifierCarte", passageId: idZoom, modele: "liste" } as OperationFacecam], zoom.etat).refusees).toEqual([0]);
    void p1;
  });

  it("e) la consigne de Claude connaît modifierCarte ; l'ordre des 21 types existants est inchangé", () => {
    const AVANT = ["ajouterCarte", "zoom", "ecranPartage", "miseEnPage", "couleurs", "son", "masquerPersonne", "texteDerriere", "vitesse", "arretImage", "titre", "generique", "couper", "retablir", "retirer", "remettre", "objetMain", "vitreBrisee", "transitionEcran", "effetRealisteIA", "changerTitreCouverture"];
    expect(TYPES_OPERATION_FACECAM.slice(0, AVANT.length)).toEqual(AVANT);
    expect(TYPES_OPERATION_FACECAM.at(-1)).toBe("modifierCarte");
    const lignes = SIGNATURES_OPERATIONS_FACECAM.split("\n").filter((l) => l.startsWith("- "));
    expect(lignes.slice(0, AVANT.length).map((l) => l.slice(2).split(" ")[0])).toEqual(AVANT);
    expect(SIGNATURES_OPERATIONS_FACECAM).toMatch(/^- modifierCarte : /m);
  });
});
