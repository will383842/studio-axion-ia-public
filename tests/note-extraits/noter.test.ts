import { describe, expect, it } from "vitest";
import { IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import { GARDES_MAX_PAR_VIDEO, INTERET_PAR_PIECE, MOTS_CREUX, MOTS_VIDES, POINTS, SEUIL_GARDE, SEUIL_PEUT_ETRE } from "@/briques/note-extraits/bareme";
import { noter } from "@/briques/note-extraits/noter";
import type { Moment } from "@/briques/note-extraits/types";
import { SEUILS_PAR_DEFAUT } from "@/briques/note-extraits/reglage";

const base: Moment = { id: "m", origine: "scene", debutSec: 0, finSec: 5, montre: "inconnu", avecVisage: false, texteIncruste: false };
const somme = (r: { points: number }[]) => r.reduce((s, x) => s + x.points, 0);

describe("X4-04 barème et note d'intérêt", () => {
  it("seuils et plafond = réglage X4-07", () => {
    expect([SEUIL_GARDE, SEUIL_PEUT_ETRE, GARDES_MAX_PAR_VIDEO]).toEqual([SEUILS_PAR_DEFAUT.garde, SEUILS_PAR_DEFAUT.peutEtre, SEUILS_PAR_DEFAUT.gardesMax]);
    expect(POINTS.interface).toBe(35);
    expect(MOTS_CREUX.length).toBeGreaterThan(0);
    expect(MOTS_VIDES.length).toBeGreaterThan(0);
  });

  it("chaque pièce du catalogue a une ligne", () => {
    for (const id of IDS_PIECES) expect(INTERET_PAR_PIECE[id], id).toBeTypeOf("number");
  });

  it("exemple 1 : scène liste CRM, 5 s, écran séparé = 80, gardé", () => {
    const m: Moment = { ...base, montre: "interface", pieces: ["liste-crm"] };
    const n = noter(m, { sujet: "suivi-commercial", sourcePropre: true });
    expect(n.note).toBe(80);
    expect(n.decision).toBe("garde");
    expect(n.sujet).toBe("suivi-commercial");
  });

  it("exemple 2 : bonjour creux avec texte incrusté = bornée à 0, ignoré", () => {
    const m: Moment = { ...base, origine: "prise-v4", montre: "visage", avecVisage: true, texteIncruste: true, texte: "Bonjour, aujourd'hui je vais vous parler de" };
    const n = noter(m, { sujet: null });
    expect(somme(n.raisons)).toBeLessThan(0);
    expect(n.note).toBe(0);
    expect(n.decision).toBe("ignore");
  });

  it("exemple 3 : carte KPI 5 s, sujet, fait = 60, gardé", () => {
    const m: Moment = { ...base, montre: "chiffre", pieces: ["carte-kpi"], texte: "3 h gagnées par semaine" };
    const n = noter(m, { sujet: "suivi-commercial", faits: [{ type: "nombre", valeur: 3, unite: "h", surMot: 0, mots: { premier: 0, dernier: 0 }, texte: "3 h" }] });
    expect(n.note).toBe(60);
    expect(n.decision).toBe("garde");
  });

  it("exemple 4 : phrase d'avocat avec visage = 35, ignoré", () => {
    const m: Moment = { ...base, origine: "parole", montre: "visage", avecVisage: true, finSec: 4, texte: "On envoie le devis, et la relance part toute seule" };
    const n = noter(m, { sujet: "devis-factures", faits: [{ type: "etapes", elements: [], mots: { premier: 0, dernier: 0 }, texte: "x" }] });
    expect(n.note).toBe(35);
    expect(n.decision).toBe("ignore");
  });

  it("peut-être entre 40 et 59", () => {
    const m: Moment = { ...base, montre: "demarche", pieces: ["etapes"] };
    const n = noter(m, { sujet: "recrutement" });
    expect(n.note).toBe(40);
    expect(n.decision).toBe("peut-etre");
  });

  it("mot-clé +5 ; aucun sujet −10 ; durée hors 3–6 s sans bonus", () => {
    const m: Moment = { ...base, finSec: 8, montre: "geste", texte: "le CRM relance seul vos clients ici" };
    const n = noter(m, { sujet: null, motCle: "CRM" });
    expect(n.raisons.map((r) => r.code).sort()).toEqual(["geste", "mot-cle", "sujet-absent"]);
    expect(n.note).toBe(5);
  });

  it("un moment exclu reste ignoré quelle que soit sa note", () => {
    const m: Moment = { ...base, origine: "ecran-demo", montre: "interface", pieces: ["liste-crm"] };
    const n = noter(m, { sujet: "suivi-commercial", sourcePropre: true, etat: "exclue" });
    expect(n).toMatchObject({ note: 0, decision: "ignore", raisons: [{ code: "exclu-droit", points: 0 }] });
  });

  it("déterminisme sur 100 tirages et somme des raisons = note avant bornage", () => {
    const m: Moment = { ...base, montre: "interface", pieces: ["tableau-de-bord"], texte: "voici le tableau de bord des devis envoyés" };
    const c = { sujet: "devis-factures" as const, motCle: "devis" };
    const ref = JSON.stringify(noter(m, c));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(noter(m, c))).toBe(ref);
    const n = noter(m, c);
    expect(somme(n.raisons)).toBe(n.note);
  });

  it("borne haute à 100", () => {
    const m: Moment = { ...base, origine: "ecran-demo", montre: "interface", pieces: ["liste-crm"], texte: "liste du CRM avec tous les prospects suivis" };
    const n = noter(m, { sujet: "suivi-commercial", motCle: "CRM", sourcePropre: true, faits: [{ type: "etapes", elements: [], mots: { premier: 0, dernier: 0 }, texte: "x" }] });
    expect(somme(n.raisons)).toBe(35 + 20 + 15 + 10 + 5 + 10);
    expect(n.note).toBe(95);
  });
});
