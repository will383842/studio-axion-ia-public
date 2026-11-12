/**
 * IMAGE → VIDÉO · R2 · La carte de l'image se RÉPARE SEULE. PUR, sans accès au serveur.
 *
 * Règle : une carte incohérente ne bloque jamais la vidéo. Avant le verdict de `controlerCarte`, le code corrige ce qui
 * se corrige sans rien inventer. Il ne touche JAMAIS un texte de l'image (titre, libellés, phrases affirmatives,
 * étiquettes), n'écrit aucun chiffre et ne change ni `offre` ni `automatisation` : il fusionne, retire, rabat. Chaque
 * réparation est rendue avec un code et une phrase, pour être dite à Will.
 *
 * Réparé : blocs et flèches en doublon, flèches et groupes qui citent un bloc absent, plus d'un cycle (une flèche
 * interne à un cycle est retirée, la plus faible dont le retrait ne laisse aucun bloc isolé), type exigeant ce que la
 * carte n'a pas (embranchement, entonnoir, avant / après : rabattu sur un type sûr), liste des chiffres devenue fausse.
 * Quand un retrait laisse un bloc sans flèche, la phrase le dit (le blocage éventuel est alors celui de `controlerCarte`).
 *
 * NON traité ici : un bloc sans aucune flèche d'origine. Celui d'une branche relève de `reparerOrphelinsDeBranche`
 * (carte.ts, appelé APRÈS cette réparation) ; les autres restent signalés par `controlerCarte`.
 *
 * Idempotent : reparerCarte(reparerCarte(x).carte) = reparerCarte(x).carte, sans nouvelle réparation.
 */
import { cleChiffre } from "./chiffres";
import { completerCarte, cycles, exigenceDuType, type CarteImage, type LienCarte, type NoeudCarte, type TypeImage } from "./carte";
import { typesDeLaCarte } from "./complexite";
import { phraseAdaptation } from "./normalisation";

export interface ReparationCarte {
  code: string;
  detail: string;
}

export interface ResultatReparation {
  carte: CarteImage;
  reparations: ReparationCarte[];
}

export interface OptionsReparation {
  /** Vrai si le type vient d'un choix explicite (Will, type imposé) : la phrase le dit ainsi. */
  typeChoisi?: boolean;
}

const unique = <T>(l: readonly T[]) => [...new Set(l)];

