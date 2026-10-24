/**
 * CHAMPS TIRÉS DU CAS (tâche X9). Claude DÉSIGNE, le code REMPLIT : avant la validation du schéma, la fiche lue est
 * complétée de tout ce que le studio possède déjà ou sait calculer. Claude n'a à rendre que ce qu'il est seul à pouvoir
 * écrire (le texte dit, les textes d'écran, les événements, le choix des faits et des visuels).
 *
 * Constat du premier essai réel (vidéo `v-3a71b4a4dfea`) : Claude rendait une fiche bien formée SAUF le nombre `valeur`
 * des écrans à chiffre, deux fois de suite. `valeur` est une donnée du CAS : l'écran porte `faitId`, R12 exige la valeur
 * du fait. La recopier était fragile et inutile.
 *
 * Classement de chaque champ obligatoire de `fiche-ecrans/1` (`CLASSEMENT_CHAMPS`) :
 *  (a) créé par Claude : laissé tel quel, refusé s'il manque ;
 *  (b) recopié du cas ou de la commande : toujours posé par le code ; une valeur différente rendue par Claude est
 *      remplacée, et l'écart noté (`notes`, gardées au journal de l'étape) ;
 *  (c) calculable par le code : posé quand il manque, corrigé (et noté) quand il est faux.
 * Un `faitId` absent, inconnu ou sans nombre reste un refus (R12), renvoyé à Claude à la relance.
 *
 * PUR : la fiche reçue n'est jamais modifiée (copie).
 */
import { ETIQUETTE_POSTURE } from "@/formats/cas-concret/recette";
import { empreinteCas as empreinteDuCas, type CasConcret, type FaitCas } from "@/formats/cas-concret/cas";
import { FORMAT_CAS_CONCRET, VERSION_FICHE_ECRANS, cleMot, idEcranAttendu, type Origine } from "./fiche";
import { MARQUE, nombresDe, sansPointsDeSigle } from "./regles";

/** Le cas ne porte aucun fait chiffré : ses barres de résultat n'ont aucun fait à désigner. */
export const casSansFaitChiffre = (cas: Pick<CasConcret, "faits">): boolean => !cas.faits.some((f) => f.valeurs.length > 0);
/** Hauteurs de dessin d'une barre sans fait : jamais affichées (texteBarre rend "", la barre porte son libellé). */
export const HAUTEURS_BARRES_SANS_FAIT = { avant: 100, maintenant: 20 } as const;

/** Champs figés de la fiche, posés par le code (jamais demandés à Claude). */
export interface FicheFixe {
  videoId: string;
  versionId: string;
  /** « charte-duo/1 ». */
  habillage: string;
  origine: Origine;
}

/** Les champs de tête de la fiche, tous tirés de la commande ou du cas. */
export function ficheFixe(e: FicheFixe, cas: CasConcret) {
  return { version: VERSION_FICHE_ECRANS as typeof VERSION_FICHE_ECRANS, formatId: FORMAT_CAS_CONCRET as typeof FORMAT_CAS_CONCRET, videoId: e.videoId, versionId: e.versionId, habillage: e.habillage, ratio: "9:16" as const, offre: cas.offre, origine: e.origine, posture: cas.posture, casId: cas.id, empreinteCas: empreinteDuCas(cas) };
}

/* ------------------------------------------------------------------ */
/* Classement (point 4 de X9)                                            */
/* ------------------------------------------------------------------ */

export type SorteChamp = "claude" | "cas" | "calcul";

/**
 * Chaque champ obligatoire de la fiche, et qui le donne. `cas` et `calcul` sont remplis par `completerFiche` ; seuls les
 * champs `claude` sont demandés par la consigne. Les champs facultatifs (`eclair`, `total`, `orange`, `ligne` d'un objet,
 * `textes`, `departPage`) restent des choix de Claude ; `debutMs` et `finMs` sont posés par le calage.
 */
