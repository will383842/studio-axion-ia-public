/**
 * IMAGE → VIDÉO · R1 · Normalisation de la carte brute, AVANT le contrôle du schéma strict. PUR (aucun accès serveur).
 *
 * Décision de Will : si une image a des incohérences, le système les RÉPARE seul et génère la vidéo sans blocage ; seule
 * une image vraiment illisible ou trop chargée garde un refus, avec un message qui dit quoi faire. Chaque réparation est
 * écrite (`Adaptation` : code, avant, après, raison) et sort en phrase « Adapté automatiquement : … » pour Will.
 *
 * Ce module ne réécrit JAMAIS un chiffre ni ne rajoute un texte : il retire, rogne, coupe ou remet au bon format ce qui
 * dépasse les limites du schéma (`carte.ts`).
 */
import type { CarteImage, GroupeCarte, LienCarte, NoeudCarte } from "./carte";

export interface Adaptation {
  code: string;
  avant: string;
  apres: string;
  raison: string;
}

export const PREFIXE_ADAPTATION = "Adapté automatiquement : ";

/** Phrase pour Will (≤ 300 caractères, limite du schéma). */
export function phraseAdaptation(a: Adaptation): string {
  const p = `${PREFIXE_ADAPTATION}${a.raison}`;
  return p.length <= 300 ? p : `${p.slice(0, 299).trimEnd()}…`;
}

export const LIMITES_CARTE = { noeuds: 40, liens: 60, groupes: 20, chiffres: 80, sousElements: 12, bandeau: 6, pied: 10, calculs: 20, formules: 40, texte: 300, icone: 40 } as const;

/** Ce que la normalisation lit et rend (un brouillon de carte, avec ou sans l'image). */
type Normalisable = Pick<CarteImage, "titre" | "phraseChoc" | "noeuds" | "liens" | "groupes" | "bandeau" | "pied"> & { sousTitre?: string; signature?: string };

export interface RefusTropChargee {
  /** « blocs », « flèches », « groupes » ou « chiffres ». */
  quoi: "blocs" | "flèches" | "groupes" | "chiffres";
  n: number;
  max: number;
  message: string;
}

/** Refus propre : une image au-delà des limites ne se répare pas, elle se découpe. */
export function refusTropChargee(quoi: RefusTropChargee["quoi"], n: number, max: number): RefusTropChargee {
  return { quoi, n, max, message: `Image trop chargée (${n} ${quoi}, ${max} au plus) : découpez-la en deux images.` };
}

/** Texte rogné ; coupé au mot s'il dépasse 300 caractères. */
function couper(s: string, max = LIMITES_CARTE.texte): string {
  if (s.length <= max) return s;
  const brut = s.slice(0, max);
  const dernierBlanc = brut.lastIndexOf(" ");
  // Coupe au mot, sauf si le seul mot est plus long que la limite (coupe franche).
  return (dernierBlanc > 0 ? brut.slice(0, dernierBlanc) : brut).trimEnd();
}

