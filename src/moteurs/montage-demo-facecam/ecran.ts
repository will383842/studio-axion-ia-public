/**
 * LE PLAN DE SCÈNES AUTOUR DE L'ÉCRAN RÉEL (lot J). Le générateur du lot C compose des pièces de fausse interface ; ici
 * l'interface est VRAIE (l'enregistrement d'écran de Williams). On garde donc ce qui se pose sur un écran réel sans le
 * cacher, et on change le reste :
 *  - `zoom-camera` (scène ou calque) → zoom DOUX sur l'écran réel (facteur ≤ 1,35), au point visé ;
 *  - `curseur` avec clic → surlignage du clic gardé (anneau transparent), et zoom doux vers le point cliqué ;
 *  - fausses fenêtres opaques (`fenetre-app`, `tableau-de-bord`, `liste-crm`) → légende (texte de la scène), car elles
 *    masqueraient l'écran réel ;
 *  - légendes, frappe, chiffres, graphiques, bulles : gardés (posés en haut ou en bas, autour de l'action).
 * Niveau 3 interdit par défaut : le validateur le replie toujours. Rien n'est refusé : chaque changement est une remarque.
 */
import type { IdPiece } from "@/briques/plan-scenes/catalogue";
import type { MotMinute, PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import { parametresDepuisTexte, validerPlan } from "@/briques/plan-scenes/validateur";
import { ZONES, SOUS_ZONES, type Position } from "@/briques/plan-scenes/zones";
import { FACTEUR_ZOOM_MAX, HABILLAGE_DEMO, type ZoomEcran } from "./proprietes";

/** Pièces qui cacheraient l'écran réel : remplacées par une légende. */
export const PIECES_OPAQUES: readonly IdPiece[] = ["fenetre-app", "tableau-de-bord", "liste-crm", "zoom-camera"];
/** Facteur d'un zoom doux né d'un clic. */
export const FACTEUR_ZOOM_CLIC = 1.2;

export interface PlanEcran {
  plan: PlanValide;
  zooms: ZoomEcran[];
  /** Ce qui a été changé (jamais un refus). */
  remarques: string[];
}

const borne = (v: number) => Math.min(92, Math.max(8, Math.round(v)));
const doux = (f: number) => Math.round(Math.min(FACTEUR_ZOOM_MAX, Math.max(1.05, f)) * 100) / 100;

/** Point d'une pièce (en % de sa zone) ramené en % de l'écran. */
function pointEcran(position: Position, sousZone: Position | undefined, p: { x: number; y: number }) {
  const z = ZONES[position];
  const s = sousZone ? SOUS_ZONES[sousZone] : { x: 0, y: 0, largeur: 100, hauteur: 100 };
  const x = z.x + ((s.x + (s.largeur * p.x) / 100) / 100) * z.largeur;
  const y = z.y + ((s.y + (s.hauteur * p.y) / 100) / 100) * z.hauteur;
  return { x: borne(x), y: borne(y) };
}

function texteScene(s: SceneValide, mots: readonly MotMinute[]): string {
  if (s.texte?.trim()) return s.texte.trim();
  const t = mots
    .slice(s.mots.premier, s.mots.dernier + 1)
    .map((m) => m.texte)
    .join(" ");
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t || "Axion IA";
}

type Piece = { piece: IdPiece; parametres: unknown };

/** Zoom doux tiré d'une pièce (zoom-camera, ou curseur qui clique), sinon rien. */
function zoomDe(p: Piece, s: SceneValide, sousZone: Position | undefined, debutMs: number): ZoomEcran | null {
  if (p.piece === "zoom-camera") {
    const z = p.parametres as { cible: { x: number; y: number }; facteur: number; moment: number };
    const debut = Math.round(debutMs + (s.finMs - debutMs) * z.moment);
    return { sceneId: s.id, debutMs: debut, finMs: s.finMs, ...pointEcran(s.position, sousZone, z.cible), facteur: doux(z.facteur) };
  }
  if (p.piece === "curseur") {
    const c = p.parametres as { trajet: { x: number; y: number }[]; clic: boolean; partDeplacement: number };
    if (!c.clic || !c.trajet.length) return null;
    const debut = Math.round(debutMs + (s.finMs - debutMs) * c.partDeplacement);
    return { sceneId: s.id, debutMs: debut, finMs: s.finMs, ...pointEcran(s.position, sousZone, c.trajet.at(-1)!), facteur: FACTEUR_ZOOM_CLIC };
  }
  return null;
}

/** Adapte un plan validé à l'écran réel ; le plan rendu est revalidé (empreintes à jour, fond transparent). */
export function planAutourDeLEcran(plan: PlanValide, avecZooms: boolean): PlanEcran {
  const zooms: ZoomEcran[] = [];
  const remarques: string[] = [];
  const scenes = plan.scenes.map((s) => {
    const z1 = s.niveau === 1 ? zoomDe(s, s, undefined, s.debutMs) : null;
    const calques = s.niveau === 2 ? (s.calques ?? []) : [];
    for (const k of calques) {
      const z = zoomDe(k, s, k.zone, s.debutMs + k.debutMs);
      if (z) zooms.push(z);
    }
    if (z1) zooms.push(z1);
    if (s.niveau === 2 && calques.length) {
      const gardes = calques.filter((k) => !PIECES_OPAQUES.includes(k.piece));
      if (gardes.length === calques.length) return s;
      if (gardes.length) return { ...s, calques: gardes };
      const { calques: _c, ...reste } = s;
      void _c;
      remarques.push(`Scène ${s.id} : composition remplacée par une légende (l'écran réel reste visible).`);
      return { ...reste, niveau: 1 as const, piece: "legende" as const, parametres: parametresDepuisTexte("legende", texteScene(s, plan.mots)) } as SceneValide;
    }
    if (PIECES_OPAQUES.includes(s.piece)) {
      remarques.push(`Scène ${s.id} : « ${s.piece} » remplacée par une légende (l'écran réel reste visible).`);
      return { ...s, piece: "legende" as const, parametres: parametresDepuisTexte("legende", texteScene(s, plan.mots)) } as SceneValide;
    }
    return s;
  });
  if (!avecZooms && zooms.length) remarques.push("Vidéo unique déjà en écran partagé : pas de zoom (il agrandirait aussi votre visage).");
  // Fond ivoire de la charte, quoi qu'ait proposé l'IA.
  const r = validerPlan({ ...plan, habillage: HABILLAGE_DEMO, scenes }, { mots: plan.mots, format: plan.format, facecam: plan.facecam, dureeMs: plan.dureeMs });
  return { plan: r.plan, zooms: avecZooms ? sansChevauchement(zooms) : [], remarques };
}

/** Un zoom à la fois : un zoom qui commence avant la fin du précédent le raccourcit. */
function sansChevauchement(zooms: ZoomEcran[]): ZoomEcran[] {
  const tries = [...zooms].sort((a, b) => a.debutMs - b.debutMs);
  const sortie: ZoomEcran[] = [];
  for (const z of tries) {
    const prec = sortie.at(-1);
    if (prec && prec.finMs > z.debutMs) prec.finMs = z.debutMs;
    sortie.push({ ...z });
  }
  return sortie.filter((z) => z.finMs - z.debutMs >= 400);
}
