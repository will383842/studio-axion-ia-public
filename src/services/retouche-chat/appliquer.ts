/**
 * APPLIQUER (lot R1) — opérations typées → nouveau plan, REVALIDÉ par `validerPlan` (même minutage, format, face caméra).
 * Ne refuse jamais : une opération impossible (scène inconnue, mot introuvable) donne une remarque et ne change rien ;
 * une scène rendue invalide est réparée ou repliée d'un niveau par le validateur (niveau 2 sans calque valide → 1).
 * Le texte lu (minutage des mots) ne change que par `modifier-script`. La version d'une scène touchée augmente de 1.
 */
import type { OperationRetouche } from "@/briques/operations";
import { CATALOGUE_BRIQUES, type IdPiece } from "@/briques/plan-scenes/catalogue";
import type { MotMinute, PlanValide } from "@/briques/plan-scenes/schema";
import { validerPlan, type CodeRemarque } from "@/briques/plan-scenes/validateur";

export interface RemarqueRetouche {
  code: CodeRemarque | "OPERATION_IGNOREE" | "MINUTAGE_A_REFAIRE";
  sceneId?: string;
  message: string;
}

export interface ResultatAppliquer {
  plan: PlanValide;
  /** Opérations réellement appliquées. */
  operations: OperationRetouche[];
  remarques: RemarqueRetouche[];
}

type CalqueBrut = { piece: IdPiece; parametres: unknown; debutMs: number; zone: string };
type SceneBrute = Record<string, unknown> & { id: string; version: number; niveau: number; piece: IdPiece; parametres: unknown; calques?: CalqueBrut[]; texte?: string; transition: Record<string, unknown>; mots: { premier: number; dernier: number } };

const exemple = (piece: IdPiece): unknown => structuredClone(CATALOGUE_BRIQUES[piece].exemple);
const MAX_CALQUES = 6;
const ZOOM_DYNAMISME = { leger: 1.15, fort: 1.35 } as const;

/** Remplace `ancien` par `nouveau` dans une chaîne (casse exacte d'abord, sinon sans tenir compte de la casse). */
function remplacer(texte: string, ancien: string, nouveau: string): string | null {
  if (texte.includes(ancien)) return texte.split(ancien).join(nouveau);
  const i = texte.toLowerCase().indexOf(ancien.toLowerCase());
  return i >= 0 ? texte.slice(0, i) + nouveau + texte.slice(i + ancien.length) : null;
}

/** Remplace dans la première chaîne trouvée sous `v` (parcours en profondeur) ; renvoie vrai si un remplacement a eu lieu. */
function remplacerDans(v: unknown, ancien: string, nouveau: string): boolean {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (typeof v[i] === "string") {
        const r = remplacer(v[i] as string, ancien, nouveau);
        if (r !== null) return ((v[i] = r), true);
      } else if (remplacerDans(v[i], ancien, nouveau)) return true;
    }
    return false;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (typeof o[k] === "string") {
        const r = remplacer(o[k] as string, ancien, nouveau);
        if (r !== null) return ((o[k] = r), true);
      } else if (remplacerDans(o[k], ancien, nouveau)) return true;
    }
  }
  return false;
}

/** Suit un chemin « a.b.2.c » ; remplace dans la chaîne au bout. */
function remplacerAuChemin(racine: Record<string, unknown>, chemin: string, ancien: string, nouveau: string): boolean {
  const morceaux = chemin.split(".");
  let parent: unknown = racine;
  for (const m of morceaux.slice(0, -1)) {
    if (!parent || typeof parent !== "object") return false;
    parent = (parent as Record<string, unknown>)[m];
  }
  const fin = morceaux.at(-1)!;
  if (!parent || typeof parent !== "object") return false;
  const cible = (parent as Record<string, unknown>)[fin];
  if (typeof cible !== "string") return remplacerDans(cible, ancien, nouveau);
  const r = remplacer(cible, ancien, nouveau);
  if (r === null) return false;
  (parent as Record<string, unknown>)[fin] = r;
  return true;
}

