/**
 * SEO-04 · Aide à la rédaction de la fiche de page : à partir du script de la vidéo, propose un brouillon de
 * résumé citable, de gain, de questions-réponses, de sous-titres (les « chapitres » du document SEO-01) et de
 * textes alternatifs d'images.
 * Règles :
 * - le fournisseur d'écriture est INJECTÉ (aucun appel réel ici) ;
 * - une proposition est « à relire » : elle n'est PAS enregistrée dans la fiche ; il faut un geste de validation
 *   écrit (`validationEcrite: true`) pour l'appliquer, et la fiche reste alors un brouillon (jamais publiée) ;
 * - aucune donnée de personne : le script est masqué avant l'envoi, et tout texte proposé qui en contient est refusé ;
 * - les champs que remplit le fondateur (fond, limites, auteur, sources) ne sont jamais touchés ;
 * - les mêmes contrôles que la fiche (longueurs, mots interdits, vouvoiement) s'appliquent aux textes proposés.
 * Contrôle : types et contrôleur de fiche-de-page.ts (le contrôleur dédié SEO-03 n'est pas encore fusionné).
 */
import { controlerFiche, type ContenuFiche, type Defaut, type QuestionReponse, type SousTitre } from "@/domaine/fiche-de-page";
import type { creerServiceFichesDePage } from "@/services/fiche-de-page";

type ServiceFiches = ReturnType<typeof creerServiceFichesDePage>;

export interface DemandeRedaction { script: string }

/** Ce que le fournisseur d'écriture rend : texte brut, jamais enregistré tel quel. */
export interface BrouillonFournisseur {
  resume: string;
  gain: string;
  questions: QuestionReponse[];
  sousTitres: SousTitre[];
  textesAlternatifs: string[];
}

export interface FournisseurEcriture { rediger(demande: DemandeRedaction): Promise<BrouillonFournisseur> }

export interface Proposition {
  id: string;
  idFiche: string;
  /** Toujours « à relire » : rien n'est définitif sans le geste de validation. */
  statut: "a_relire";
  contenu: BrouillonFournisseur;
  /** Défauts relevés (noms de champs seulement). Une proposition en défaut ne peut pas être validée. */
  defauts: Defaut[];
}

export type Resultat<T> = { ok: true } & T | { ok: false; erreurs: string[] };

export interface OptionsRedaction {
  fournisseur: FournisseurEcriture;
  fiches: ServiceFiches;
  /** Noms de personnes à ne jamais laisser passer (liste fournie par l'appelant, jamais écrite en dur ici). */
  nomsInterdits?: string[];
  nouvelId?: () => string;
}

const CHAMPS_PROPOSES = ["resume", "gain", "questions", "sousTitres", "images"];

const RE_EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const RE_TEL = /(?<![\d])(?:\+|00)?\d(?:[\s.\-]?\d){8,}(?![\d])/g;
const RE_PSEUDO = /(?<![\p{L}\p{N}._])@[\p{L}\p{N}_]{2,}/u;

const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Masque les coordonnées avant de confier un script au fournisseur. */
export function masquerCoordonnees(texte: string): string {
  return texte.replace(RE_EMAIL, "[masqué]").replace(RE_TEL, "[masqué]");
}

function toutesLesChaines(b: BrouillonFournisseur): string[] {
  return [
    b.resume, b.gain,
    ...b.questions.flatMap((q) => [q.question, q.reponse]),
    ...b.sousTitres.map((s) => s.texte),
    ...b.textesAlternatifs,
  ];
}

const formeOk = (b: unknown): b is BrouillonFournisseur => {
  if (typeof b !== "object" || b === null) return false;
  const o = b as Record<string, unknown>;
  const s = (v: unknown) => typeof v === "string";
  return (
    s(o.resume) && s(o.gain) &&
    Array.isArray(o.questions) && o.questions.every((q) => typeof q === "object" && q !== null && s((q as QuestionReponse).question) && s((q as QuestionReponse).reponse)) &&
    Array.isArray(o.sousTitres) && o.sousTitres.every((x) => typeof x === "object" && x !== null && s((x as SousTitre).texte) && ((x as SousTitre).niveau === 2 || (x as SousTitre).niveau === 3)) &&
    Array.isArray(o.textesAlternatifs) && o.textesAlternatifs.every(s)
  );
};

