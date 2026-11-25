/**
 * REFAIRE PARTIES (S-11-a-v21m) — « refaire une seule partie » : pièce commune PURE, sans importeur (éteinte, 0 €).
 * Enchaîne, en UN SEUL tour : scènes touchées → plages d'images à refaire (`plagesARerendre`) → rendu muet de chaque plage →
 * recollage avec le fichier d'avant (`planRecollage` puis `demandesRecollage`, forme de l'opération de recollage par plages) →
 * second regard limité aux plages refaites.
 *
 * Tout ce qui agit est INJECTÉ (ports) : la pièce n'importe ni moteur, ni service, ni `montage-*`. Aucun port de voix : la voix
 * d'avant est seulement NOMMÉE dans le recollage (jamais rejouée). Jamais un mot changé : le plan refait est comparé au plan
 * d'avant (mots dits et textes à l'écran) AVANT tout appel. Ne lève jamais : toute panne rend la vidéo d'avant.
 * Arrêt si rien ne progresse (même défaut au second regard) : on rend la vidéo d'avant ET la liste exacte.
 */
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { demandesRecollage, ENTREE_AVANT, ENTREE_VOIX, entreePlage, planRecollage, plagesARerendre, type ParametresRecollage, type PlageImages } from "@/briques/rendu-par-plages";
import type { DefautVu } from "@/briques/regardeur/types";

export interface EntreeRefaire {
  /** Plan de la vidéo d'avant (celle de `fichierAvant`). */
  planAvant: PlanValide;
  /** Plan réparé (sans IA) dont on rend les plages. */
  planApres: PlanValide;
  /** Défauts du verdict : leurs `partieId` désignent les scènes à refaire. */
  defauts: DefautVu[];
  /** Scènes à refaire demandées directement (chat) ; s'ajoutent aux défauts. */
  scenesTouchees?: string[];
  fichierAvant: string;
  /** Voix d'avant : seulement nommée au recollage. */
  voixAvant?: string;
  dureeTotaleImages: number;
  transitionMaxMs: number;
  imagesCle?: number[];
}

export interface PlageRendue {
  /** Fichier du morceau muet ; le recollage le nomme toujours `plage-<index>`. */
  fichier: string;
}

export interface PortsRefaire {
  /** Rend UNE plage, muette. `null` : rendu impossible. */
  rendrePlage(plage: PlageImages, index: number): Promise<PlageRendue | null>;
  /** Recolle (opération de recollage par plages). `entrees` : nom d'entrée → fichier du morceau. `null` : recollage refusé. */
  recoller(parametres: ParametresRecollage, entrees: Record<string, string>): Promise<{ fichier: string } | null>;
  /** Second regard, limité aux plages refaites. `null` : regard indisponible. */
  regarder(e: { fichier: string; plages: PlageImages[]; scenes: string[] }): Promise<{ defauts: DefautVu[] } | null>;
}

export type EtatRefaire = "rien" | "entier" | "mot-change" | "echec" | "sans-progres" | "refaite";

export interface ResultatRefaire {
  etat: EtatRefaire;
  /** La vidéo à garder : la refaite seulement pour l'état `refaite`, sinon celle d'avant. */
  fichier: string;
  /** Défauts restants (liste exacte rendue à l'appelant). */
  reste: DefautVu[];
  plages: PlageImages[];
  /** Le second regard a eu lieu. */
  relue: boolean;
  /** Français, sans sigle. */
  motif?: string;
}

const identiques = <T>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Mots dits et textes à l'écran : rien ne doit changer entre le plan d'avant et le plan refait. */
function motsChanges(avant: PlanValide, apres: PlanValide): boolean {
  if (!identiques(avant.mots, apres.mots)) return true;
  const texteDe = (p: PlanValide) => new Map(p.scenes.map((s) => [s.id, s.texte ?? null]));
  const ta = texteDe(avant);
  for (const [id, t] of texteDe(apres)) if (ta.has(id) && ta.get(id) !== t) return true;
  return false;
}

const memeDefaut = (a: DefautVu, b: DefautVu) => a.code === b.code && a.partieId === b.partieId;

export async function refaireParties(e: EntreeRefaire, ports: PortsRefaire): Promise<ResultatRefaire> {
  const garder = (etat: EtatRefaire, motif: string, reste: DefautVu[] = [], plages: PlageImages[] = [], relue = false): ResultatRefaire => ({ etat, fichier: e.fichierAvant, reste, plages, relue, motif });
  try {
    const touchees = [...new Set([...(e.scenesTouchees ?? []), ...e.defauts.map((d) => d.partieId).filter((id): id is string => !!id)])];
    const connues = new Set(e.planApres.scenes.map((s) => s.id));
    const scenes = touchees.filter((id) => connues.has(id));
    if (scenes.length === 0) return garder("rien", "Aucune partie à refaire : la vidéo d'avant est gardée.");

    if (motsChanges(e.planAvant, e.planApres)) return garder("mot-change", "Un mot ou un texte écrit aurait changé : rien n'est refait, la vidéo d'avant est gardée.", e.defauts);

    const decision = plagesARerendre(e.planApres, scenes, { fps: 25, dureeTotaleImages: e.dureeTotaleImages, transitionMaxMs: e.transitionMaxMs, ...(e.imagesCle ? { imagesCle: e.imagesCle } : {}) });
    if (decision.mode === "aucun") return garder("rien", "Aucune partie à refaire : la vidéo d'avant est gardée.");
    if (decision.mode === "entier") return garder("entier", "Trop de parties à refaire : mieux vaut refaire la vidéo entière (rendu entier).", e.defauts);

    const entrees: Record<string, string> = { [ENTREE_AVANT]: e.fichierAvant, ...(e.voixAvant ? { [ENTREE_VOIX]: e.voixAvant } : {}) };
    for (const [index] of decision.plages.entries()) {
      const rendu = await ports.rendrePlage(decision.plages[index]!, index);
      if (!rendu) return garder("echec", "Une partie n'a pas pu être refaite : la vidéo d'avant est gardée.", e.defauts, decision.plages);
      entrees[entreePlage(index)] = rendu.fichier;
    }

    const plan = planRecollage({ plages: decision.plages, dureeTotaleImages: e.dureeTotaleImages, fichierAvant: ENTREE_AVANT, ...(e.voixAvant ? { voixAvant: e.voixAvant } : {}) });
    const parametres = demandesRecollage(plan, { fps: 25, dureeTotaleImages: e.dureeTotaleImages });
    const recolle = await ports.recoller(parametres, entrees);
    if (!recolle) return garder("echec", "Le recollage a été refusé : la vidéo d'avant est gardée.", e.defauts, decision.plages);

    let regard: { defauts: DefautVu[] } | null = null;
    try {
      regard = await ports.regarder({ fichier: recolle.fichier, plages: decision.plages, scenes });
    } catch {
      regard = null;
    }
    if (!regard) return { etat: "refaite", fichier: recolle.fichier, reste: [], plages: decision.plages, relue: false, motif: "La partie est refaite mais n'a pas pu être relue." };
    if (e.defauts.some((avant) => regard.defauts.some((apres) => memeDefaut(avant, apres)))) {
      return garder("sans-progres", "Le même défaut demeure après la reprise : la vidéo d'avant est gardée, avec la liste exacte.", regard.defauts, decision.plages, true);
    }
    return { etat: "refaite", fichier: recolle.fichier, reste: regard.defauts, plages: decision.plages, relue: true };
  } catch {
    return garder("echec", "La reprise a échoué : la vidéo d'avant est gardée.", e.defauts);
  }
}
