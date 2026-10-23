/**
 * L7 · outils des tests : les 15 objets d'étape (hors barres et liste de tâches, déjà variés), une fixture par objet
 * (boîte, textes de la vidéo de référence, événements), et leur plan (PUR) à une image donnée. Aucun `.tsx`.
 */
import type { BoitePx, EvenementEcran, IdObjet } from "@/briques/ecrans-motion";
import { planBouclierCoche } from "../../../studio-rendu/compositions/cas-concret/plans/BouclierCoche";
import { planBulleLien } from "../../../studio-rendu/compositions/cas-concret/plans/BulleLien";
import { planCalendrier } from "../../../studio-rendu/compositions/cas-concret/plans/Calendrier";
import { planCarteTaches } from "../../../studio-rendu/compositions/cas-concret/plans/CarteTaches";
import { planChampCommentaire } from "../../../studio-rendu/compositions/cas-concret/plans/ChampCommentaire";
import { planChrono } from "../../../studio-rendu/compositions/cas-concret/plans/Chrono";
import { planContratSignature } from "../../../studio-rendu/compositions/cas-concret/plans/ContratSignature";
import { planDossierClasse } from "../../../studio-rendu/compositions/cas-concret/plans/DossierClasse";
import { planEMail } from "../../../studio-rendu/compositions/cas-concret/plans/EMail";
import { planOutilsRelies } from "../../../studio-rendu/compositions/cas-concret/plans/OutilsRelies";
import { planPileNotifications } from "../../../studio-rendu/compositions/cas-concret/plans/PileNotifications";
import { planProgramme } from "../../../studio-rendu/compositions/cas-concret/plans/Programme";
import { planRapport } from "../../../studio-rendu/compositions/cas-concret/plans/Rapport";
import { planTelephoneCapture } from "../../../studio-rendu/compositions/cas-concret/plans/TelephoneCapture";
import { planTelephoneNotification } from "../../../studio-rendu/compositions/cas-concret/plans/TelephoneNotification";

/** Images regardées (25 i/s) : début, entrée des pièces, coches, fin d'un écran de 3 s. */
export const IMAGES_L7 = [0, 5, 10, 15, 20, 25, 30, 38, 45, 60, 74] as const;

/** Les objets du lot L7. */
export const OBJETS_L7 = [
  "bouclier-coche",
  "bulle-lien",
  "calendrier",
  "carte-taches",
  "champ-commentaire",
  "chrono",
  "contrat-signature",
  "dossier-classe",
  "e-mail",
  "outils-relies",
  "pile-notifications",
  "programme",
  "rapport",
  "telephone-capture",
  "telephone-notification",
] as const satisfies readonly IdObjet[];
export type ObjetL7 = (typeof OBJETS_L7)[number];

type Fixture = { boite: BoitePx; textes?: string[]; evenements?: EvenementEcran[]; capture?: { src: string; sorte: "image" | "video" | "page-entiere"; largeur: number; hauteur: number } };
const b = (largeur: number, hauteur: number): BoitePx => ({ x: 0, y: 0, largeur, hauteur });

/** Une fixture par objet : boîte de la géométrie et textes du script (vidéo de référence ou maquettes validées). */
export const FIXTURES_L7: Readonly<Record<ObjetL7, Fixture>> = {
  "bouclier-coche": { boite: b(600, 600) },
  "bulle-lien": { boite: b(860, 210), textes: ["axion-ia.com/rendez-vous"] },
  calendrier: { boite: b(700, 700), textes: ["Octobre", "14"] },
  "carte-taches": { boite: b(760, 620), textes: ["Tâches du lundi"] },
  "champ-commentaire": { boite: b(800, 260), textes: ["Rappel"] },
  chrono: { boite: b(740, 740), textes: ["15", "minutes"] },
  "contrat-signature": { boite: b(620, 800) },
  "dossier-classe": { boite: b(600, 900) },
  "e-mail": { boite: b(760, 620), textes: ["Votre rendez-vous est confirmé"] },
  "outils-relies": { boite: b(760, 700), textes: ["Agenda", "Messagerie", "Tableau"] },
  "pile-notifications": { boite: b(900, 650), textes: ["Nouveau rendez-vous", "Paiement reçu"] },
  programme: { boite: b(700, 760), textes: ["Les bases", "La pratique", "Les outils", "Le suivi"] },
  rapport: { boite: b(700, 760), textes: ["Article · 1 200 mots", "Rédaction"] },
  "telephone-capture": { boite: b(470, 920), capture: { src: "capture.png", sorte: "page-entiere", largeur: 1080, hauteur: 3600 } },
  "telephone-notification": { boite: b(470, 920), textes: ["Rappel : notre échange demain à 14:00"] },
};