const refus = (...erreurs: string[]): { ok: false; erreurs: string[] } => ({ ok: false, erreurs });

export function creerRedactionFicheDePage(options: OptionsRedaction) {
  const { fournisseur, fiches } = options;
  const noms = (options.nomsInterdits ?? []).map(sansAccent).filter((n) => n !== "");
  let compteur = 0;
  const nouvelId = options.nouvelId ?? (() => `PROP-${++compteur}`);
  const propositions = new Map<string, { proposition: Proposition; empreinte: string; appliquee: boolean }>();

  const empreinteDe = (idFiche: string) => JSON.stringify(fiches.lire(idFiche) ?? null);

  const contientPersonne = (texte: string): boolean => {
    if (new RegExp(RE_EMAIL.source, "u").test(texte) || new RegExp(RE_TEL.source).test(texte) || RE_PSEUDO.test(texte)) return true;
    const net = sansAccent(texte);
    return noms.some((n) => net.includes(n));
  };

  function defautsDe(b: BrouillonFournisseur): Defaut[] {
    const contenu: ContenuFiche = {
      resume: b.resume,
      gain: b.gain,
      questions: b.questions,
      sousTitres: b.sousTitres,
      images: b.textesAlternatifs.map((alt) => ({ alt, decorative: false })),
    };
    const defauts = controlerFiche(contenu).filter((d) => CHAMPS_PROPOSES.includes(d.champ));
    if (b.textesAlternatifs.length === 0) defauts.push({ champ: "images", message: "Images : au moins un texte alternatif attendu." });
    return defauts;
  }

  return {
    /** Propose un brouillon à relire. N'écrit rien dans la fiche. */
    async proposer(idFiche: string, demande: DemandeRedaction): Promise<Resultat<{ proposition: Proposition }>> {
      if (!fiches.lire(idFiche)) return refus("Fiche introuvable.");
      if (typeof demande?.script !== "string" || demande.script.trim() === "") return refus("Script vide : rien à rédiger.");
      let brut: unknown;
      try {
        brut = await fournisseur.rediger({ script: masquerCoordonnees(demande.script) });
      } catch {
        return refus("Le fournisseur d'écriture n'a pas répondu : aucune proposition.");
      }
      if (!formeOk(brut)) return refus("La réponse du fournisseur n'a pas la forme attendue : aucune proposition.");
      const contenu = structuredClone(brut);
      if (toutesLesChaines(contenu).some(contientPersonne)) return refus("Le texte proposé contenait une donnée de personne : il est écarté.");
      const proposition: Proposition = { id: nouvelId(), idFiche, statut: "a_relire", contenu, defauts: defautsDe(contenu) };
      propositions.set(proposition.id, { proposition, empreinte: empreinteDe(idFiche), appliquee: false });
      return { ok: true, proposition: structuredClone(proposition) };
    },

    lireProposition(id: string): Proposition | undefined {
      const p = propositions.get(id);
      return p ? structuredClone(p.proposition) : undefined;
    },

    /** Geste de validation : applique la proposition à la fiche, qui reste un BROUILLON (rien n'est publié). */
    valider(id: string, geste: { validationEcrite: boolean }): Resultat<object> {
      const p = propositions.get(id);
      if (!p) return refus("Proposition introuvable.");
      if (geste?.validationEcrite !== true) return refus("Rien n'est enregistré sans validation écrite du fondateur.");
      if (p.appliquee) return refus("Cette proposition a déjà été appliquée.");
      if (p.proposition.defauts.length > 0) return refus("La proposition a des défauts à corriger : elle ne peut pas être validée.");
      if (empreinteDe(p.proposition.idFiche) !== p.empreinte) return refus("La fiche a changé depuis la proposition : demandez-en une nouvelle.");
      const c = p.proposition.contenu;
      const r = fiches.modifier(p.proposition.idFiche, {
        resume: c.resume,
        gain: c.gain,
        questions: c.questions,
        sousTitres: c.sousTitres,
        images: c.textesAlternatifs.map((alt) => ({ alt, decorative: false })),
      });
      if (!r.ok) return refus(...r.erreurs);
      p.appliquee = true;
      return { ok: true };
    },
  };
}