/** Identifiant valide (minuscules, chiffres, tirets, 40 au plus) tiré d'un nom, ou chaîne vide. */
export function identifiantDe(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
const ID_VALIDE = /^[a-z0-9][a-z0-9-]{0,39}$/;

const court = (s: unknown) => {
  const t = String(s ?? "");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

export function normaliserCarteBrute<T extends Normalisable>(carteProposee: T): { carte: T; adaptations: Adaptation[]; tropChargee?: RefusTropChargee } {
  const adaptations: Adaptation[] = [];
  const noter = (code: string, avant: unknown, apres: unknown, raison: string) => adaptations.push({ code, avant: court(avant), apres: court(apres), raison });
  const c = structuredClone(carteProposee) as Normalisable & Record<string, unknown>;

  /** Rogne ; coupe au mot au-delà de 300 caractères (adaptation notée). `ou` : où le texte est écrit. */
  const texte = (s: string | undefined, ou: string): string => {
    const t = (s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
    if (t.length <= LIMITES_CARTE.texte) return t;
    const r = couper(t);
    noter("texte-coupe", t, r, `texte de ${ou} coupé au mot (${t.length} caractères, ${LIMITES_CARTE.texte} au plus)`);
    return r;
  };
  const optionnel = <K extends "sousTitre" | "signature">(k: K) => {
    const t = texte(c[k], k === "sousTitre" ? "le sous-titre" : "la signature");
    if (t) c[k] = t;
    else delete c[k];
  };

  c.titre = texte(c.titre, "le titre");
  c.phraseChoc = texte(c.phraseChoc, "la phrase du bas");
  optionnel("sousTitre");
  optionnel("signature");

  // ─── Blocs ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  const retires = new Set<string>();
  const noeuds: NoeudCarte[] = [];
  for (const n0 of c.noeuds) {
    const n = { ...n0 } as NoeudCarte;
    n.libelle = texte(n.libelle, `le bloc ${n.id}`);
    const detail = texte(n.detail, `le détail du bloc ${n.id}`);
    if (detail) n.detail = detail;
    else delete n.detail;
    if (!n.libelle) {
      if (n.detail) {
        noter("libelle-vide", "", n.detail, `libellé du bloc ${n.id} vide : repris du détail`);
        n.libelle = n.detail;
        delete n.detail;
      } else {
        retires.add(n.id);
        noter("bloc-retire", n.id, "", `bloc retiré (${n.id}) : ni libellé ni détail lisible`);
        continue;
      }
    }
    if (n.icone !== undefined) {
      const icone = String(n.icone).trim();
      if (!icone) delete n.icone;
      else if (icone.length > LIMITES_CARTE.icone) {
        noter("icone-retiree", icone, "", `icône du bloc ${n.id} de plus de ${LIMITES_CARTE.icone} caractères : retirée`);
        delete n.icone;
      } else n.icone = icone;
    }
    if (!Number.isFinite(n.ordre)) n.ordre = 0;
    const ordre = Math.min(999, Math.max(0, Math.round(n.ordre)));
    if (ordre !== n.ordre) {
      noter("ordre", n.ordre, ordre, `ordre du bloc ${n.id} (${n.ordre}) ramené entre 0 et 999`);
      n.ordre = ordre;
    }
    if (n.quantite !== undefined && !(Number.isInteger(n.quantite) && n.quantite >= 1 && n.quantite <= 99)) {
      noter("quantite-retiree", n.quantite, "", `quantité du bloc ${n.id} (${n.quantite}) hors de 1 à 99 : retirée`);
      delete n.quantite;
    }
    if (n.sousElements) {
      let sous = n.sousElements.map((s, i) => texte(s, `le sous-élément ${i + 1} du bloc ${n.id}`)).filter(Boolean);
      if (sous.length > LIMITES_CARTE.sousElements) {
        noter("sous-elements-coupes", sous.length, LIMITES_CARTE.sousElements, `${sous.length} sous-éléments dans le bloc ${n.id} : les ${LIMITES_CARTE.sousElements} premiers gardés`);
        sous = sous.slice(0, LIMITES_CARTE.sousElements);
      }
      if (sous.length) n.sousElements = sous;
      else delete n.sousElements;
    }
    noeuds.push(n);
  }

  // ─── Groupes ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const idsGroupes = new Set<string>();
  const renomme = new Map<string, string>();
  const groupes: GroupeCarte[] = [];
  for (const g0 of c.groupes) {
    const g = { ...g0 } as GroupeCarte;
    const titre = texte(g.titre, `le groupe ${g.id}`);
    if (titre) g.titre = titre;
    else delete g.titre;
    g.noeuds = [...new Set(g.noeuds)].filter((i) => !retires.has(i));
    if (g.noeuds.length !== g0.noeuds.length && g0.noeuds.some((i) => retires.has(i))) {
      noter("groupe-membre-retire", g0.noeuds.length, g.noeuds.length, `groupe ${g0.id} : un bloc retiré n'en fait plus partie`);
    }
    if (!g.noeuds.length) {
      noter("groupe-vide", g0.id, "", `groupe vide retiré (${g0.id})`);
      renomme.set(g0.id, "");
      continue;
    }
    if (g.noeuds.length > 40) g.noeuds = g.noeuds.slice(0, 40);
    if (!ID_VALIDE.test(g.id)) {
      let nouveau = identifiantDe(g.id);
      for (let i = 2; nouveau && idsGroupes.has(nouveau); i++) nouveau = `${identifiantDe(g.id).slice(0, 36)}-${i}`;
      if (!nouveau) {
        noter("groupe-retire", g.id, "", `groupe « ${g.id} » retiré : son nom ne peut pas servir d'identifiant`);
        renomme.set(g0.id, "");
        continue;
      }
      noter("groupe-id", g.id, nouveau, `groupe « ${g.id} » remis au bon format (${nouveau})`);
      renomme.set(g0.id, nouveau);
      g.id = nouveau;
    }
    idsGroupes.add(g.id);
    groupes.push(g);
  }
  const groupeValide = (nom: string): string => {
    if (renomme.has(nom)) return renomme.get(nom)!;
    if (idsGroupes.has(nom)) return nom;
    const id = identifiantDe(nom);
    return id && idsGroupes.has(id) ? id : "";
  };
  for (const n of noeuds) {
    if (n.groupe === undefined) continue;
    const bon = groupeValide(n.groupe);
    if (bon === n.groupe) continue;
    if (bon) noter("groupe-id", n.groupe, bon, `groupe « ${n.groupe} » du bloc ${n.id} remis au bon format (${bon})`);
    else noter("groupe-retire", n.groupe, "", `groupe « ${n.groupe} » du bloc ${n.id} : aucun groupe de ce nom, retiré du bloc`);
    if (bon) n.groupe = bon;
    else delete n.groupe;
  }

  // ─── Flèches ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const liens: LienCarte[] = [];
  for (const l0 of c.liens) {
    if (retires.has(l0.de) || retires.has(l0.vers)) {
      noter("fleche-retiree", l0.id, "", `flèche ${l0.id} retirée : un des blocs qu'elle relie a été retiré`);
      continue;
    }
    const l = { ...l0 } as LienCarte;
    const etiquette = texte(l.etiquette, `la flèche ${l.id}`);
    if (etiquette) l.etiquette = etiquette;
    else delete l.etiquette;
    if (l.part !== undefined && !(Number.isFinite(l.part) && l.part >= 0 && l.part <= 100)) {
      noter("part-retiree", l.part, "", `part de la flèche ${l.id} (${l.part}) hors de 0 à 100 : retirée`);
      delete l.part;
    }
    liens.push(l);
  }

  // ─── Listes ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const liste = (valeurs: string[], max: number, nom: string, ou: string): string[] => {
    const v = valeurs.map((s, i) => texte(s, `${ou} ${i + 1}`)).filter(Boolean);
    if (v.length <= max) return v;
    noter("liste-coupee", v.length, max, `${v.length} éléments dans ${nom} : les ${max} premiers gardés`);
    return v.slice(0, max);
  };
  c.bandeau = liste(c.bandeau, LIMITES_CARTE.bandeau, "le bandeau", "la case du bandeau");
  c.pied = liste(c.pied, LIMITES_CARTE.pied, "le bas de l'image", "la mention du bas");

  c.noeuds = noeuds;
  c.liens = liens;
  c.groupes = groupes;

  // ─── Seul refus : trop chargée ─────────────────────────────────────────────────────────────────────────────────────
  let tropChargee: RefusTropChargee | undefined;
  if (noeuds.length > LIMITES_CARTE.noeuds) tropChargee = refusTropChargee("blocs", noeuds.length, LIMITES_CARTE.noeuds);
  else if (liens.length > LIMITES_CARTE.liens) tropChargee = refusTropChargee("flèches", liens.length, LIMITES_CARTE.liens);
  else if (groupes.length > LIMITES_CARTE.groupes) tropChargee = refusTropChargee("groupes", groupes.length, LIMITES_CARTE.groupes);

  return { carte: c as unknown as T, adaptations, ...(tropChargee ? { tropChargee } : {}) };
}