export const CLASSEMENT_CHAMPS: Readonly<Record<string, Readonly<Record<string, SorteChamp>>>> = Object.freeze({
  fiche: { version: "calcul", formatId: "calcul", ratio: "calcul", videoId: "cas", versionId: "cas", habillage: "cas", offre: "cas", origine: "cas", posture: "cas", casId: "cas", empreinteCas: "cas", ecrans: "claude" },
  ecran: { id: "calcul", type: "claude", fond: "claude", marque: "cas", texteDit: "claude", avanceMs: "calcul", evenements: "claude" },
  evenement: { cible: "claude", surMot: "claude", avanceMs: "calcul" },
  accroche: { etiquette: "cas", lignes: "claude", motOrange: "claude" },
  chiffre: { faitId: "claude", valeur: "cas", unite: "cas", pastilles: "calcul", variante: "claude" },
  "liste-avant": { taches: "claude" },
  titre: { lignes: "claude" },
  etape: { numero: "calcul", total: "calcul", titre: "claude", ligne: "claude", visuel: "claude", puces: "calcul" },
  "visuel-ecran": { sorte: "claude", etapeCas: "claude", repli: "cas" },
  "visuel-objet": { sorte: "claude", objet: "claude" },
  objet: { titre: "claude", visuel: "claude" },
  preuve: { titre: "claude", puces: "claude" },
  resultat: { titre: "claude", avant: "claude", maintenant: "claude", ligne: "claude" },
  barre: { libelle: "claude", faitId: "claude", valeur: "cas" },
  question: { lignes: "claude", question: "claude" },
});

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const montre = (v: unknown) => JSON.stringify(v) ?? "rien";
const nombreFr = (n: number) => String(n).replace(".", ",");

/** Mots qui ne sont jamais une unité (« 100 est calculée » : « est » n'est pas l'unité de 100). */
const MOTS_NON_UNITE: ReadonlySet<string> = new Set(["est", "sont", "a", "ont", "et", "ou", "de", "du", "des", "le", "la", "les", "un", "une", "par", "pour", "en", "au", "aux", "qui", "que", "se", "il", "elle"]);
/** Liaisons d'un fait à deux valeurs (« 75 sur 100 », « 900 à 1300 mots ») : l'unité porte la seconde valeur. */
const LIAISONS_DEUX_VALEURS: ReadonlySet<string> = new Set(["sur", "à"]);
const sansPonctuation = (m: string) => m.replace(/[^\p{L}\p{N}%]+$/u, "").replace(/^[^\p{L}\p{N}%]+/u, "");

/**
 * Unité d'un fait : le mot qui suit la valeur dans l'énoncé (« 15 minutes » → « minutes ») ; `valeur` : laquelle.
 * Un fait à deux valeurs liées (« Sous 75 sur 100 », « 900 à 1300 mots ») : l'unité porte la seconde valeur (« sur 100 »,
 * « à 1300 mots ») ; jamais la liaison seule (« 75 SUR. », vidéo v-275dc041c303). Un mot outil (« est ») n'est pas une unité.
 */
