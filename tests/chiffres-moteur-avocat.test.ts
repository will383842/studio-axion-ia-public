/**
 * SÉRIE « CHIFFRES » (audit de bout en bout, non bloquants 4.3, 4.12 et 4.13) — moteur `montage-avocat` en montage réel
 * (studio-rendu injecté, faux), AUCUN appel réseau, aucune clé.
 *  - 4.3 : la note de qualité ne contient plus de sous-notes inventées (lèvres, son, sous-titres, réalisme = note ±
 *    constante) ; l'écran ne montre que la note globale, libellée « Estimation », et les alertes ;
 *  - 4.12 : l'étape « Sous-titres » suit le vrai travail (la composition), jamais l'horloge ;
 *  - 4.13 : en montage réel, l'estimation ne contient plus les prix d'essai des étapes faites sur notre serveur
 *    (sous-titres, couleurs, son, habillage, formats d'image) ; en essai, rien ne change.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { CarteQualite } = await import("@/components/videos/CarteQualite");
const { cleEtapeDeLigne } = await import("@/moteurs/couts-etapes");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP = "chiffres-moteur-avocat";
const T0 = Date.UTC(2026, 9, 3, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const stockageSigne = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}?court`,
  urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
  urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
});

const MESURES = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 52_000_000, debitKbps: 14_050, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lufs: -14.1, lra: 2.2, creteVraieDbtp: -2.0, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41 };

/** studio-rendu injecté : chaque demande se termine deux tours plus tard (on voit la composition en cours). */
function fauxRendu(): ServiceRendu {
  const etats = new Map<string, { tours: number; d: DemandeRendu }>();
  return {
    async soumettre(d) {
      etats.set(d.idRendu, { tours: 0, d });
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const e = etats.get(id);
      if (!e) return { statut: "inconnu" };
      e.tours++;
      if (e.tours < 3) return { statut: "en_cours", progression: 40 } as EtatRendu;
      return { statut: "termine", sortieCle: e.d.sortie.cle, mesures: e.d.operation === "composition" ? MESURES : undefined };
    },
  };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail, regarder?: (t: Travail) => void): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    regarder?.(travail);
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

describe("4.3 · note de qualité de la vidéo : plus de sous-notes inventées", () => {
  it("montage réel : seulement la note globale et les alertes", async () => {
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    const { travail, resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-q", versionId: "ver-q", titre: "Q", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    const note = resultat!.noteQualite;
    expect(note.globale).toBeGreaterThan(0);
    expect(Object.keys(note).sort()).toEqual(["alertes", "globale"]);
  });

  it("à l'écran : la note globale libellée « Estimation », sans barres Lèvres / Son / Sous-titres / Réalisme", () => {
    // Une ancienne note (enregistrée avant ce correctif) garde ses sous-notes en base : elles ne s'affichent plus.
    const html = renderToStaticMarkup(createElement(CarteQualite, { note: { globale: 88, levres: 91, son: 92, sousTitres: 93, realisme: 80, alertes: [{ code: "rythme", gravite: "attention", message: "Plan long à 12 s." }] } as never }));
    expect(html).toContain("Estimation");
    expect(html).toContain("88");
    expect(html).toContain("Plan long à 12 s.");
    for (const mot of ["Lèvres", "Réalisme", "Sous-titres", ">91<", ">80<"]) expect(html).not.toContain(mot);
  });
});

describe("4.12 · « Sous-titres » suit la composition, pas l'horloge", () => {
  it("montage réel : l'étape n'est jamais planifiée à l'horloge, finit avec la composition, coût nul", async () => {
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    expect(c.briques["sous-titres"]).toBe(true);
    let planifiee = false;
    let finieAvantMontage = false;
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-st", versionId: "ver-st", titre: "ST", maintenant: T0 }), (t) => {
      const st = t.etapes.find((e) => e.cle === "sous-titres");
      if (st?.planifie) planifiee = true;
      const montage = t.etapes.find((e) => e.cle === "montage");
      if (st?.statut === "terminee" && montage?.statut !== "terminee") finieAvantMontage = true;
    });
    expect(travail.statut).toBe("termine");
    expect(planifiee).toBe(false);
    expect(finieAvantMontage).toBe(false);
    expect(travail.etapes.find((e) => e.cle === "sous-titres")).toMatchObject({ statut: "terminee", coutReel: { centimes: 0 } });
  });
});

describe("4.13 · estimation du montage réel : pas de prix d'essai", () => {
  const ETAPES_SERVEUR = ["sous-titres", "etalonnage", "son", "montage", "export"];

  it("studio-rendu relié : aucune ligne d'essai pour les étapes faites sur notre serveur", async () => {
    const m = creerMoteurMontageAvocat({ rendu: fauxRendu(), stockage: stockageSigne, environnement: { STUDIO_RENDU_URL: "https://rendu.exemple" } });
    const c = await fabrication.construireCommande("v-03");
    const e = await m.estimer(c);
    const essais = e.lignes.filter((l) => l.fournisseur === "simulation" && ETAPES_SERVEUR.includes(cleEtapeDeLigne(l.etape)));
    expect(essais.map((l) => l.etape)).toEqual([]);
    expect(e.total.centimes).toBe(e.lignes.reduce((s, l) => s + l.total.centimes, 0));
  });

  it("montage en essai (sans studio-rendu) : l'estimation d'essai est inchangée", async () => {
    const m = creerMoteurMontageAvocat({ stockage: stockageSigne, environnement: {} });
    const c = await fabrication.construireCommande("v-03");
    const e = await m.estimer(c);
    expect(e.lignes.some((l) => l.fournisseur === "simulation" && cleEtapeDeLigne(l.etape) === "export")).toBe(true);
  });
});
