/**
 * « DEMANDER UNE MODIFICATION » DU TABLEAU ANIMÉ (défaut du 17/10, vidéo v-667edcd8e3a8) : une demande en mots simples
 * traduite en UNE opération du catalogue fermé (`retouches.ts`), vérifiée par `apercuRetouche` avant d'être proposée.
 * Le tableau n'a pas de « plans » : on parle d'écrans (les scènes de la fiche, numérotées à partir de 1).
 *
 * Trois issues : une opération vérifiée (ce qui change, écrans refaits), une demande que le format ne sait pas
 * retoucher (phrase claire ; le service y joint le prix pour refaire la vidéo), ou `null` (rien de reconnu).
 * Les exemples affichés sont tirés de la fiche et passent tous par la même traduction : chacun est compris.
 *
 * PUR : aucun accès base ni réseau, rien n'est lancé.
 */
import { DESSINS } from "@/briques/dessins";
import { apercuRetouche, type ContexteRetouche, type OperationRetouche } from "./retouches";
import { MARQUES, cleMot, type ElementLigne, type FicheTableau, type Marque, type SceneTableau } from "./fiche";

export type TraductionTableau =
  | { genre: "operation"; operation: OperationRetouche; resume: string; ecrans: number[]; payant: boolean }
  | { genre: "hors-capacite"; message: string };

const REFAIRE = "Pour ce changement, il faut refaire la vidéo.";

