/**
 * N-05-VOLET-d-v20j : le volet avant / après est inscrit au plan de scènes SANS adresse, PORTE FERMÉE (dernier des 57 petits objets).
 * a) éteint = identique ; b) non permis : retiré ; c) permis : gardé, survit à la re-validation ; d) consigne (exemple sans adresse) ;
 * e) adresse écrite par Claude : retirée ; f) `regles.ts` ne propose jamais le volet ; g) aucun profil ne le permet ;
 * h) le tableau ne le dessine pas ; i) AM-18 ; j) rendu : vide sans adresse, 2 images avec. Aucun appel réel.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { RENDUS_OBJETS } from "@/briques/plan-scenes/briques/objets-inscrits";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { ReponseClaude, RequeteClaude } from "@/fournisseurs/claude/client";
import { consigneRetouche } from "@/services/retouche-chat/comprendre";

const VOLET = "objet-volet-avant-apres";
const fixture = (f: string) => readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), "utf8");
const lire = (...c: string[]) => readFileSync(new URL(["..", "..", "..", ...c].join("/"), import.meta.url), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** sha256 de consignePlan() et de consigneRetouche() relevés sur master AVANT la modification. */
const SHA_CONSIGNE_PLAN = "96db206bff5f2b27ab156f965d9080060ab8481e32d0282ca7634cf502e17716";
const SHA_CONSIGNE_RETOUCHE = "d595103399baa60cc493428740413a1a475737a8b0bf58edc88431fdf9d49185";

const MOTS = "J'ai gagné 42 heures cette semaine".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 350 }));
const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const contexte = { mots: MOTS, format: FORMAT, facecam: false };
const planAvec = (piece: string, parametres: unknown) => {
  const p = structuredClone(PLAN_DEMO) as unknown as { scenes: Record<string, unknown>[] };
  p.scenes = [{ id: "o", version: 1, mots: { premier: 0, dernier: MOTS.length - 1 }, debutMs: 0, finMs: 4000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece, parametres }];
  return p;
};
const permis = { ...contexte, objetsPermis: [VOLET] };

describe("a) éteint = identique", () => {
  it("consignes égales aux fichiers figés et à leur sha256 relevé sur master", () => {
    expect(consignePlan()).toBe(fixture("consigne-avant-porte.txt"));
    expect(consignePlan([])).toBe(fixture("consigne-avant-porte.txt"));
    expect(sha(consignePlan())).toBe(SHA_CONSIGNE_PLAN);
    expect(consigneRetouche()).toBe(fixture("consigne-retouche-avant-objets.txt"));
    expect(sha(consigneRetouche())).toBe(SHA_CONSIGNE_RETOUCHE);
  });
  it("aucune requête d'un Claude simulé (sans objetsPermis) ne cite le volet", async () => {
    const SCRIPT = "Ce n'est pas douze heures mais deux heures de travail par semaine pour chaque dossier ouvert ici";
    const mots: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: (i * 350) / 1000, finSec: (i * 350 + 300) / 1000 }));
    const entree: EntreeAdaptateur = { generateur: "cas-concret", script: SCRIPT, segments: segmenterEnPhrases(enMillisecondes(mots)), format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false };
    const requetes: RequeteClaude[] = [];
    const appeler = async (req: RequeteClaude): Promise<ReponseClaude> => (requetes.push(req), { texte: JSON.stringify(planAvec("legende", { texte: "Essai", sousTexte: "", style: "bandeau" })), stopReason: "end_turn" } as ReponseClaude);
    await adapterPlan(entree, { appeler });
    expect(requetes.length).toBeGreaterThan(0);
    expect(JSON.stringify(requetes)).not.toContain(VOLET);
  });
});

describe("b) non permis : retiré", () => {
  it("remarque OBJET_NON_PERMIS, aucune scène ni calque volet", () => {
    const r = validerPlan(planAvec(VOLET, { etiquettes: true }), contexte);
    expect(r.remarques.some((x) => x.code === "OBJET_NON_PERMIS")).toBe(true);
    expect(JSON.stringify(r.plan)).not.toContain(VOLET);
  });
});

