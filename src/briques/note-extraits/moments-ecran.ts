/**
 * Moments « écran » tirés d'un plan de scènes (X4-03). Fonction pure : aucun appel, aucun réseau, aucune date du jour.
 * Appelée seulement par X4-06 / X4-09 ; rien ne l'importe pour l'instant.
 *
 * RELEVÉ — où le plan de scènes est gardé après la fabrication (générateur par générateur) :
 * - Démo facecam : OUI, relisible. Le plan validé est dans `projetMontage.reprise.plan` (`src/moteurs/montage-demo-facecam/index.ts:129,135`,
 *   `RepriseDemo.plan`) ; la lecture sûre existe déjà : `lireRepriseDemo` (`src/moteurs/montage-demo-facecam/chaine.ts:389-391`, exige `plan.scenes` tableau).
 * - Tutoriel d'outil : OUI, relisible. Le plan de scènes est dans `projetMontage.tutoriel.plan.plan` (`PlanRetenu` : `src/moteurs/montage-tutoriel-outil/chaine.ts:86-87` ; `index.ts:197-199`),
 *   lu par `lireProjetTutoriel` (vérifie `p.plan?.plan`, `index.ts:142-144`).
 * - Cas concret : NON (aucune supposition). Le plan n'existe que si le réglage `planScenes.casConcret` est allumé (éteint par défaut,
 *   `src/moteurs/montage-cas-concret/index.ts:109-110`, `fabriquer.ts:1070-1073`) ; il n'est gardé que comme mémo interne par groupe
 *   (`fabriquer.ts:1081`, `plan-scenes.ts:32`) en temps relatif au groupe, et n'est pas posé dans `projetMontage`.
 *   Ce générateur n'a donc PAS de moments écran ici.
 * Cette fonction reçoit un plan déjà lu par l'appelant (type `unknown`) : tout plan illisible donne `[]`.
 */
import { estPiece, type IdPiece } from "@/briques/plan-scenes/catalogue";
import type { Moment, Montre } from "./types";

/** Ce que chaque pièce du catalogue montre. Une pièce neuve doit recevoir sa ligne (test). */
export const MONTRE_PAR_PIECE: Record<IdPiece, Montre> = {
  "tableau-de-bord": "interface",
  "liste-crm": "interface",
  "fenetre-app": "interface",
  "bulle-chat": "interface",
  "carte-kpi": "chiffre",
  graphique: "chiffre",
  compteur: "chiffre",
  jauge: "chiffre",
  barres: "chiffre",
  etapes: "demarche",
  "avant-apres": "demarche",
  "liste-au-mot": "demarche",
  curseur: "geste",
  "frappe-clavier": "geste",
  "zoom-camera": "geste",
  legende: "texte",
  citation: "texte",
  repere: "texte",
  // BR-OBJETS-a (18/11/2026) : les 4 objets inscrits au catalogue.
  "objet-gros-chiffre": "chiffre",
  "objet-etape": "demarche",
  "objet-cartes-coche": "demarche",
  "objet-coche": "geste",
  // BR-OBJETS-c (18/11/2026) : les 6 petits objets de plus.
  "objet-soulignement-droit": "texte",
  "objet-croix": "texte",
  "objet-mot-barre": "texte",
  "objet-compteur-rouleau": "chiffre",
  "objet-carton-definition": "texte",
  "objet-fleche-main-levee": "geste",
  // BR-OBJETS-2027-b : croquis et traits de feutre.
  "objet-croquis": "geste",
  "objet-feutre-entourage": "texte",
  "objet-feutre-soulignement": "texte",
  // N-05-v19b : carton = texte (voisin : carton définition) ; icône qui tourne et particules = geste (voisins : coche, flèche) ; panneau de réglages = interface ; anneau = chiffre.
  "objet-carton-magazine": "texte",
  "objet-tourne": "geste",
  "objet-particules": "geste",
  "objet-panneau-reglages": "interface",
  "objet-anneau-donnees": "chiffre",
  // VL-10 : pièces 16:9 de la vidéo longue (porte fermée).
  "intercalaire-chapitre": "texte",
  "flux-ramifie": "demarche",
  "cadre-capture": "interface",
  // C9-34-TRAITS-v19c (19/11/2026) : soulignements et surligneur = texte (voisin : soulignement droit), flèches = geste (voisin : flèche à main levée).
  "objet-soulignement-vague": "texte",
  "objet-soulignement-double": "texte",
  "objet-surligneur": "texte",
  "objet-fleche-droite": "geste",
  "objet-fleche-courbe": "geste",
  "objet-fleche-pointillee": "geste",
  // C9-34-CADRES-v20b (20/11/2026) : cadres et entourages = texte (voisin : entourage au feutre).
  "objet-cadre-rectangle": "texte",
  "objet-cadre-coins": "texte",
  "objet-cadre-passage": "texte",
  "objet-cercle": "texte",
  "objet-ovale": "texte",
  "objet-double-boucle": "texte",
  // C9-34-ETIQUETTES-v20f (20/11/2026) : étiquettes et bulles = texte (voisin : carton définition).
  "objet-pastille-icone": "texte",
  "objet-etiquette-icone": "texte",
  "objet-badge": "texte",
  "objet-tampon": "texte",
  "objet-bulle-parole": "texte",
  "objet-bulle-pensee": "texte",
  "objet-bulle-notification": "texte",
  "objet-post-it": "texte",
  // C9-34-SCHEMAS-v20g (20/11/2026) : schémas = démarche, fenêtre et terminal = interface (voisin : panneau de réglages ; le type Montre n'a pas de valeur « schema »).
  "objet-schema-flux": "demarche",
  "objet-schema-etoile": "demarche",
  "objet-icones-reliees": "demarche",
  "objet-agents-globe": "demarche",
  "objet-grille-pointillee": "demarche",
  "objet-vignettes-numerotees": "demarche",
  "objet-fenetre-app": "interface",
  "objet-terminal-commande": "interface",
  // C9-34-FIN-v20h (20/11/2026) : voisins existants (étape = démarche, chiffres, étiquettes = texte)
  "objet-dossier": "demarche",
  "objet-chrono": "chiffre",
  "objet-barre-progression": "chiffre",
  "objet-etape-segments": "demarche",
  "objet-appel-action": "texte",
  "objet-appel-mot": "texte",
  "objet-appel-rdv": "texte",
  "objet-frise-montage": "interface",
  "objet-pellicule": "interface",
  "objet-onde-motif": "demarche",
};

