/**
 * TÉMOIN « SANS / AVEC RÉGLAGE » DES PETITS OBJETS (C9-41-a-v19c). PUR : aucun disque, aucun réseau, aucune horloge.
 * Calcule le plan de scènes du cas concret deux fois sur 3 textes fixes (règles fixes, sans Claude : 0 €), sans puis avec la
 * liste des petits objets permis, et en fait une page HTML. Lancé à la main (`lancer.mts`), jamais en CI ; aucun générateur
 * n'importe ce fichier ; rien n'est allumé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { adapterPlan } from "../../src/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases } from "../../src/briques/plan-scenes-generateurs/video";
import { RENDUS_BRIQUES } from "../../src/briques/plan-scenes/briques";
import type { ProprietesBrique } from "../../src/briques/plan-scenes/briques/communs";
import type { MotMinute, PlanValide } from "../../src/briques/plan-scenes/schema";
import { TOILES } from "../../src/briques/plan-scenes/toiles";
import { FORMAT_PLAN_CAS_CONCRET } from "../../src/moteurs/montage-cas-concret/plan-scenes";

export const SCRIPTS_TEMOIN: readonly string[] = [
  "Ce mois-ci, nous avons envoyé 38 devis. Résultat : 12 clients de plus qu'en septembre.",
  "Bonjour à tous. Aujourd'hui, je vous explique la méthode. Étape 1 : vous nous écrivez. Étape 2 : nous vous répondons.",
  "Bonjour à tous. Le chantier est terminé, c'est fait. Merci de votre confiance.",
];

export const OBJETS_TEMOIN = ["objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche"] as const;

const MS_PAR_MOT = 400;

export interface EntreeTemoin {
  texte: string;
  sans: PlanValide | null;
  avec: PlanValide | null;
}

/** Les mots du texte, 400 ms chacun, calés bout à bout (aucune horloge, aucune voix). */
export function motsDuTexte(texte: string): MotMinute[] {
  return enMillisecondes(
    texte
      .split(/\s+/)
      .filter(Boolean)
      .map((t, i) => ({ texte: t, debutSec: (i * MS_PAR_MOT) / 1000, finSec: ((i + 1) * MS_PAR_MOT) / 1000 })),
  );
}

/** Plan du cas concret pour un texte, par les règles fixes seulement (jamais d'`appeler`). */
export async function planTemoin(texte: string, objets: readonly string[]): Promise<PlanValide | null> {
  const mots = motsDuTexte(texte);
  const r = await adapterPlan({
    generateur: "cas-concret",
    script: texte,
    segments: segmenterEnPhrases(mots),
    format: FORMAT_PLAN_CAS_CONCRET,
    facecam: false,
    ...(objets.length ? { objetsPermis: objets } : {}),
  });
  return r.plan;
}

export async function temoinObjets(): Promise<EntreeTemoin[]> {
  const sortie: EntreeTemoin[] = [];
  for (const texte of SCRIPTS_TEMOIN) sortie.push({ texte, sans: await planTemoin(texte, []), avec: await planTemoin(texte, OBJETS_TEMOIN) });
  return sortie;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const seconde = (ms: number): string => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const estObjet = (piece: string): boolean => piece.startsWith("objet-");
const ECHELLE = 0.4;

function listeScenes(plan: PlanValide | null): string {
  if (!plan || !plan.scenes.length) return "<p>Aucune scène : l'existant garde tout.</p>";
  const lignes = plan.scenes.map((s) => {
    const dits = plan.mots.slice(s.mots.premier, s.mots.dernier + 1).map((m) => m.texte).join(" ");
    return `<li><strong>${esc(s.piece)}</strong> · ${esc(dits)} · ${seconde(s.debutMs)}–${seconde(s.finMs)}</li>`;
  });
  return `<ol>${lignes.join("")}</ol>`;
}

function dessin(piece: string, parametres: unknown, dureeMs: number): string {
  const R = (RENDUS_BRIQUES as unknown as Record<string, (p: ProprietesBrique<unknown>) => unknown>)[piece];
  const toile = (TOILES as unknown as Record<string, { largeur: number; hauteur: number }>)[piece];
  if (!R || !toile) return "";
  const fps = FORMAT_PLAN_CAS_CONCRET.fps;
  const dureeImages = Math.max(2, Math.round((dureeMs / 1000) * fps));
  const interieur = renderToStaticMarkup(createElement(R as never, { image: dureeImages / 2, fps, dureeImages, fond: "noir", parametres } as never) as never);
  return `<div class="boite" style="width:${Math.round(toile.largeur * ECHELLE)}px;height:${Math.round(toile.hauteur * ECHELLE)}px"><div style="width:${toile.largeur}px;height:${toile.hauteur}px;transform:scale(${ECHELLE});transform-origin:0 0;background:#111">${interieur}</div></div>`;
}

function dessins(plan: PlanValide | null): string {
  if (!plan) return "";
  return plan.scenes
    .filter((s) => estObjet(s.piece))
    .map((s) => `<figure data-piece="${esc(s.piece)}">${dessin(s.piece, s.parametres, s.finMs - s.debutMs)}<figcaption>${esc(s.piece)}</figcaption></figure>`)
    .join("");
}

export function pageTemoin(t: readonly EntreeTemoin[]): string {
  const sections = t
    .map(
      (e, i) =>
        `<section><h2>Script ${i + 1}</h2><p class="texte">${esc(e.texte)}</p><div class="deux"><div><h3>Sans réglage (aujourd'hui)</h3>${listeScenes(e.sans)}</div><div><h3>Avec les petits objets</h3>${listeScenes(e.avec)}<div class="dessins">${dessins(e.avec)}</div></div></div></section>`,
    )
    .join("");
  const style = "body{margin:0;padding:24px;background:#faf6ee;color:#1c1917;font-family:Manrope,system-ui,sans-serif}h1,h2,h3{margin:.4em 0}.texte{font-style:italic}.deux{display:flex;gap:32px;flex-wrap:wrap}.deux>div{flex:1;min-width:320px}.boite{overflow:hidden;border-radius:8px}figure{margin:8px 0}li{margin:4px 0}";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Témoin petits objets — cas concret</title><style>${style}</style></head><body><h1>Témoin petits objets — cas concret</h1>${sections}</body></html>`;
}