/** La scène passe au niveau 2 : sa pièce d'avant devient le premier calque (plein cadre). */
function enCalques(s: SceneBrute): CalqueBrut[] {
  if (s.niveau !== 2 || !s.calques?.length) {
    s.calques = [{ piece: s.piece, parametres: structuredClone(s.parametres), debutMs: 0, zone: "plein" }];
    s.niveau = 2;
  }
  return s.calques;
}

function versNiveau1SiVide(s: SceneBrute) {
  if (s.calques && s.calques.length === 0) {
    delete s.calques;
    s.niveau = 1;
  }
}

function titreZoom(s: SceneBrute): string {
  const t = (s.texte ?? "").trim() || "Axion IA";
  return t.slice(0, 40);
}

export function appliquerOperations(plan: PlanValide, operations: readonly OperationRetouche[]): ResultatAppliquer {
  const brut = structuredClone(plan) as unknown as { habillage: Record<string, unknown>; mots: MotMinute[]; scenes: SceneBrute[] } & Record<string, unknown>;
  for (const s of brut.scenes) delete s.empreinte;
  const remarques: RemarqueRetouche[] = [];
  const appliquees: OperationRetouche[] = [];
  const touchees = new Set<string>();
  const ignorer = (message: string, sceneId?: string) => remarques.push({ code: "OPERATION_IGNOREE", message, ...(sceneId ? { sceneId } : {}) });
  const scene = (id: string): SceneBrute | undefined => brut.scenes.find((s) => s.id === id);

  for (const op of operations) {
    const ok = (ids: string[]) => {
      ids.forEach((i) => touchees.add(i));
      appliquees.push(op);
    };
    switch (op.type) {
      case "modifier-script": {
        const cherche = op.ancien.split(/\s+/).filter(Boolean);
        const mots = brut.mots;
        let trouve = -1;
        for (let i = 0; i + cherche.length <= mots.length && trouve < 0; i++) {
          if (cherche.every((c, j) => mots[i + j]!.texte.toLowerCase().replace(/[.,;:!?]+$/, "") === c.toLowerCase().replace(/[.,;:!?]+$/, ""))) trouve = i;
        }
        if (trouve < 0) {
          ignorer(`« ${op.ancien} » n'est pas dans le script : rien n'a changé.`);
          break;
        }
        const nouveaux = op.nouveau.split(/\s+/).filter(Boolean);
        const ponctuation = /[.,;:!?]+$/.exec(mots[trouve + cherche.length - 1]!.texte)?.[0] ?? "";
        if (nouveaux.length === cherche.length) nouveaux.forEach((n, j) => (mots[trouve + j]!.texte = j === nouveaux.length - 1 ? n.replace(/[.,;:!?]+$/, "") + ponctuation : n));
        else {
          cherche.forEach((_c, j) => (mots[trouve + j]!.texte = j === 0 ? op.nouveau + ponctuation : ""));
          remarques.push({ code: "MINUTAGE_A_REFAIRE", message: "Le nombre de mots change : le minutage sera refait avec la voix." });
        }
        ok([]);
        break;
      }
      case "changer-habillage": {
        let fait = false;
        if (op.habillage) {
          brut.habillage = { ...brut.habillage, ...op.habillage };
          fait = true;
        }
        const ids: string[] = [];
        if (op.transition) {
          const s = scene(op.transition.sceneId);
          if (s) {
            s.transition = { ...s.transition, ...(op.transition.entree ? { entree: op.transition.entree } : {}), ...(op.transition.sortie ? { sortie: op.transition.sortie } : {}), ...(op.transition.dureeMs ? { dureeMs: op.transition.dureeMs } : {}) };
            ids.push(s.id);
          } else ignorer(`Scène « ${op.transition.sceneId} » introuvable.`, op.transition.sceneId);
        }
        if (op.position) {
          const s = scene(op.position.sceneId);
          if (s) {
            s.position = op.position.position;
            ids.push(s.id);
          } else ignorer(`Scène « ${op.position.sceneId} » introuvable.`, op.position.sceneId);
        }
        if (fait || ids.length) ok(ids);
        break;
      }
      case "changer-transition": {
        const cibles = op.sceneId ? [scene(op.sceneId)].filter((s): s is SceneBrute => !!s) : brut.scenes;
        if (!cibles.length) {
          ignorer(`Scène « ${op.sceneId} » introuvable.`, op.sceneId);
          break;
        }
        for (const s of cibles) s.transition = { ...s.transition, ...(op.entree ? { entree: op.entree } : {}), ...(op.sortie ? { sortie: op.sortie } : {}), ...(op.dureeMs ? { dureeMs: op.dureeMs } : {}) };
        ok(cibles.map((s) => s.id));
        break;
      }
      case "ajouter-dynamisme": {
        const cibles = op.sceneIds?.length ? op.sceneIds.map(scene).filter((s): s is SceneBrute => !!s) : brut.scenes;
        if (!cibles.length) {
          ignorer("Aucune des scènes visées n'existe.");
          break;
        }
        for (const s of cibles) {
          const zoom = s.calques?.find((c) => c.piece === "zoom-camera");
          if (zoom) {
            const p = zoom.parametres as { facteur?: number };
            p.facteur = Math.min(2.5, Math.round(((p.facteur ?? 1) + (op.intensite === "fort" ? 0.25 : 0.1)) * 100) / 100);
          } else if (s.piece === "zoom-camera" && s.niveau === 1) {
            const p = s.parametres as { facteur?: number };
            p.facteur = Math.min(2.5, Math.round(((p.facteur ?? 1) + 0.15) * 100) / 100);
          } else {
            const calques = enCalques(s);
            if (calques.length >= MAX_CALQUES) {
              ignorer("Scène déjà pleine (6 calques) : pas de zoom ajouté.", s.id);
              continue;
            }
            calques.unshift({ piece: "zoom-camera", parametres: { cible: { x: 50, y: 45 }, facteur: ZOOM_DYNAMISME[op.intensite], moment: 0.2, titreFenetre: titreZoom(s) }, debutMs: 0, zone: "plein" });
          }
          s.transition = { ...s.transition, entree: op.intensite === "fort" ? "glisse-haut" : "zoom-doux" };
        }
        ok(cibles.map((s) => s.id));
        break;
      }
      default: {
        const s = scene(op.sceneId);
        if (!s) {
          ignorer(`Scène « ${op.sceneId} » introuvable : rien n'a changé.`, op.sceneId);
          break;
        }
        if (appliquerSurScene(s, op, (m) => ignorer(m, s.id), brut.mots)) ok([s.id]);
      }
    }
  }

  for (const s of brut.scenes) if (touchees.has(s.id)) s.version = (s.version ?? 1) + 1;
  const v = validerPlan(brut, { mots: brut.mots, format: plan.format, facecam: plan.facecam, dureeMs: plan.dureeMs });
  return { plan: v.plan, operations: appliquees, remarques: [...remarques, ...v.remarques] };
}