const DUREE_MAX_SEC = 6;
const DUREE_MIN_SEC = 3;

interface Bloc {
  debutSec: number;
  finSec: number;
  montre: Montre;
  pieces: IdPiece[];
  texte?: string;
  texteIncruste: boolean;
}

const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function lireScene(brut: unknown): Bloc | null {
  if (!brut || typeof brut !== "object") return null;
  const s = brut as { piece?: unknown; debutMs?: unknown; finMs?: unknown; texte?: unknown; calques?: unknown };
  if (!estPiece(s.piece) || !nombre(s.debutMs) || !nombre(s.finMs) || s.debutMs < 0 || s.finMs <= s.debutMs) return null;
  const pieces: IdPiece[] = [s.piece];
  if (Array.isArray(s.calques)) {
    for (const c of s.calques) {
      const p = (c as { piece?: unknown } | null)?.piece;
      if (estPiece(p) && !pieces.includes(p)) pieces.push(p);
    }
  }
  const texte = typeof s.texte === "string" && s.texte.trim() ? s.texte.trim() : undefined;
  const montre = MONTRE_PAR_PIECE[s.piece];
  return { debutSec: s.debutMs / 1000, finSec: s.finMs / 1000, montre, pieces, ...(texte ? { texte } : {}), texteIncruste: montre === "texte" || texte !== undefined };
}

function fondre(a: Bloc, b: Bloc): void {
  a.debutSec = Math.min(a.debutSec, b.debutSec);
  a.finSec = Math.max(a.finSec, b.finSec);
  for (const p of b.pieces) if (!a.pieces.includes(p)) a.pieces.push(p);
  a.texte ??= b.texte;
  a.texteIncruste ||= b.texteIncruste;
}

/** Une scène → un ou plusieurs moments de 6 s au plus ; moins de 3 s : fondue avec la voisine de même `montre`, sinon écartée. */
export function momentsDepuisScenes(plan: unknown, options: { avecVisage: boolean }): Moment[] {
  const scenes = (plan as { scenes?: unknown } | null | undefined)?.scenes;
  if (!Array.isArray(scenes)) return [];
  const blocs = scenes.map(lireScene).filter((b): b is Bloc => b !== null).sort((x, y) => x.debutSec - y.debutSec);
  const gardes: Bloc[] = [];
  blocs.forEach((b, i) => {
    if (b.finSec - b.debutSec >= DUREE_MIN_SEC) return void gardes.push(b);
    const avant = gardes.at(-1);
    const apres = blocs[i + 1];
    if (avant && avant.montre === b.montre) fondre(avant, b);
    else if (apres && apres.montre === b.montre) fondre(apres, b);
  });
  const moments: Moment[] = [];
  for (const b of gardes) {
    const n = Math.max(1, Math.ceil((b.finSec - b.debutSec) / DUREE_MAX_SEC - 1e-9));
    const pas = (b.finSec - b.debutSec) / n;
    for (let k = 0; k < n; k++) {
      const debutSec = k === 0 ? b.debutSec : Math.round((b.debutSec + k * pas) * 100) / 100;
      const finSec = k === n - 1 ? b.finSec : Math.round((b.debutSec + (k + 1) * pas) * 100) / 100;
      moments.push({
        id: `s-${Math.round(debutSec * 100)}-${Math.round(finSec * 100)}`,
        origine: "scene",
        debutSec,
        finSec,
        montre: b.montre,
        ...(b.texte ? { texte: b.texte } : {}),
        avecVisage: options.avecVisage,
        texteIncruste: b.texteIncruste,
        pieces: [...b.pieces],
      });
    }
  }
  return moments;
}