export function uniteDuFait(f: FaitCas, valeur?: number): { valeur: number; unite: string } | undefined {
  const ms = f.enonce.split(/\s+/);
  for (let i = 0; i < ms.length - 1; i++) {
    const seul = nombresDe(ms[i]);
    const couple = nombresDe(`${ms[i]} ${ms[i + 1]}`);
    const v = seul.length === 1 ? seul[0] : couple.length === 1 ? couple[0] : undefined;
    if (v === undefined || !f.valeurs.includes(v) || (valeur !== undefined && v !== valeur)) continue;
    const unite = sansPonctuation(ms[i + 1]).replace(/^[^\p{L}%]+/u, "");
    if (!unite || unite.length > 20 || !/^[\p{Ll}%]/u.test(unite)) continue;
    // « 75 sur 100 » : la liaison, puis la seconde valeur du fait, puis son unité quand elle suit sans ponctuation.
    if (LIAISONS_DEUX_VALEURS.has(unite) && /^\p{Ll}+$/u.test(ms[i + 1])) {
      const second = nombresDe(ms[i + 2] ?? "");
      if (second.length === 1 && f.valeurs.includes(second[0]) && second[0] !== v) {
        const suite = /^[\p{N}]+$/u.test(ms[i + 2]) && ms[i + 3] ? sansPonctuation(ms[i + 3]) : "";
        const avecSuite = suite && /^\p{Ll}+$/u.test(suite) && !MOTS_NON_UNITE.has(suite) ? `${unite} ${sansPonctuation(ms[i + 2])} ${suite}` : "";
        const lie = avecSuite && avecSuite.length <= 20 ? avecSuite : `${unite} ${sansPonctuation(ms[i + 2])}`;
        if (lie.length <= 20) return { valeur: v, unite: lie };
      }
      continue;
    }
    if (MOTS_NON_UNITE.has(unite)) continue;
    return { valeur: v, unite };
  }
  return undefined;
}

/**
 * La valeur d'un fait pour un écran : celle donnée si c'est une valeur du fait ; sinon la valeur du fait que le texte
 * dit de l'écran cite (une seule) ; sinon la première.
 */
function valeurPourEcran(f: FaitCas, donnee: unknown, texteDit: unknown): number {
  if (typeof donnee === "number" && f.valeurs.includes(donnee)) return donnee;
  const dites = typeof texteDit === "string" ? new Set(nombresDe(sansPointsDeSigle(texteDit))) : new Set<number>();
  const citees = f.valeurs.filter((v) => dites.has(v));
  return citees.length === 1 ? citees[0] : f.valeurs[0];
}

