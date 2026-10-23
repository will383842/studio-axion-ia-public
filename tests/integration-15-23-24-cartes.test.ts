/**
 * INTÉGRATION #15 + #23 + #24 — les trois mises en œuvre de « cartes du monteur ET cartes automatiques » réunies en un
 * seul planificateur (`cartesAutoDeLaVideo`) — aucun appel réel.
 * Constat en production du 10/10 : un ajout par le chat avait supprimé les 6 cartes automatiques.
 *  - vérif V1 (#20) : le chat retire une carte automatique par son identifiant stable (`cartesAutoRetirees`) ;
 *  - #15 : la fiche « Cartes et effets » retire / déplace / change le texte (`cartesAuto`, clé `ca-…`) et « Remet » ;
 *  - V6 P0 n° 9 (#24) : aucune carte automatique sur un effet spécial (`occupes`), 1 s d'écart avec le monteur.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { carteDepuisTextes } from "@/briques/motion";
import { planifierCartesAuto } from "@/briques/habillage-facecam";
import { cartesAutoDeLaVideo, cleCarteAuto, ECART_CARTES_OCCUPEES_SEC, idCarteAuto } from "@/moteurs/montage-facecam/cartes-video";
import { cartesAvecAutomatiques, cartesPosees, habillageFacecam, type CartePosee } from "@/moteurs/montage-facecam/habillage";
import { habillageFacecamRatio } from "@/moteurs/montage-facecam/declinaisons";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const MOTS = reel.mots;
const DUREE = 130.732;
const AUTO = planifierCartesAuto(MOTS, DUREE);
const base = { pisteMonteeCle: "p.mov", dureeSec: DUREE, mots: MOTS, prefixeCartes: "c" };

describe("intégration · cartes automatiques et cartes du monteur cohabitent", () => {
  it("une carte ajoutée par le chat garde les autres cartes automatiques (constat prod du 10/10)", () => {
    const seules = habillageFacecam(base);
    expect(seules.cartesAuto.length).toBe(AUTO.length);
    const a = AUTO[2];
    const chat: CartePosee = { id: "pas-chat", debutSec: a.debutSec, finSec: a.debutSec + 4, disposition: "moitie-haute", carte: carteDepuisTextes("chiffre", ["32 %", "de temps gagné"])! };
    const h = habillageFacecam({ ...base, cartes: [chat] });
    expect(h.cartes.map((c) => c.id)).toContain("pas-chat");
    // Seule la carte automatique recouverte s'efface ; toutes les autres restent.
    expect(h.cartesAuto.length).toBe(AUTO.length - 1);
    expect(h.cartesAutoVues.filter((v) => v.etat === "masquee")).toHaveLength(1);
  });

  it("retrait par le CHAT (identifiant stable) : absente de l'habillage, « retirée » dans la fiche, idem dans les formats", () => {
    const cible = AUTO[1];
    const id = idCarteAuto(cible.carte);
    const h = habillageFacecam({ ...base, cartesAutoRetirees: [id] });
    expect(h.cartesAuto.map((c) => c.id)).not.toContain(id);
    expect(h.cartesAuto).toHaveLength(AUTO.length - 1);
    expect(h.cartesAutoVues.find((v) => v.idStable === id)?.etat).toBe("retiree");
    for (const ratio of ["4:5", "1:1", "16:9"] as const) expect(habillageFacecamRatio({ ...base, cartesAutoRetirees: [id] }, ratio).cartesAuto.map((c) => c.id), ratio).not.toContain(id);
  });

  it("retrait par la FICHE puis par le chat : les deux gestes s'additionnent", () => {
    const r = cartesPosees({ ...base, cartesAuto: [{ cle: cleCarteAuto(AUTO[0].carte), retiree: true }], cartesAutoRetirees: [idCarteAuto(AUTO[1].carte)] });
    expect(r.auto).toHaveLength(AUTO.length - 2);
    expect(r.vues.slice(0, 2).map((v) => v.etat)).toEqual(["retiree", "retiree"]);
  });

  it("identifiants livrés au monteur du chat = identifiants stables (le chat peut retirer une carte vue dans la version)", () => {
    const { auto } = cartesPosees(base);
    expect(auto.map((c) => c.id)).toEqual(AUTO.map((c) => idCarteAuto(c.carte)));
  });

  it("V6 : effet spécial (passage occupé) → aucune carte automatique dessus ni à moins d'1 s ; la fiche la dit masquée", () => {
    const p = AUTO[0];
    const occupes = [{ debutSec: p.debutSec, finSec: p.finSec }];
    const r = cartesPosees({ ...base, occupes });
    expect(r.posees.some((c) => c.debutSec < p.finSec + ECART_CARTES_OCCUPEES_SEC && p.debutSec - ECART_CARTES_OCCUPEES_SEC < c.finSec)).toBe(false);
    expect(r.vues[0].etat).toBe("masquee");
    expect(cartesAvecAutomatiques([], MOTS, DUREE, occupes).map((c) => c.id)).toEqual(r.posees.map((c) => c.id));
  });

  it("déplacée depuis la fiche : passe avant les autres automatiques, jamais sur une carte du monteur", () => {
    const derniere = AUTO[AUTO.length - 1];
    const monteur: CartePosee = { id: "pas-1", debutSec: AUTO[0].debutSec, finSec: AUTO[0].finSec, disposition: "moitie-haute", carte: carteDepuisTextes("liste", ["Trois étapes", "Un", "Deux", "Trois"])! };
    const r = cartesAutoDeLaVideo(MOTS, DUREE, [{ cle: cleCarteAuto(derniere.carte), debutSec: AUTO[0].debutSec }], [monteur]);
    expect(r.vues[r.vues.length - 1].etat).toBe("masquee");
    expect(r.posees.map((c) => c.id)).not.toContain(r.vues[r.vues.length - 1].id);
  });
});