type OperationScene = Exclude<OperationRetouche, { type: "modifier-script" | "changer-habillage" | "changer-transition" | "ajouter-dynamisme" }>;

function appliquerSurScene(s: SceneBrute, op: OperationScene, ignorer: (m: string) => void, mots: readonly MotMinute[]): boolean {
  switch (op.type) {
    case "changer-mot": {
      const fait = op.champ ? remplacerAuChemin(s, op.champ, op.ancien, op.nouveau) : (typeof s.texte === "string" && remplacerAuChemin(s, "texte", op.ancien, op.nouveau)) || remplacerDans(s.parametres, op.ancien, op.nouveau) || remplacerDans(s.calques, op.ancien, op.nouveau);
      if (!fait) ignorer(`« ${op.ancien} » n'est pas à l'écran dans cette scène : rien n'a changé.`);
      return fait;
    }
    case "ajouter-chiffre": {
      const calques = enCalques(s);
      if (calques.length >= MAX_CALQUES) return (ignorer("Scène déjà pleine (6 calques)."), false);
      calques.push({ piece: "carte-kpi", parametres: { libelle: op.libelle, valeur: op.valeur, prefixe: op.prefixe ?? "", suffixe: op.suffixe ?? "", decimales: Number.isInteger(op.valeur) ? 0 : 1, tendance: "hausse", variation: "" }, debutMs: 0, zone: op.zone ?? "droite" });
      return true;
    }
    case "changer-brique":
      s.piece = op.piece;
      s.parametres = op.parametres ?? exemple(op.piece);
      s.niveau = 1;
      delete s.calques;
      return true;
    case "decaler-scene": {
      if (op.mots) s.mots = { premier: op.mots.premier, dernier: Math.max(op.mots.premier, op.mots.dernier) };
      else if (op.decalageMs && mots.length) {
        // Le mot le plus proche du nouveau début ; même nombre de mots couverts (le validateur borne et recale).
        const debut = Number(s.debutMs) + op.decalageMs;
        let premier = 0;
        mots.forEach((m, i) => {
          if (Math.abs(m.debutMs - debut) < Math.abs(mots[premier]!.debutMs - debut)) premier = i;
        });
        if (premier === s.mots.premier) return (ignorer("Décalage trop petit : la scène commence déjà sur ce mot."), false);
        s.mots = { premier, dernier: Math.min(mots.length - 1, premier + (s.mots.dernier - s.mots.premier)) };
      } else return (ignorer("Aucun décalage donné."), false);
      return true;
    }
    case "ajouter-piece": {
      const calques = enCalques(s);
      if (calques.length >= MAX_CALQUES) return (ignorer("Scène déjà pleine (6 calques)."), false);
      calques.push({ piece: op.piece, parametres: op.parametres ?? exemple(op.piece), debutMs: op.debutMs ?? 0, zone: op.zone ?? "plein" });
      return true;
    }
    case "retirer-piece": {
      if (!s.calques?.some((c) => c.piece === op.piece)) return (ignorer(s.piece === op.piece ? "C'est la pièce principale de la scène : remplacez-la plutôt." : "Cette pièce n'est pas dans la scène."), false);
      s.calques = s.calques.filter((c) => c.piece !== op.piece);
      versNiveau1SiVide(s);
      return true;
    }
    case "remplacer-piece": {
      let fait = false;
      if (s.piece === op.ancienne) {
        s.piece = op.nouvelle;
        s.parametres = op.parametres ?? exemple(op.nouvelle);
        fait = true;
      }
      for (const c of s.calques ?? [])
        if (c.piece === op.ancienne) {
          c.piece = op.nouvelle;
          c.parametres = op.parametres ?? exemple(op.nouvelle);
          fait = true;
        }
      if (!fait) ignorer("Cette pièce n'est pas dans la scène.");
      return fait;
    }
    case "ajuster-zoom": {
      const reglages = { ...(op.facteur !== undefined ? { facteur: op.facteur } : {}), ...(op.cible ? { cible: op.cible } : {}), ...(op.moment !== undefined ? { moment: op.moment } : {}) };
      const zoom = s.calques?.find((c) => c.piece === "zoom-camera");
      if (zoom) zoom.parametres = { ...(zoom.parametres as object), ...reglages };
      else if (s.piece === "zoom-camera" && s.niveau === 1) s.parametres = { ...(s.parametres as object), ...reglages };
      else {
        const calques = enCalques(s);
        if (calques.length >= MAX_CALQUES) return (ignorer("Scène déjà pleine (6 calques)."), false);
        calques.unshift({ piece: "zoom-camera", parametres: { cible: { x: 50, y: 45 }, facteur: 1.15, moment: 0.2, titreFenetre: titreZoom(s), ...reglages }, debutMs: 0, zone: "plein" });
      }
      return true;
    }
  }
}