/** Objets dessinés qui n'ont AUCUN contenu sans leurs textes (une fiche blanche, vidéo v-275dc041c303, étape « Le sujet »). */
export const OBJETS_A_TEXTES: ReadonlySet<string> = new Set(["liste-taches", "programme"]);
/** Longueur d'un texte d'objet (schéma de la fiche). */
const TEXTE_OBJET_MAX = 40;
const sansBalisesNiPoint = (t: string) => t.replace(/\*/g, "").replace(/[\s.!?…:;,]+$/u, "").trim();
const motsPleins = (t: string) => new Set(t.split(/[\s'’-]+/).map(cleMot).filter((m) => m.length >= 4));

/**
 * Textes d'un objet qui n'a rien à montrer sans eux (`OBJETS_A_TEXTES`), quand la fiche n'en donne pas : les tâches
 * « avant » du cas que l'écran reprend (un mot plein en commun avec son titre, sa ligne ou l'étape du cas de même rang :
 * « Le sujet » → « Trouver un sujet »), puis la ligne de l'écran ; à défaut, son titre. Trois au plus, 40 caractères chacun.
 */
export function textesParDefautDuVisuel(ecran: Record<string, unknown>, cas: CasConcret, rangEtape?: number): string[] {
  const titre = typeof ecran.titre === "string" ? sansBalisesNiPoint(ecran.titre) : "";
  const ligne = typeof ecran.ligne === "string" ? sansBalisesNiPoint(ecran.ligne) : "";
  const etapeCas = rangEtape !== undefined ? cas.etapes[rangEtape - 1] : undefined;
  const reperes = new Set([titre, ligne, etapeCas?.titre ?? "", etapeCas?.ligne ?? ""].flatMap((t) => [...motsPleins(t)]));
  const taches = cas.avant.taches.filter((t) => [...motsPleins(t)].some((m) => reperes.has(m)));
  const res: string[] = [];
  for (const t of [...taches, ligne].map(sansBalisesNiPoint)) {
    if (!t || t.length > TEXTE_OBJET_MAX || res.some((x) => cleMot(x) === cleMot(t))) continue;
    res.push(t);
    if (res.length === 3) break;
  }
  return res.length ? res : [titre.slice(0, TEXTE_OBJET_MAX).trim() || "Fait tout seul"];
}

export interface CompletionFiche {
  /** La fiche complétée (copie), à valider. */
  brute: unknown;
  /** Écarts corrigés : une valeur rendue par Claude remplacée par celle du cas ou du calcul (gardés au journal). */
  notes: string[];
  /** Refus de la passe (fait absent, inconnu ou sans nombre), en français, renvoyés à Claude à la relance. */
  refus: string[];
  /** Écrans refusés par la passe : leur « valeur » absente n'est pas reprochée une seconde fois par le schéma. */
  ecransRefuses: string[];
}

const REGLE_FAITS = "nombres des faits";

/**
 * Complète une fiche lue avec les champs tirés du cas (b) et calculés (c) ; voir l'en-tête. Ne touche ni au texte, ni aux
 * choix de Claude. Une fiche qui n'est pas un objet est rendue telle quelle (le schéma la refuse).
 */
export function completerFiche(lue: unknown, e: FicheFixe & { cas: CasConcret }): CompletionFiche {
  const notes: string[] = [];
  const refus: string[] = [];
  const ecransRefuses = new Set<string>();
  if (!estObjet(lue)) return { brute: lue, notes, refus, ecransRefuses: [] };
  const cas = e.cas;
  const fiche: Record<string, unknown> = structuredClone(lue);

  /** Pose un champ ; une valeur différente déjà là est notée. */
  const poser = (o: Record<string, unknown>, cle: string, valeur: unknown, ou: string) => {
    if (o[cle] !== undefined && o[cle] !== valeur) notes.push(`${ou} : « ${cle} » rendu ${montre(o[cle])}, remplacé par ${montre(valeur)} (tiré du cas).`);
    o[cle] = valeur;
  };
  const defaut = (o: Record<string, unknown>, cle: string, valeur: unknown) => {
    if (o[cle] === undefined) o[cle] = valeur;
  };

  for (const [cle, valeur] of Object.entries(ficheFixe(e, cas))) poser(fiche, cle, valeur, "Fiche");

  const ecrans = Array.isArray(fiche.ecrans) ? fiche.ecrans : [];
  const etapes = ecrans.filter((x) => estObjet(x) && x.type === "etape").length;
  let rangEtape = 0;
  ecrans.forEach((x, i) => {
    if (!estObjet(x)) return;
    const id = idEcranAttendu(i);
    const ou = `Écran ${id}`;
    poser(x, "id", id, ou);
    poser(x, "marque", MARQUE, ou);
    defaut(x, "avanceMs", 0);
    defaut(x, "evenements", []);
    if (Array.isArray(x.evenements)) for (const ev of x.evenements) if (estObjet(ev)) defaut(ev, "avanceMs", 0);

    /** Un fait désigné, ou le refus qui dit pourquoi il ne l'est pas. */
    const faitDe = (faitId: unknown, quoi: string): FaitCas | undefined => {
      const refuser = (detail: string) => {
        refus.push(`${ou} · règle « ${REGLE_FAITS} » : ${quoi} ${detail}`);
        ecransRefuses.add(id);
        return undefined;
      };
      if (casSansFaitChiffre(cas)) {
        return refuser(quoi === "le chiffre"
          ? "n'a pas lieu d'être : le cas n'a aucun fait chiffré ; aucun écran « chiffre », et chaque barre du résultat en { \"libelle\" } seul, sans « faitId »."
          : "désigne un fait, mais le cas n'a aucun fait chiffré : chaque barre du résultat en { \"libelle\" } seul, sans « faitId » ; aucun écran « chiffre ».");
      }
      if (faitId === undefined) return refuser("ne désigne aucun fait : donnez « faitId », l'identifiant d'un fait chiffré de <faits>.");
      const f = cas.faits.find((y) => y.id === faitId);
      if (!f) return refuser(`désigne le fait ${montre(faitId)}, absent du cas : choisissez un identifiant de <faits>.`);
      if (!f.valeurs.length) return refuser(`désigne le fait « ${f.id} », qui ne porte aucun nombre : choisissez un fait chiffré.`);
      return f;
    };
    /** Pose la valeur du fait ; une valeur rendue qui n'est pas celle du fait est remplacée et notée. */
    const valeurDuFait = (o: Record<string, unknown>, f: FaitCas, quoi: string) => {
      const v = valeurPourEcran(f, o.valeur, x.texteDit);
      if (o.valeur !== undefined && o.valeur !== v) notes.push(`${ou} : ${quoi} rendu ${montre(o.valeur)}, remplacé par ${nombreFr(v)}, valeur du fait « ${f.id} ».`);
      o.valeur = v;
      return v;
    };

    /** Un objet vide sans ses textes (`OBJETS_A_TEXTES`) reçoit ceux tirés du cas et de l'écran ; noté. */
    const textesDuVisuel = (o: Record<string, unknown>, rang?: number) => {
      const v = o.visuel;
      if (!estObjet(v) || v.sorte !== "objet" || typeof v.objet !== "string" || !OBJETS_A_TEXTES.has(v.objet)) return;
      if (Array.isArray(v.textes) && v.textes.some((t) => typeof t === "string" && t.trim())) return;
      v.textes = textesParDefautDuVisuel(o, cas, rang);
      notes.push(`${ou} : l'objet « ${v.objet} » n'avait aucun texte (il serait resté vide) ; textes posés : ${montre(v.textes)}.`);
    };

    switch (x.type) {
      case "accroche":
        poser(x, "etiquette", ETIQUETTE_POSTURE[cas.posture], ou);
        break;
      case "chiffre": {
        defaut(x, "pastilles", []);
        const f = faitDe(x.faitId, "le chiffre");
        if (!f) break;
        const v = valeurDuFait(x, f, "« valeur »");
        if (x.unite === undefined) {
          const u = uniteDuFait(f, v);
          if (u) x.unite = u.unite;
        }
        break;
      }
      case "etape":
        rangEtape++;
        poser(x, "numero", rangEtape, ou);
        poser(x, "total", etapes, ou);
        defaut(x, "puces", []);
        textesDuVisuel(x, rangEtape);
        if (estObjet(x.visuel) && x.visuel.sorte === "ecran" && x.visuel.repli === undefined && typeof x.visuel.etapeCas === "number") {
          const v = cas.etapes[x.visuel.etapeCas - 1]?.visuel;
          if (v?.sorte === "ecran" && v.repli) x.visuel.repli = v.repli;
        }
        break;
      case "objet":
        textesDuVisuel(x);
        break;
      case "resultat":
        for (const cote of ["avant", "maintenant"] as const) {
          const b = x[cote];
          if (!estObjet(b)) continue;
          // Sans fait désigné, une barre peut garder sa hauteur seule (jamais montrée en nombre) ; sans hauteur non plus : refus.
          if (b.faitId === undefined && b.valeur !== undefined) continue;
          if (casSansFaitChiffre(cas) && (b.faitId === undefined || b.faitId === null)) {
            delete b.faitId;
            b.valeur = HAUTEURS_BARRES_SANS_FAIT[cote];
            notes.push(`${ou} : la barre « ${cote} » ne désigne aucun fait (le cas n'a aucun fait chiffré) : dessinée sans nombre.`);
            continue;
          }
          const f = faitDe(b.faitId, `la barre « ${cote} »`);
          if (f) valeurDuFait(b, f, `la barre « ${cote} »`);
        }
        break;
    }
  });
  return { brute: fiche, notes, refus, ecransRefuses: [...ecransRefuses] };
}