/** Propriétés d'un objet à l'image `image` (fond donné, animation `anim` si elle est donnée). */
export function proprietesL7(objet: ObjetL7, image: number, fond: "sombre" | "ivoire", anim?: number) {
  const f = FIXTURES_L7[objet];
  const t = image / 25;
  return {
    boite: f.boite,
    t,
    tVideo: t + 4,
    fond,
    dureeEcran: 3,
    evenements: f.evenements ?? [],
    ...(f.textes ? { textes: [...f.textes] } : {}),
    ...(f.capture ? { capture: { ...f.capture } } : {}),
    ...(anim !== undefined ? { anim } : {}),
  };
}

/** Le plan d'un objet du lot à l'image donnée. */
export function planL7(objet: ObjetL7, image: number, fond: "sombre" | "ivoire" = "ivoire", anim?: number): unknown {
  const p = proprietesL7(objet, image, fond, anim);
  switch (objet) {
    case "bouclier-coche":
      return planBouclierCoche(p, image);
    case "bulle-lien":
      return planBulleLien(p, image);
    case "calendrier":
      return planCalendrier(p, image);
    case "carte-taches":
      return planCarteTaches(p, image);
    case "champ-commentaire":
      return planChampCommentaire(p, image);
    case "chrono":
      return planChrono(p);
    case "contrat-signature":
      return planContratSignature(p);
    case "dossier-classe":
      return planDossierClasse(p);
    case "e-mail":
      return planEMail(p, image);
    case "outils-relies":
      return planOutilsRelies(p, image);
    case "pile-notifications":
      return planPileNotifications(p);
    case "programme":
      return planProgramme(p, image);
    case "rapport":
      return planRapport(p, image);
    case "telephone-capture":
      return planTelephoneCapture(p);
    case "telephone-notification":
      return planTelephoneNotification(p);
  }
}

/* ------------------------------------------------------------------ */
/* Vérifications communes des animations 1 et 2 d'un groupe d'objets     */
/* ------------------------------------------------------------------ */

import { describe, expect, it } from "vitest";
import { auRepos, type Mouvement } from "../../../studio-rendu/compositions/cas-concret/plans/anim-objets";

/** Toutes les images d'un écran de 3 s. */
export const TOUTES_IMAGES = Array.from({ length: 75 }, (_, i) => i);

/** Les mouvements d'un plan (hors sous-arbres `sauf`). */
export function mouvements(noeud: unknown, sauf: readonly string[] = [], trouves: Mouvement[] = []): Mouvement[] {
  if (Array.isArray(noeud)) noeud.forEach((x) => mouvements(x, sauf, trouves));
  else if (noeud && typeof noeud === "object") {
    const o = noeud as Record<string, unknown>;
    if (o.sorte === "mouvement") trouves.push(o as unknown as Mouvement);
    else for (const [k, v] of Object.entries(o)) if (!sauf.includes(k)) mouvements(v, sauf, trouves);
  }
  return trouves;
}

/** Les textes lus d'un plan (valeurs des clés `texte`, `lettre`, `lignes`, `textes`, `complet`). */
export function textesLus(noeud: unknown, trouves = new Set<string>()): Set<string> {
  if (Array.isArray(noeud)) noeud.forEach((x) => textesLus(x, trouves));
  else if (noeud && typeof noeud === "object") {
    for (const [k, v] of Object.entries(noeud as Record<string, unknown>)) {
      if (["texte", "lettre", "complet"].includes(k) && typeof v === "string") trouves.add(v);
      else if (["lignes", "textes"].includes(k) && Array.isArray(v)) v.forEach((x) => (typeof x === "string" ? trouves.add(x) : textesLus(x, trouves)));
      else textesLus(v, trouves);
    }
  }
  return trouves;
}

/** Les couleurs (#rrggbb, #rrggbbaa) d'un plan. */
export function couleurs(noeud: unknown, trouves = new Set<string>()): Set<string> {
  const json = JSON.stringify(noeud);
  for (const m of json.matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g)) trouves.add(m[0].slice(0, 7).toLowerCase());
  return trouves;
}