/** Plus la valeur est petite, plus la flèche est faible : déduite < sans part < sans étiquette < pointillée. */
function force(l: LienCarte): [number, number, number, number] {
  return [l.deduit ? 0 : 1, l.part !== undefined ? 1 : 0, l.etiquette ? 1 : 0, l.style === "plein" ? 1 : 0];
}
/** Dans le même rang de force, une flèche de retour (qui referme la boucle) part avant une flèche du fil principal. */
function parForce(retour: ReadonlySet<string>) {
  return (a: LienCarte, b: LienCarte): number => {
    const fa = force(a);
    const fb = force(b);
    for (let i = 0; i < 3; i++) if (fa[i] !== fb[i]) return fa[i]! - fb[i]!;
    const ra = retour.has(a.id) ? 0 : 1;
    const rb = retour.has(b.id) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    if (fa[3] !== fb[3]) return fa[3]! - fb[3]!;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Identifiants des flèches de retour d'un parcours en profondeur (ordre fixe : blocs triés, puis cibles triées). */
function flechesDeRetour(ids: readonly string[], liens: readonly LienCarte[]): Set<string> {
  const suivants = new Map<string, LienCarte[]>(ids.map((n) => [n, []]));
  for (const l of liens) suivants.get(l.de)?.push(l);
  for (const v of suivants.values()) v.sort((a, b) => (a.vers < b.vers ? -1 : a.vers > b.vers ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const etat = new Map<string, 1 | 2>();
  const res = new Set<string>();
  const visiter = (n: string) => {
    etat.set(n, 1);
    for (const l of suivants.get(n) ?? []) {
      if (etat.get(l.vers) === 1) res.add(l.id);
      else if (!etat.has(l.vers) && suivants.has(l.vers)) visiter(l.vers);
    }
    etat.set(n, 2);
  };
  for (const n of [...ids].sort()) if (!etat.has(n)) visiter(n);
  return res;
}

/** Flèches internes à une composante fortement connexe non triviale (au moins un cycle) : les seules à pouvoir en casser un. */
function flechesDeCycle(ids: readonly string[], liens: readonly LienCarte[]): LienCarte[] {
  const suivants = new Map<string, string[]>(ids.map((n) => [n, []]));
  for (const l of liens) suivants.get(l.de)?.push(l.vers);
  const atteint = (depart: string): Set<string> => {
    const vus = new Set<string>();
    const pile = [depart];
    while (pile.length > 0) {
      const n = pile.pop()!;
      for (const s of suivants.get(n) ?? []) {
        if (!vus.has(s)) {
          vus.add(s);
          pile.push(s);
        }
      }
    }
    return vus;
  };
  const memo = new Map<string, Set<string>>();
  const depuis = (n: string) => {
    if (!memo.has(n)) memo.set(n, atteint(n));
    return memo.get(n)!;
  };
  // l est dans un cycle si l.vers atteint l.de (ou si c'est une boucle sur soi-même).
  return liens.filter((l) => l.de === l.vers || (suivants.has(l.vers) && depuis(l.vers).has(l.de)));
}

const cleChiffres = (c: CarteImage) =>
  c.chiffres.map((x) => `${cleChiffre(x.brut)}|${x.dansNoeud ?? ""}|${x.dansLien ?? ""}|${x.dansBandeau ? 1 : 0}`).sort().join("\n");

/** Recalcule ce que le code sait calculer en gardant types, offre et automatisation tels quels. */
function recalculer(carte: CarteImage): CarteImage {
  try {
    const r = completerCarte(carte);
    return { ...r, types: carte.types, offre: carte.offre, automatisation: carte.automatisation };
  } catch {
    return carte;
  }
}

const decrit = (l: LienCarte) => `${l.id} (${l.de} → ${l.vers}${l.etiquette ? `, « ${l.etiquette} »` : ""}${l.part !== undefined ? `, ${String(l.part).replace(".", ",")} %` : ""})`;

export function reparerCarte(entree: CarteImage, options: OptionsReparation = {}): ResultatReparation {
  const reparations: ReparationCarte[] = [];
  const dit = (code: string, detail: string) => reparations.push({ code, detail });
  /** Blocs qui avaient au moins une flèche au départ : seuls ceux-là peuvent être « isolés par la réparation ». */
  const reliesAuDepart = new Set(entree.liens.flatMap((l) => [l.de, l.vers]));
  const retraits: { rep: ReparationCarte; lien: LienCarte }[] = [];

  // 1. Blocs en doublon : le premier gagne, ses champs vides sont repris du suivant, le libellé écarté est cité.
  const noeuds: NoeudCarte[] = [];
  for (const n of entree.noeuds) {
    const deja = noeuds.findIndex((x) => x.id === n.id);
    if (deja < 0) {
      noeuds.push({ ...n });
      continue;
    }
    const garde: Record<string, unknown> = { ...noeuds[deja]! };
    for (const [k, v] of Object.entries(n)) if (garde[k] === undefined && v !== undefined) garde[k] = v;
    const ecarte = n.libelle !== noeuds[deja]!.libelle ? ` Le libellé écarté était « ${n.libelle} ».` : "";
    noeuds[deja] = garde as NoeudCarte;
    dit("bloc-en-double", `Le bloc ${n.id} était décrit deux fois : fusionné en un seul.${ecarte}`);
  }
  const ids = new Set(noeuds.map((n) => n.id));

  // 2. Flèches. Doublon exact (mêmes extrémités) : jeté. Même identifiant mais autres extrémités : renommée, gardée.
  const pris = new Set(entree.liens.map((l) => l.id));
  const vusId = new Set<string>();
  const premiers = new Map<string, LienCarte>();
  let liens: LienCarte[] = [];
  for (const l0 of entree.liens) {
    let l = l0;
    if (vusId.has(l.id)) {
      const premier = premiers.get(l.id)!;
      if (premier.de === l.de && premier.vers === l.vers) {
        const autre = l.etiquette && l.etiquette !== premier.etiquette ? ` L'étiquette écartée était « ${l.etiquette} ».` : "";
        dit("fleche-en-double", `La flèche ${l.id} (${l.de} → ${l.vers}) était décrite deux fois : une seule est gardée.${autre}`);
        continue;
      }
      let k = 2;
      let nouveau = `${l.id.slice(0, 36)}-${k}`;
      while (pris.has(nouveau)) nouveau = `${l.id.slice(0, 36)}-${++k}`;
      pris.add(nouveau);
      dit("fleche-renommee", `Deux flèches différentes portaient l'identifiant ${l.id} : la seconde (${l.de} → ${l.vers}) devient ${nouveau}.`);
      l = { ...l, id: nouveau };
    } else premiers.set(l.id, l);
    vusId.add(l.id);
    if (!ids.has(l.de) || !ids.has(l.vers)) {
      const rep: ReparationCarte = { code: "fleche-vers-bloc-absent", detail: `La flèche ${decrit(l)} reliait un bloc qui n'existe pas : retirée.` };
      reparations.push(rep);
      retraits.push({ rep, lien: l });
      continue;
    }
    liens.push(l);
  }

  // 3. Groupes : doublons d'identifiant (blocs réunis), blocs absents ou répétés retirés, groupes vidés supprimés.
  const groupes: CarteImage["groupes"] = [];
  for (const g of entree.groupes) {
    const deja = groupes.findIndex((x) => x.id === g.id);
    if (deja >= 0) {
      groupes[deja] = { ...groupes[deja]!, noeuds: [...groupes[deja]!.noeuds, ...g.noeuds] };
      dit("groupe-en-double", `Le groupe ${g.id} était décrit deux fois : réunis en un seul.`);
    } else groupes.push({ ...g });
  }
  const groupesPropres: CarteImage["groupes"] = [];
  for (const g of groupes) {
    const gardes = unique(g.noeuds.filter((id) => ids.has(id)));
    for (const id of unique(g.noeuds.filter((x) => !ids.has(x)))) dit("groupe-vers-bloc-absent", `Le groupe ${g.id} citait un bloc qui n'existe pas (${id}) : retiré du groupe.`);
    if (gardes.length === 0) dit("groupe-sans-bloc", `Le groupe ${g.id} n'avait plus aucun bloc : supprimé.`);
    else groupesPropres.push({ ...g, noeuds: gardes });
  }
  const idsGroupes = new Set(groupesPropres.map((g) => g.id));
  const noeudsPropres = noeuds.map((n) => {
    if (n.groupe === undefined || idsGroupes.has(n.groupe)) return n;
    dit("bloc-vers-groupe-absent", `Le bloc ${n.id} citait un groupe qui n'existe pas (${n.groupe}) : appartenance retirée.`);
    const { groupe: _retire, ...reste } = n;
    return reste as NoeudCarte;
  });

  // 4. Plus d'un cycle : on retire une flèche INTERNE à un cycle, la plus faible dont le retrait fait baisser le nombre
  //    de cycles ET ne laisse aucun bloc sans flèche ; à défaut, la plus faible qui fait baisser le nombre de cycles.
  const listeIds = noeudsPropres.map((n) => n.id);
  const isolePar = (avant: readonly LienCarte[], apres: readonly LienCarte[]) => {
    const encore = new Set(apres.flatMap((l) => [l.de, l.vers]));
    return unique(avant.flatMap((l) => [l.de, l.vers])).filter((id) => !encore.has(id)).sort();
  };
  for (;;) {
    const courant = cycles(listeIds, liens);
    if (courant <= 1) break;
    const candidates = flechesDeCycle(listeIds, liens).sort(parForce(flechesDeRetour(listeIds, liens)));
    const baisse = candidates.filter((c) => cycles(listeIds, liens.filter((l) => l.id !== c.id)) < courant);
    const sansIsole = baisse.filter((c) => isolePar(liens, liens.filter((l) => l.id !== c.id)).length === 0);
    const casse = (sansIsole[0] ?? baisse[0] ?? candidates[0])!;
    const restant = liens.filter((l) => l.id !== casse.id);
    const isoles = isolePar(liens, restant);
    liens = restant;
    dit("cycle-casse", `Le schéma tournait en rond plus d'une fois : la flèche ${decrit(casse)} est retirée.${isoles.length > 0 ? ` Le bloc ${isoles.join(", ")} n'est plus relié à rien.` : ""}`);
  }

  // Les flèches retirées parce qu'elles citaient un bloc absent : dire si elles laissent un bloc existant sans flèche.
  for (const { rep, lien } of retraits) {
    const isoles = [lien.de, lien.vers].filter((id) => ids.has(id) && reliesAuDepart.has(id) && !liens.some((l) => l.de === id || l.vers === id));
    if (isoles.length > 0) rep.detail += ` Le bloc ${unique(isoles).join(", ")} n'est plus relié à rien.`;
  }

  let carte: CarteImage = { ...entree, noeuds: noeudsPropres, liens, groupes: groupesPropres };
  const structurel = reparations.length > 0;

  // 5. Liste des chiffres : recalculée si les textes ou les flèches ont changé (jamais un chiffre nouveau).
  const recalculee = recalculer(carte);
  if (structurel || cleChiffres(recalculee) !== cleChiffres(carte)) {
    if (!structurel) dit("chiffres-recalcules", "La liste des chiffres ne correspondait pas aux textes de l'image : recalculée d'après ces textes.");
    carte = { ...carte, chiffres: recalculee.chiffres, bandeauChiffres: recalculee.bandeauChiffres, formulesAbsolues: recalculee.formulesAbsolues, coherence: recalculee.coherence };
  }

  // 6. Types dont la carte ne remplit pas l'exigence : rabattus sur un type sûr. Offre et automatisation ne bougent JAMAIS.
  const mauvais = carte.types.filter((t) => exigenceDuType(carte, t));
  if (mauvais.length > 0) {
    const restants = carte.types.filter((t) => !mauvais.includes(t));
    const sures = typesDeLaCarte(carte).filter((t) => !mauvais.includes(t) && !exigenceDuType(carte, t));
    const choisis = unique<TypeImage>([...restants, ...sures]).slice(0, 2);
    const nouveaux = (choisis.length === 0 ? ["chaine"] : choisis) as CarteImage["types"];
    const types: CarteImage["types"] = nouveaux.length === 2 ? [nouveaux[0]!, nouveaux[1]!] : [nouveaux[0]!];
    for (const t of mauvais) {
      const phrase = options.typeChoisi ? `Le type que vous avez choisi (${t})` : `Le type « ${t} »`;
      dit("type-rabattu", `${phrase} ne correspond pas au schéma : remplacé par ${types.join(" + ")}.`);
    }
    carte = { ...carte, types };
  }

  return reparations.length === 0 ? { carte: entree, reparations } : { carte, reparations };
}

/**
 * CANAL UNIQUE d'écriture des réparations : `carte.adaptations`, avec le préfixe « Adapté automatiquement : » de R1
 * (même canal que la normalisation de la lecture). Idempotent : une phrase déjà écrite n'est pas répétée.
 */
export function ecrireAdaptations(carte: CarteImage, phrases: readonly string[]): CarteImage {
  const adaptations = [...(carte.adaptations ?? [])];
  for (const p of phrases) {
    const phrase = phraseAdaptation({ code: "reparation", avant: "", apres: "", raison: p });
    if (!adaptations.includes(phrase)) adaptations.push(phrase);
  }
  return { ...carte, adaptations: adaptations.slice(0, 60) };
}

/** Répare la carte et dit chaque réparation à Will (une fois). Rend aussi les réparations de CET appel. */
export function reparerEtSignaler(entree: CarteImage, options: OptionsReparation = {}): ResultatReparation {
  const r = reparerCarte(entree, options);
  if (r.reparations.length === 0) return r;
  return { carte: ecrireAdaptations(r.carte, r.reparations.map((x) => x.detail)), reparations: r.reparations };
}