/** Textes entre guillemets (« … », "…", “…”), dans l'ordre. */
function citations(texte: string): string[] {
  return [...texte.matchAll(/[«"“]\s*([^»"”]+?)\s*[»"”]/g)].map((m) => m[1].trim()).filter(Boolean);
}

const numeroEcran = (t: string) => {
  const n = Number(t.match(/(?:[ée]cran|sc[eè]ne|plan)\s*(?:n°\s*)?(\d+)/)?.[1] ?? NaN);
  return Number.isFinite(n) ? n : undefined;
};

const lignes = (s: SceneTableau) => s.elements.filter((e): e is ElementLigne => e.type === "ligne");

const MARQUE_DE: ReadonlyArray<[RegExp, Marque]> = [
  [/soulign/, "souligne"],
  [/entour/, "entoure"],
  [/barr/, "barre"],
  [/surlign/, "surligne"],
];
const NOM_MARQUE: Readonly<Record<Marque, string>> = { souligne: "souligner", entoure: "entourer", barre: "barrer", surligne: "surligner" };

/** Opérations candidates (dans l'ordre de préférence) pour une demande, avec leur phrase. */
function candidates(fiche: FicheTableau, texte: string, appels: readonly string[]): { ops: { op: OperationRetouche; resume: string }[] } | { horsCapacite: string } | null {
  const t = texte.toLowerCase();
  const cites = citations(texte);
  const n = numeroEcran(t);
  if (n !== undefined && (n < 1 || n > fiche.scenes.length)) return { horsCapacite: `Cette vidéo a ${fiche.scenes.length} écrans : l'écran ${n} n'existe pas.` };
  const scenes = n !== undefined ? [fiche.scenes[n - 1]] : fiche.scenes;
  const ecranDe = (s: SceneTableau) => fiche.scenes.indexOf(s) + 1;

  if (/tenue|costume|d[ée]cor|\bvoix\b|musique|personnage/.test(t)) return { horsCapacite: `La voix, le décor et le personnage du tableau animé ne changent pas après fabrication. ${REFAIRE}` };
  if (/chiffre|nombre|montant|pourcentage/.test(t) && /plus t[oô]t|avant|d[eè]s le d[ée]but|plus vite/.test(t)) {
    return { horsCapacite: `Sur le tableau animé, un chiffre s'écrit au moment où la voix le dit : pour qu'il apparaisse plus tôt, il faut changer ce qui est dit. ${REFAIRE}` };
  }
  if (/rythme|plus vite|plus lent|acc[ée]l[eè]r|ralenti/.test(t)) return { horsCapacite: `Le rythme du tableau animé suit la voix : il ne se règle pas à part. ${REFAIRE}` };

  // « Écrire « b » au lieu de « a » », « remplacer « a » par « b » » : le texte écrit d'une ligne.
  const [premier, second] = cites;
  if (premier && second && /au lieu de|plut[oô]t que|par\b|remplac|chang/.test(t)) {
    const [ancien, nouveau] = /au lieu de|plut[oô]t que/.test(t) ? [second, premier] : [premier, second];
    const ops = scenes.flatMap((s) =>
      lignes(s)
        .filter((l) => l.texte.toLowerCase().includes(ancien.toLowerCase()))
        .map((l) => {
          const i = l.texte.toLowerCase().indexOf(ancien.toLowerCase());
          const texteLigne = `${l.texte.slice(0, i)}${nouveau}${l.texte.slice(i + ancien.length)}`;
          return { op: { type: "remplacerTexteLigne" as const, sceneId: s.id, elementId: l.id, texte: texteLigne }, resume: `J'écris « ${texteLigne} » au lieu de « ${l.texte} » (écran ${ecranDe(s)}). La voix ne change pas.` };
        }),
    );
    return ops.length ? { ops } : { horsCapacite: `Je ne trouve pas « ${ancien} » parmi les mots écrits${n ? ` de l'écran ${n}` : ""}. Vérifiez le texte entre guillemets.` };
  }

  // Mettre un mot en valeur.
  if (/en valeur|en gras|ressortir|important|insist/.test(t)) {
    const mot = cites[0] ?? t.match(/le mot\s+(\p{L}+)/u)?.[1];
    if (!mot) return { ops: [] };
    const ops = scenes.flatMap((s) =>
      lignes(s)
        .filter((l) => l.texte.split(/\s+/).some((m) => cleMot(m) && cleMot(m) === cleMot(mot)))
        .map((l) => ({ op: { type: "marquerMotImportant" as const, sceneId: s.id, elementId: l.id, mot }, resume: `Je mets « ${mot} » en valeur dans « ${l.texte} » (écran ${ecranDe(s)}).` })),
    );
    return ops.length ? { ops } : { horsCapacite: `Le mot « ${mot} » n'est pas écrit${n ? ` à l'écran ${n}` : " à l'écran"} : seuls les mots écrits peuvent être mis en valeur.` };
  }

  const enlever = /enl[eè]v|retir|supprim|effac|\bsans\b|ôte|oter/.test(t);
  const lignesVisees = (s: SceneTableau) => lignes(s).filter((l) => !cites.length || cites.some((c) => l.texte.toLowerCase().includes(c.toLowerCase())));

  // Enlever un trait (souligné, entouré…).
  if (enlever && /trait|soulign|entour|barr|surlign|cercle|marque/.test(t)) {
    const ops = scenes.flatMap((s) => lignesVisees(s).filter((l) => l.marque).map((l) => ({ op: { type: "retirerMarque" as const, sceneId: s.id, elementId: l.id }, resume: `J'enlève le trait sur « ${l.texte} » (écran ${ecranDe(s)}).` })));
    return ops.length ? { ops } : { horsCapacite: `Aucune ligne n'a de trait${n ? ` à l'écran ${n}` : ""} : il n'y a rien à enlever.` };
  }

  // Souligner, entourer, barrer, surligner une ligne.
  const marque = MARQUE_DE.find(([re]) => re.test(t))?.[1];
  if (marque && MARQUES.includes(marque)) {
    const ops = scenes.flatMap((s) => lignesVisees(s).filter((l) => l.marque !== marque).map((l) => ({ op: { type: "ajouterMarque" as const, sceneId: s.id, elementId: l.id, marque }, resume: `Je vais ${NOM_MARQUE[marque]} « ${l.texte} » (écran ${ecranDe(s)}).` })));
    return { ops };
  }

  const dessin = /dessin|image|illustration|pictogramme|ic[oô]ne/.test(t);
  // Retirer un dessin.
  if (enlever && dessin) {
    const ops = scenes.flatMap((s) => s.elements.filter((e) => e.type === "dessin").map((e) => ({ op: { type: "supprimerElement" as const, sceneId: s.id, elementId: e.id }, resume: `Je retire le dessin de l'écran ${ecranDe(s)}.` })));
    return ops.length ? { ops } : { horsCapacite: `Il n'y a pas de dessin${n ? ` à l'écran ${n}` : ""} à retirer.` };
  }
  // Changer un dessin : un autre dessin de la banque (Will peut « Laisser » et choisir avec le bouton de l'écran).
  if (dessin && /chang|remplac|autre/.test(t)) {
    const ops = scenes.flatMap((s) =>
      s.elements.flatMap((e) =>
        e.type === "dessin"
          ? DESSINS.filter((d) => d.id !== e.dessinId).map((d) => ({ op: { type: "remplacerDessin" as const, sceneId: s.id, elementId: e.id, dessinId: d.id }, resume: `Je remplace le dessin de l'écran ${ecranDe(s)} par « ${d.nom} ». Pour en choisir un autre, utilisez le bouton « Changer le dessin ».` }))
          : [],
      ),
    );
    return ops.length ? { ops } : { horsCapacite: `Il n'y a pas de dessin${n ? ` à l'écran ${n}` : ""} à changer.` };
  }

  // Changer la fin (appel de la bibliothèque).
  if (/\bfin\b|appel|conclusion/.test(t) && /chang|autre|remplac/.test(t)) {
    const ops = appels.filter((a) => a !== fiche.appelId).map((a) => ({ op: { type: "changerFin" as const, appelId: a }, resume: `Je change la fin de la vidéo (« ${a} »).` }));
    return ops.length ? { ops } : { horsCapacite: `Aucune autre fin n'est prête pour ce réseau. ${REFAIRE}` };
  }

  // Mise en page : l'écran passe sur la page d'avant ou d'après.
  if (/mise en page|disposition|page suivante|nouvelle page|page d.avant|page pr[ée]c[ée]dente|autre page/.test(t)) {
    const vers = /page d.avant|pr[ée]c[ée]dente/.test(t) ? (["page-precedente"] as const) : (["page-suivante", "page-precedente"] as const);
    const ops = scenes.flatMap((s) => vers.map((v) => ({ op: { type: "deplacerScene" as const, sceneId: s.id, vers: v }, resume: `L'écran ${ecranDe(s)} passe sur la page ${v === "page-suivante" ? "suivante" : "d'avant"} : sa mise en page change.` })));
    return { ops };
  }

  // Retirer un écran entier : ce qui est dit changerait.
  if (enlever && /[ée]cran|sc[eè]ne|plan|passage/.test(t)) {
    return { horsCapacite: `Retirer un écran entier change ce qui est dit. ${REFAIRE} Vous pouvez aussi retirer un dessin ou un trait de cet écran.` };
  }
  if (/plus gros|plus grand|agrandi|r[ée]dui|plus petit|taille/.test(t)) return { horsCapacite: `La taille de l'écriture suit la mise en page de chaque page : elle ne se règle pas à part. ${REFAIRE}` };
  return null;
}

/**
 * Traduit une demande pour la fiche : la première opération candidate acceptée par les règles (`apercuRetouche`).
 * Toutes refusées : la raison du premier refus, en phrase claire. Rien de reconnu : `null`.
 */
export function traduireDemandeTableau(fiche: FicheTableau, texte: string, contexte: ContexteRetouche): TraductionTableau | null {
  const c = candidates(fiche, texte, contexte.appels ?? []);
  if (!c) return null;
  if ("horsCapacite" in c) return { genre: "hors-capacite", message: c.horsCapacite };
  let refus: string | undefined;
  for (const { op, resume } of c.ops) {
    const a = apercuRetouche(fiche, op, contexte);
    if (!a.ok) {
      refus ??= a.refus.join(" ");
      continue;
    }
    const ecrans = a.scenesRefaites.map((id) => fiche.scenes.findIndex((s) => s.id === id) + 1).filter((x) => x > 0);
    const n = op.type === "changerFin" ? [] : [fiche.scenes.findIndex((s) => s.id === op.sceneId) + 1];
    return { genre: "operation", operation: op, resume: `${resume}${a.payant ? " La voix est refaite (payant)." : ""}`, ecrans: [...new Set([...n, ...ecrans])].filter((x) => x > 0).sort((x, y) => x - y), payant: a.payant };
  }
  return { genre: "hors-capacite", message: refus ?? `Je ne peux pas faire ce changement sur cette vidéo. ${REFAIRE}` };
}

/** Exemples tirés de la fiche, chacun vérifié par la même traduction (au plus 3). Jamais un exemple impossible. */
export function exemplesTableau(fiche: FicheTableau, contexte: ContexteRetouche): string[] {
  const candidatsTexte: string[] = [];
  fiche.scenes.forEach((s, i) => {
    if (s.elements.some((e) => e.type === "dessin")) candidatsTexte.push(`Retirer le dessin de l'écran ${i + 1}`);
  });
  fiche.scenes.forEach((s, i) => {
    for (const l of lignes(s)) {
      const mot = l.texte
        .split(/\s+/)
        .map((m) => m.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
        .filter((m) => m.length >= 4 && !(l.importants ?? []).some((x) => cleMot(x) === cleMot(m)))
        .sort((a, b) => b.length - a.length)[0];
      if (mot) candidatsTexte.push(`Mettre « ${mot} » en valeur à l'écran ${i + 1}`);
    }
  });
  fiche.scenes.forEach((_, i) => candidatsTexte.push(`Changer la mise en page de l'écran ${i + 1}`));
  fiche.scenes.forEach((s, i) => {
    if (lignes(s).some((l) => l.marque !== "souligne")) candidatsTexte.push(`Souligner la ligne de l'écran ${i + 1}`);
  });
  const retenus: string[] = [];
  const familles = new Set<string>();
  for (const texte of candidatsTexte) {
    if (retenus.length >= 3) break;
    const famille = texte.split(" ")[0];
    if (familles.has(famille)) continue;
    const r = traduireDemandeTableau(fiche, texte, contexte);
    if (r?.genre === "operation" && !r.payant) {
      retenus.push(texte);
      familles.add(famille);
    }
  }
  return retenus;
}