/** Ce que porte le plan d'une animation 1 ou 2 : son numéro, son nom (planches) et si une coche se pose à cette image. */
export type InfoAnim = { numero: number; nom: string; cochage: boolean };
const infoAnim = (plan: unknown) => (plan as { anim?: InfoAnim }).anim;

/** Les vérifications des animations 1 et 2 de chaque objet d'un groupe. */
export function verifierAnimations(lot: string, objets: readonly ObjetL7[]) {
  describe.each(objets)(`${lot} · %s : animations 1 et 2`, (objet) => {
    it("chaque animation est réelle (≠ v4, ≠ l'autre), nommée, déterministe", () => {
      for (const fond of ["sombre", "ivoire"] as const) {
        const v4 = TOUTES_IMAGES.map((i) => JSON.stringify(planL7(objet, i, fond)));
        const a = [1, 2].map((n) => TOUTES_IMAGES.map((i) => JSON.stringify(planL7(objet, i, fond, n))));
        for (const [k, n] of [1, 2].entries()) {
          expect(a[k]!.some((x, i) => x !== v4[i]), `anim ${n}`).toBe(true);
          const info = infoAnim(planL7(objet, 10, fond, n));
          expect(info?.numero).toBe(n);
          expect(info?.nom.length).toBeGreaterThan(3);
          expect(TOUTES_IMAGES.map((i) => JSON.stringify(planL7(objet, i, fond, n)))).toEqual(a[k]);
        }
        expect(a[0]).not.toEqual(a[1]);
        expect(infoAnim(planL7(objet, 10, fond, 1))!.nom).not.toBe(infoAnim(planL7(objet, 10, fond, 2))!.nom);
      }
    });

    it("fin de l'écran : tout est posé (mouvements au repos), mêmes textes que la v4 (ceux du script, rien d'inventé)", () => {
      for (const fond of ["sombre", "ivoire"] as const) {
        const textesV4 = new Set<string>();
        for (const i of TOUTES_IMAGES) textesLus(planL7(objet, i, fond), textesV4);
        for (const n of [1, 2]) {
          const fin = planL7(objet, 74, fond, n);
          for (const m of mouvements(fin)) expect(auRepos(m), `anim ${n}`).toBe(true);
          expect([...textesLus(fin)].sort()).toEqual([...textesLus(planL7(objet, 74, fond))].sort());
          for (const i of TOUTES_IMAGES) for (const t of textesLus(planL7(objet, i, fond, n))) expect(textesV4.has(t), `« ${t} »`).toBe(true);
        }
      }
    });

    it("charte : aucune couleur hors de celles de la v4 ; zone sûre : pièces jamais lancées hors de l'objet", () => {
      const { largeur, hauteur } = FIXTURES_L7[objet].boite;
      for (const fond of ["sombre", "ivoire"] as const) {
        const charte = new Set<string>();
        for (const i of TOUTES_IMAGES) couleurs(planL7(objet, i, fond), charte);
        for (const n of [1, 2]) {
          for (const i of TOUTES_IMAGES) {
            const p = planL7(objet, i, fond, n);
            for (const c of couleurs(p)) expect(charte.has(c), `${c} (anim ${n}, image ${i})`).toBe(true);
            for (const m of mouvements(p)) {
              expect(Math.abs(m.dx)).toBeLessThanOrEqual(largeur * 0.35);
              expect(Math.abs(m.dy)).toBeLessThanOrEqual(hauteur * 0.35);
              expect(Math.abs(m.rotation)).toBeLessThanOrEqual(12);
              for (const e of [m.echelleX, m.echelleY]) expect(e >= 0 && e <= 1.2).toBe(true);
            }
          }
        }
      }
    });

    it("jamais de mouvement pendant qu'une coche se pose (hors la coche elle-même)", () => {
      for (const n of [1, 2]) {
        for (const i of TOUTES_IMAGES) {
          const p = planL7(objet, i, "ivoire", n);
          if (!infoAnim(p)!.cochage) continue;
          // Une pièce encore invisible (pas arrivée) ne bouge pas à l'écran.
          for (const m of mouvements(p, ["coche"])) if (m.opacite > 0) expect(auRepos(m), `anim ${n}, image ${i}`).toBe(true);
        }
      }
    });
  });
}
