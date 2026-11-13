/**
 * Validation des textes PAR MOT et PAR RÉSEAU. Module PUR : il n'importe que le dictionnaire, le contrat des cibles et node:crypto.
 * Les textes sont rendus avec le mot, le titre de la cible et un lien factice « [LIEN] » : la validation porte sur la forme exacte du texte.
 * Seules les versions au statut « actif » comptent : un texte retiré ne part plus, il ne change donc pas l'empreinte.
 * GUIDE garde sa validation actuelle (empreinte-guide.ts) : ce module le refuse.
 */
import { createHash } from "node:crypto";
import {
  cibleDuMot,
  type ElementCatalogue,
  type LiaisonMot,
  type TypeElement,
} from "./cibles-contrat";
import { normaliserMot } from "./mot-normalise";
import {
  GROUPES_MP,
  rendreTexteMp,
  TEXTES_MP,
  type GroupeMp,
  type IdTexteMp,
} from "./textes-mp";

/** Réseaux où le parcours répond tout seul. LinkedIn, TikTok : réponse à la main seulement. */
export type ReseauAuto = "facebook" | "instagram";
export const RESEAUX_AUTO: readonly ReseauAuto[] = ["facebook", "instagram"];

/** Mot du parcours d'origine : sa validation reste celle de empreinte-guide.ts. */
export const MOT_GUIDE = "GUIDE";

const GROUPES_COMMUNS: readonly GroupeMp[] = [
  "m1-lien",
  "m1-adresse",
  "deja-envoye",
  "lien-rappel",
  "recu",
  "adresse-non-reconnue",
  "adresse-refusee",
  "pub-commentaire",
];

/** Groupes de formulations rendus pour un mot, par réseau (relevés dans le parcours : M1, renvoi, reçu, adresse, publication ; Instagram ajoute le suivi du compte). */
export const GROUPES_PAR_RESEAU: Record<ReseauAuto, GroupeMp[]> = {
  facebook: [...GROUPES_COMMUNS],
  instagram: [...GROUPES_COMMUNS, "ig-suivre", "ig-pas-encore"],
};

/** Textes à identifiant fixe, hors groupes (ceux au statut actif seulement). */
export const IDS_FIXES_MOT: readonly IdTexteMp[] = [
  "mp-pub-igfb-v1",
  "mp-m1-v2",
  "mp-m2-v1",
  "mp-recu-v2",
  "mp-merci-v1",
];

export interface TexteDuMot {
  groupe: string;
  version: string;
  texte: string;
}

export type RaisonTextesMot =
  | "mot_invalide"
  | "mot_guide_a_part"
  | "titre_cible_absent"
  | "texte_dictionnaire_incomplet";

export type ResultatTextesMot =
  | { ok: true; textes: TexteDuMot[] }
  | { ok: false; raison: RaisonTextesMot };

/** Les textes actifs d'un mot pour un réseau, rendus avec le titre de la cible. Un texte à trous ne passe jamais. */
export function textesDuMot(o: {
  mot: string;
  reseau: ReseauAuto;
  titre: string;
}): ResultatTextesMot {
  const mot = normaliserMot(o.mot);
  if (mot === null || mot !== o.mot)
    return { ok: false, raison: "mot_invalide" };
  if (mot === MOT_GUIDE) return { ok: false, raison: "mot_guide_a_part" };
  const titre = typeof o.titre === "string" ? o.titre.trim() : "";
  if (!titre) return { ok: false, raison: "titre_cible_absent" };
  const groupes = GROUPES_PAR_RESEAU[o.reseau];
  if (!groupes) return { ok: false, raison: "texte_dictionnaire_incomplet" };
  const valeurs = { mot, titre, lien: "[LIEN]" };
  const textes: TexteDuMot[] = [];
  const ajouter = (groupe: string, id: IdTexteMp): boolean => {
    const t = TEXTES_MP[id];
    if (!t || t.statut !== "actif") return true;
    const rendu = rendreTexteMp(id, valeurs);
    if (rendu === null) return false;
    textes.push({ groupe, version: t.version, texte: rendu });
    return true;
  };
  for (const g of groupes)
    for (const id of GROUPES_MP[g] ?? [])
      if (!ajouter(g, id))
        return { ok: false, raison: "texte_dictionnaire_incomplet" };
  for (const id of IDS_FIXES_MOT)
    if (!ajouter("fixe", id))
      return { ok: false, raison: "texte_dictionnaire_incomplet" };
  return { ok: true, textes };
}

/** Empreinte de ce que le parcours enverrait pour ce mot, ce réseau, cette cible et ce titre. */
export function empreinteMot(o: {
  mot: string;
  reseau: ReseauAuto;
  codeCible: string;
  titre: string;
}):
  | { ok: true; empreinte: string; textes: TexteDuMot[] }
  | { ok: false; raison: RaisonTextesMot } {
  const r = textesDuMot(o);
  if (!r.ok) return r;
  const contenu = JSON.stringify([
    "mot-parcours-v1",
    o.mot,
    o.reseau,
    o.codeCible,
    o.titre.trim(),
    r.textes.map((t) => [t.groupe, t.version, t.texte]),
  ]);
  return {
    ok: true,
    empreinte: createHash("sha256").update(contenu, "utf8").digest("hex"),
    textes: r.textes,
  };
}

export type CibleDuMot =
  | {
      genre: "ok";
      code: string;
      titre: string;
      type: TypeElement;
      test: boolean;
    }
  | { genre: "sans_cible" }
  | { genre: "introuvable" };

/**
 * Cible d'un mot pour un réseau : copie fidèle de `cibleDuCommentaire` (parcours), SANS repli sur `guide-ia` pour un mot autre que GUIDE.
 * Le texte validé de `guide-ia` est rendu avec le titre du serveur, jamais avec un titre du catalogue.
 * Une cible d'essai ou de type adresse est rendue avec ses indicateurs (`test`, `type`) : c'est l'appelant qui la refuse.
 */
export function resoudreCibleMot(o: {
  mot: string;
  reseau: ReseauAuto;
  liaisons: readonly LiaisonMot[];
  catalogue: readonly ElementCatalogue[];
  titreServeur: string;
}): CibleDuMot {
  const r = cibleDuMot(o.mot, o.reseau, o.liaisons, o.catalogue);
  if (r.source === null) {
    return o.mot === MOT_GUIDE
      ? {
          genre: "ok",
          code: "guide-ia",
          titre: o.titreServeur,
          type: "guide",
          test: false,
        }
      : { genre: "sans_cible" };
  }
  const el = r.element;
  if (!el || !el.actif) return { genre: "introuvable" };
  return {
    genre: "ok",
    code: el.code,
    titre: el.code === "guide-ia" ? o.titreServeur : el.titre,
    type: el.type,
    test: el.test,
  };
}