describe("c) permis : gardé", () => {
  it.each([{}, { sens: "droite-gauche", etiquettes: true }])("volet %j gardé, et le même plan à la re-validation", (parametres) => {
    const r1 = validerPlan(planAvec(VOLET, parametres), permis);
    expect(r1.plan.scenes.some((s) => s.piece === VOLET)).toBe(true);
    const r2 = validerPlan(r1.plan, permis);
    expect(r2.plan).toEqual(r1.plan);
  });
});

describe("d) consigne avec le volet permis", () => {
  it("l'exemple est {\"etiquettes\":true}, sans « avant » ni « apres »", () => {
    const consigne = consignePlan([VOLET]);
    const debut = consigne.indexOf(`- ${VOLET} (`);
    const ligne = consigne.slice(debut, consigne.indexOf("\n  schéma", debut));
    expect(debut).toBeGreaterThan(-1);
    expect(ligne).toContain('paramètres (exemple) : {"etiquettes":true}');
    expect(ligne).not.toContain('"avant"');
    expect(ligne).not.toContain('"apres"');
    // Taille ajoutée (relevée au journal) : positive.
    expect(consigne.length - consignePlan().length).toBeGreaterThan(0);
  });
});

describe("e) adresse écrite par Claude : retirée", () => {
  const adresses = { avant: "https://x/a.png", apres: "https://x/b.png" };
  it("scène : SCENE_RETIREE, jamais l'exemple, aucune adresse dans le plan", () => {
    const r = validerPlan(planAvec(VOLET, adresses), permis);
    expect(r.remarques.some((x) => x.code === "SCENE_RETIREE")).toBe(true);
    expect(r.plan.scenes.some((s) => s.piece === VOLET)).toBe(false);
    expect(JSON.stringify(r.plan)).not.toContain("https://x/");
  });
  it("calque de niveau 2 : retiré, aucune adresse", () => {
    const p = planAvec("inconnue", {}) as unknown as { scenes: Record<string, unknown>[] };
    p.scenes[0]!.niveau = 2;
    p.scenes[0]!.calques = [{ piece: VOLET, parametres: adresses, debutMs: 0, zone: "plein" }];
    const r = validerPlan(p, permis);
    expect(r.plan.scenes.some((s) => (s.calques ?? []).some((c) => c.piece === VOLET))).toBe(false);
    expect(JSON.stringify(r.plan)).not.toContain("https://x/");
  });
});

describe("f) g) h) i) gardes", () => {
  it("f) regles.ts ne parle jamais du volet", () => {
    expect(lire("src", "briques", "plan-scenes-objets", "regles.ts").toLowerCase()).not.toContain("volet");
  });
  it("g) aucun profil du code ne permet le volet", () => {
    for (const [nom, profil] of Object.entries(PROFILS_DU_CODE)) {
      const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-20" };
      expect(piecesPermisesDesEntrees({ bibliothequeVideo: e }), nom).not.toContain(VOLET);
    }
  });
  it("h) le tableau ne le dessine pas (lu par chemin calculé)", () => {
    expect(lire("studio-rendu", "compositions", "tableau", "ObjetsTableau.tsx")).not.toMatch(/VOLET/);
  });
  it("i) objets-inscrits.ts n'importe pas plan-scenes-objets (AM-18)", () => {
    expect(lire("src", "briques", "plan-scenes", "briques", "objets-inscrits.ts")).not.toMatch(/from\s+["'][^"']*plan-scenes-objets/);
  });
});

describe("j) rendu", () => {
  const rendu = RENDUS_OBJETS[VOLET] as unknown as (p: unknown) => unknown;
  const html = (parametres: unknown) => renderToStaticMarkup(createElement(rendu as never, { image: 20, fps: 25, dureeImages: 75, fond: "ivoire", parametres }));
  it("l'exemple sans adresse : rien ; avec deux adresses (copie de rendu) : 2 images", () => {
    expect(html((CATALOGUE_BRIQUES as Record<string, { exemple: unknown }>)[VOLET]!.exemple)).toBe("");
    expect(html({ avant: "a.png", apres: "b.png" }).match(/<img/g)).toHaveLength(2);
  });
});
