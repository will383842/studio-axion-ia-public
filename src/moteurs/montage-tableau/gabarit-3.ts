/**
 * GABARIT PAR PARTIES DU STYLE « reference/3 » (14/10/2026, regard de Will sur la vidéo v-f1739d6a4f51 : « ce n'est
 * pas assez clair… on n'a pas dès le début le problème… c'est écrit problème alors que c'est une douleur et une
 * solution »). PUR. Règle 18 du format pour ce style (appelée par `regleGabarit`).
 *
 * La vidéo suit SES PARTIES, dans l'ordre, chacune écrite en étiquette constante en haut de la page :
 *   ACCROCHE (page 1 : la douleur, écrite en très grand dès la première image) → LA DOULEUR → LA SOLUTION (la promesse,
 *   puis une page par étape : 2 à 3 étapes, « Étape 2 sur 3 » avec le vrai nombre) → EXEMPLE → À RETENIR (l'IDÉE en une
 *   phrase, gabarit cadré du 15/10 : plus de liste des étapes obligatoire) → l'APPEL (page plein cadre).
 * Aucune page « problème » : le mot n'est jamais écrit en étiquette.
 *
 * Une page = 3 blocs au plus, dans l'ordre de lecture : titre, phrase clé, puis un détail ou UN visuel (liste à
 * pastilles de couleur, liste cochée, « avant → après » sur un mot, avant / après de l'exemple, idée reçue barrée).
 * Le texte écrit reprend le texte dit (jamais le contredire) : mêmes contrôles que « reference/2 ».
 */
import { mots } from "@/domaine/controles-script/texte";
import { VISUELS_3 } from "@/briques/tableau-scene/reference/visuels-3";
import { chiffresRetires, decomptesRetires, nombresDits } from "./fidelite-texte";
import { STYLES_TABLEAU, estStyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import type { ElementLigne, FicheTableau, GabaritScene } from "./fiche";
import { BORNES_GABARIT, NOMS_BLOCS, NOMS_ROLES, ROLES_PAGE_3, STYLE_GABARIT_3, estPageSuite, lignesDe, numerosDits, pagesDe, partDite, rolePage, type BlocGabarit, type PageGabarit, type RolePage } from "./gabarit";

interface Manquement {
  sceneId?: string;
  detail: string;
}

/** Bornes du gabarit par parties. */
export const BORNES_GABARIT_3 = {
  /** Blocs visibles au plus sur une page (titre, phrase clé, détail ou visuel ; étiquette de partie et pastille à part). */
  blocsMax: 3,
  /** Accroche (la phrase de la douleur écrite dès la première image) : 14 mots au plus. */
  accrocheMots: 14,
  titreMots: 3,
  phraseMots: 12,
  /** Détails : 12 mots au plus (le texte est plus grand). */
  detailMots: 12,
  /** Éléments d'une liste à pastilles ou cochée : 2 à 5, de 7 mots au plus. */
  listeMin: 2,
  listeMax: 5,
  itemMots: 7,
  /** « avant → après » : 1 ou 2 lignes, chaque côté de 4 mots au plus. */
  transformationsMax: 2,
  coteMots: 4,
  /** Idée reçue (barrée) : 10 mots au plus, une par page. */
  ideeMots: 10,
  /** Avant, après de l'exemple : 10 mots au plus. */
  comparaisonMots: 10,
  /** « À retenir » (ancienne fiche en liste) : 6 éléments au plus. */
  retenirMax: 6,
} as const;

/** Bloc orange (peps, 15/10) : texte (caractères, mots) et compteur au plus. */
export const BORNES_BLOC_3 = Object.freeze({ texteMax: 28, motsMax: 4, compteurMax: 999 });

/** Textes qu'écrivent le visuel et le bloc orange d'une scène (le chiffre final du compteur devant le texte du bloc). */
export function textesPeps(s: { gabarit?: GabaritScene }): string[] {
  const v = s.gabarit?.visuel;
  const b = s.gabarit?.bloc;
  return [...(v ? [v.chiffre, v.libelle, v.gauche, v.droite].filter((x): x is string => !!x && x !== "personne") : []), ...(b ? [b.compteur ? `${b.compteur.a} ${b.texte}` : b.texte] : [])];
}

/** Conseils de longueur (consigne). */
export const CONSEIL_GABARIT_3 = { detailMots: 9, itemMots: 5, comparaisonMots: 8 } as const;

/** Ordre des parties : une partie ne revient jamais après la suivante (l'exemple peut suivre une étape). */
const RANG: Record<string, number> = { accroche: 0, douleur: 1, solution: 2, exemple: 2, retenir: 4, appel: 5 };

/** Blocs permis par partie. */
export const BLOCS_PERMIS_3: Record<string, readonly BlocGabarit[]> = {
  accroche: ["phrase-cle", "detail"],
  douleur: ["titre", "phrase-cle", "detail", "idee-recue"],
  solution: ["titre", "phrase-cle", "detail", "code", "coche", "transformation"],
  exemple: ["titre", "phrase-cle", "detail", "avant", "apres", "transformation", "coche"],
  // 15/10 : « À retenir » = l'idée en une phrase (phrase clé) ; une ancienne fiche peut garder sa liste.
  retenir: ["titre", "phrase-cle", "liste", "detail"],
  appel: ["appel", "detail"],
};

/** Groupe d'affichage d'un bloc : les éléments d'une même liste (ou l'avant et l'après) forment UN bloc visible. */
export function groupeDuBloc(b: BlocGabarit): string {
  if (b === "avant" || b === "apres") return "comparaison";
  if (b === "code" || b === "coche" || b === "transformation" || b === "liste") return b;
  return "";
}

/** Nombre de blocs visibles d'un ensemble de lignes (une liste compte pour un). */
export function blocsVisibles(lignes: readonly Pick<ElementLigne, "bloc" | "id">[]): number {
  const groupes = new Set<string>();
  let n = 0;
  for (const l of lignes) {
    if (!l.bloc) continue;
    const g = groupeDuBloc(l.bloc);
    if (!g) n++;
    else if (!groupes.has(g)) {
      groupes.add(g);
      n++;
    }
  }
  return n;
}

/** Les deux côtés d'une transformation « M. Dupont → Client A » ; `null` si la forme n'y est pas. */
export function cotesTransformation(texte: string): { de: string; vers: string } | null {
  const m = /^(.+?)\s*(?:→|->)\s*(.+)$/u.exec(texte.trim());
  if (!m || /→|->/u.test(m[2])) return null;
  const de = m[1].trim();
  const vers = m[2].trim();
  return de && vers ? { de, vers } : null;
}

const nbMots = (t: string) => mots(t).length;
const liste = (xs: readonly string[]) => xs.map((x) => `« ${x} »`).join(", ");
const chiffres = (t: string) => t.match(/\d+/g) ?? [];
const cle = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
const LETTRES: Record<string, string> = { "1": "un", "2": "deux", "3": "trois", "4": "quatre", "5": "cinq", "6": "six", "7": "sept", "8": "huit", "9": "neuf", "10": "dix", "11": "onze", "12": "douze", "13": "treize", "14": "quatorze", "15": "quinze", "16": "seize", "20": "vingt", "30": "trente", "40": "quarante", "50": "cinquante", "60": "soixante", "100": "cent" };

/** Règle 18 au style « reference/3 ». */
export function regleGabarit3(fiche: FicheTableau): Manquement[] {
  const res: Manquement[] = [];
  if (fiche.styleTableau !== undefined && !estStyleTableau(fiche.styleTableau)) res.push({ detail: `le style du tableau « ${fiche.styleTableau} » n'existe pas ; styles : ${liste(STYLES_TABLEAU)} (ou aucun : celui de la série).` });
  const pages = pagesDe(fiche);
  const derniere = fiche.scenes[fiche.scenes.length - 1];
  let etapeAttendue = 1;
  let rangPrecedent = -1;
  pages.forEach((p: PageGabarit, i) => {
    const premiere = p.scenes[0];
    const role = rolePage(p);
    for (const s of p.scenes) {
      if (!s.gabarit) {
        res.push({ sceneId: s.id, detail: `la scène n'a pas de « gabarit » : donnez-lui { "role": ${liste(ROLES_PAGE_3)} } (la partie de sa page).` });
        continue;
      }
      if (s.ecrans?.length) res.push({ sceneId: s.id, detail: `pas d'« ecrans » au style « ${STYLE_GABARIT_3} » : retirez-les.` });
      if (!ROLES_PAGE_3.includes(s.gabarit.role))
        res.push({ sceneId: s.id, detail: `la partie « ${s.gabarit.role} » n'existe pas au style « ${STYLE_GABARIT_3} » (jamais de page « problème » : la douleur est « douleur », une étape est « solution ») ; parties : ${liste(ROLES_PAGE_3)}.` });
      if (role && s.gabarit.role !== role) res.push({ sceneId: s.id, detail: `toutes les scènes de la page ${p.page} ont la même partie : « ${role} » (celle de sa première scène), pas « ${s.gabarit.role} ».` });
      if (s.gabarit.numero && s.gabarit.role !== "solution") res.push({ sceneId: s.id, detail: `seule une page « solution » porte un numéro d'étape : retirez « numero » ou donnez à la page la partie « solution ».` });
      for (const l of lignesDe(s)) {
        const permis = role ? BLOCS_PERMIS_3[role] : undefined;
        if (!l.bloc) res.push({ sceneId: s.id, detail: `la ligne « ${l.texte} » n'a pas de « bloc » : dites sa place dans la page.` });
        else if (permis && !permis.includes(l.bloc)) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[l.bloc]} (« ${l.texte} ») n'a pas sa place sur une page « ${NOMS_ROLES[role!]} » (${liste(permis)} seulement).` });
        if (l.bloc === "code" && !l.code) res.push({ sceneId: s.id, detail: `l'élément « ${l.texte} » de la liste à pastilles n'a pas de « code » (« vert », « orange » ou « rouge »).` });
        if (l.code && l.bloc !== "code") res.push({ sceneId: s.id, detail: `« code » ne va que sur un élément de liste à pastilles (bloc « code »), pas sur « ${l.texte} ».` });
        if (l.bloc === "transformation" && !cotesTransformation(l.texte)) res.push({ sceneId: s.id, detail: `la transformation « ${l.texte} » s'écrit « avant → après » (une flèche, un mot ou deux de chaque côté : « M. Dupont → Client A »).` });
      }
      // La voix compte une étape : la page est une étape de la solution, numérotée au mot dit.
      const dits = numerosDits(s.texteDit);
      const num = s.gabarit.numero;
      for (const d of dits) {
        if (!num) res.push({ sceneId: s.id, detail: `la voix dit le numéro ${d.n} (mot ${d.ancre + 1}) : écrivez-le, avec « gabarit » { "role": "solution", "numero": { "n": ${d.n}, "ancre": ${d.ancre} } }.` });
        else if (num.n !== d.n || num.ancre !== d.ancre) res.push({ sceneId: s.id, detail: `la voix dit le numéro ${d.n} au mot ${d.ancre + 1} : le numéro écrit doit être { "n": ${d.n}, "ancre": ${d.ancre} }.` });
      }
      if (num && !dits.length && num.ancre >= mots(s.texteDit).length) res.push({ sceneId: s.id, detail: `le numéro part du mot ${num.ancre + 1}, mais le texte dit n'a que ${mots(s.texteDit).length} mots.` });
    }
    if (!role || !ROLES_PAGE_3.includes(role)) return;
    const suite = estPageSuite(pages, i);
    // Ordre des parties.
    if (i === 0 && role !== "accroche") res.push({ sceneId: premiere.id, detail: `la page 1 est l'ACCROCHE (la douleur, écrite en grand dès la première image), pas « ${NOMS_ROLES[role]} ».` });
    if (i > 0 && role === "accroche") res.push({ sceneId: premiere.id, detail: `une seule page d'accroche : la page 1.` });
    if (RANG[role] < rangPrecedent) res.push({ sceneId: premiere.id, detail: `la partie « ${NOMS_ROLES[role]} » (page ${p.page}) revient après une partie qui la suit : l'ordre est accroche, douleur, solution, exemple, à retenir, appel.` });
    rangPrecedent = Math.max(rangPrecedent, RANG[role]);
    if (role === "appel" && !p.scenes.includes(derniere)) res.push({ sceneId: premiere.id, detail: `la page d'appel est la dernière page de la vidéo.` });
    if (i === pages.length - 1 && role !== "appel") res.push({ sceneId: premiere.id, detail: `la dernière page est la page d'APPEL (plein cadre : la phrase d'appel en grand, axion-ia.com) ; donnez à la dernière scène la partie « appel » et une ligne « bloc » « appel ».` });
    if (role === "retenir" && pages[i + 1] && rolePage(pages[i + 1]) !== "appel" && rolePage(pages[i + 1]) !== "retenir") res.push({ sceneId: premiere.id, detail: `« À retenir » vient juste avant la page d'appel.` });

    const lignes = p.scenes.flatMap((s) => lignesDe(s).map((l) => ({ l, s })));
    const de = (b: BlocGabarit) => lignes.filter((x) => x.l.bloc === b);
    const dit = p.scenes.map((s) => s.texteDit).join(" ");
    // Peps (maquette validée le 15/10, PR #260) : UN visuel de la banque et UN bloc orange au plus par page, jamais sur
    // la page d'appel ; le visuel n'écrit que ses champs ; le bloc orange compte pour un bloc visible.
    const avecVisuel = p.scenes.filter((s) => s.gabarit?.visuel);
    const avecBloc = p.scenes.filter((s) => s.gabarit?.bloc);
    if (avecVisuel.length > 1) res.push({ sceneId: avecVisuel[1].id, detail: `la page ${p.page} a ${avecVisuel.length} visuels ; un seul visuel par page.` });
    if (avecBloc.length > 1) res.push({ sceneId: avecBloc[1].id, detail: `la page ${p.page} a ${avecBloc.length} blocs orange ; un seul bloc orange par page.` });
    for (const s of [...avecVisuel, ...avecBloc]) if (role === "appel") res.push({ sceneId: s.id, detail: `la page d'appel garde sa phrase et son bouton : ni visuel ni bloc orange.` });
    for (const s of avecVisuel) {
      const v = s.gabarit!.visuel!;
      const fiche3 = VISUELS_3[v.id];
      for (const c of ["chiffre", "libelle", "gauche", "droite"] as const) if (v[c] !== undefined && !fiche3.champs.includes(c)) res.push({ sceneId: s.id, detail: `le visuel « ${v.id} » n'écrit pas de « ${c} »${fiche3.champs.length ? ` (il écrit : ${liste(fiche3.champs)})` : " (il n'écrit rien)"} : retirez-le.` });
      if (v.id === "chiffre-entoure" && !v.chiffre) res.push({ sceneId: s.id, detail: `le visuel « chiffre-entoure » entoure un chiffre : donnez-lui « chiffre » (celui que la voix dit).` });
      if (v.ancre !== undefined && v.ancre >= mots(s.texteDit).length) res.push({ sceneId: s.id, detail: `le visuel part du mot ${v.ancre + 1}, mais le texte dit n'a que ${mots(s.texteDit).length} mots.` });
    }
    for (const s of avecBloc) {
      const b = s.gabarit!.bloc!;
      if (nbMots(b.texte) > BORNES_BLOC_3.motsMax) res.push({ sceneId: s.id, detail: `le bloc orange « ${b.texte} » fait ${nbMots(b.texte)} mots ; ${BORNES_BLOC_3.motsMax} au plus (le mot-clé, pas une phrase).` });
      if (b.compteur && b.compteur.de === b.compteur.a) res.push({ sceneId: s.id, detail: `le compteur du bloc orange « ${b.texte} » ne défile pas (de ${b.compteur.de} à ${b.compteur.a}) : retirez-le, ou donnez-lui un départ.` });
      if (b.ancre !== undefined && b.ancre >= mots(s.texteDit).length) res.push({ sceneId: s.id, detail: `le bloc orange part du mot ${b.ancre + 1}, mais le texte dit n'a que ${mots(s.texteDit).length} mots.` });
      const part = partDite(b.texte, dit);
      if (part < BORNES_GABARIT.partMotsDits) res.push({ sceneId: s.id, detail: `le bloc orange « ${b.texte} » ne reprend pas le texte dit de sa page (${Math.round(part * 100)} % de ses mots sont dits) : écrivez le mot-clé que la voix dit.` });
    }
    // Un chiffre écrit par le visuel ou le bloc est dit sur la page (« 3 » : « trois » ; « 0 » : « zéro », « aucun »).
    const ditCles = new Set([...chiffres(dit), ...mots(dit).map(cle), ...nombresDits(dit)]);
    const zeroDit = ["zero", "aucun", "aucune"].some((m) => ditCles.has(m));
    for (const s of p.scenes)
      for (const t of textesPeps(s)) for (const c of chiffres(t)) if (!ditCles.has(c) && !ditCles.has(LETTRES[c] ?? "") && !(c === "0" && zeroDit)) res.push({ sceneId: s.id, detail: `« ${t} » (visuel ou bloc orange) écrit « ${c} », que la voix ne dit pas sur cette page.` });
    // 3 blocs visibles au plus (le bloc orange en est un).
    const n = blocsVisibles(lignes.map((x) => x.l)) + Math.min(1, avecBloc.length);
    if (n > BORNES_GABARIT_3.blocsMax) res.push({ sceneId: p.scenes.at(-1)!.id, detail: `la page ${p.page} montre ${n} blocs ; ${BORNES_GABARIT_3.blocsMax} au plus (titre, phrase clé, puis un détail ou un visuel) : mettez la suite sur une page de plus.` });
    // Une preuve écrit ses lignes (« Après : … » est le côté « maintenant » de l'exemple) : la page n'est pas vide.
    if (!n && !p.scenes.some((s) => s.elements.some((e) => e.type === "preuve" && e.lignes.length))) res.push({ sceneId: premiere.id, detail: `la page ${p.page} n'écrit rien.` });
    // Titre : facultatif, court, en premier.
    const titres = de("titre");
    if (titres.length > 1) res.push({ sceneId: titres[1].s.id, detail: `la page ${p.page} a ${titres.length} titres ; un seul.` });
    for (const { l, s } of titres) {
      if (nbMots(l.texte) > BORNES_GABARIT_3.titreMots) res.push({ sceneId: s.id, detail: `le titre « ${l.texte} » fait ${nbMots(l.texte)} mots ; ${BORNES_GABARIT_3.titreMots} au plus.` });
      if (s !== premiere) res.push({ sceneId: s.id, detail: `le titre « ${l.texte} » s'écrit dans la première scène de la page ${p.page}.` });
      const avant = lignesDe(s).filter((x) => x !== l && x.ancre < l.ancre);
      if (avant.length) res.push({ sceneId: s.id, detail: `le titre « ${l.texte} » vient en premier : son ancre (${l.ancre}) doit précéder celle de « ${avant[0].texte} ».` });
    }
    if (role === "solution" && !suite && p.scenes.some((s) => s.gabarit?.numero) && !titres.length) res.push({ sceneId: premiere.id, detail: `l'étape de la page ${p.page} a un titre : le verbe de l'action (« Listez », « Classez »).` });
    // Phrase clé : une au plus.
    const phrases = de("phrase-cle");
    if (phrases.length > 1) res.push({ sceneId: phrases[1].s.id, detail: `la page ${p.page} a ${phrases.length} phrases clés ; une seule.` });
    for (const { l, s } of phrases) {
      const max = role === "accroche" ? BORNES_GABARIT_3.accrocheMots : BORNES_GABARIT_3.phraseMots;
      if (nbMots(l.texte) > max) res.push({ sceneId: s.id, detail: `la phrase clé « ${l.texte} » fait ${nbMots(l.texte)} mots ; ${max} au plus.` });
    }
    for (const { l, s } of de("detail")) if (nbMots(l.texte) > BORNES_GABARIT_3.detailMots) res.push({ sceneId: s.id, detail: `le détail « ${l.texte} » fait ${nbMots(l.texte)} mots ; ${BORNES_GABARIT_3.detailMots} au plus.` });
    for (const b of ["code", "coche"] as const) {
      const items = de(b);
      if (items.length && !suite && items.length < BORNES_GABARIT_3.listeMin) res.push({ sceneId: items[0].s.id, detail: `${NOMS_BLOCS[b]} : ${BORNES_GABARIT_3.listeMin} éléments au moins (une liste d'un seul élément est un détail).` });
      if (items.length > BORNES_GABARIT_3.listeMax) res.push({ sceneId: items[0].s.id, detail: `${NOMS_BLOCS[b]} : ${items.length} éléments ; ${BORNES_GABARIT_3.listeMax} au plus.` });
      for (const { l, s } of items) if (nbMots(l.texte) > BORNES_GABARIT_3.itemMots) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[b]} « ${l.texte} » fait ${nbMots(l.texte)} mots ; ${BORNES_GABARIT_3.itemMots} au plus.` });
    }
    if (de("code").length && de("coche").length) res.push({ sceneId: premiere.id, detail: `la page ${p.page} a une liste à pastilles ET une liste cochée : une seule liste par page.` });
    const transfos = de("transformation");
    if (transfos.length > BORNES_GABARIT_3.transformationsMax) res.push({ sceneId: transfos[0].s.id, detail: `la page ${p.page} a ${transfos.length} transformations ; ${BORNES_GABARIT_3.transformationsMax} au plus.` });
    for (const { l, s } of transfos) {
      const c = cotesTransformation(l.texte);
      if (c && (nbMots(c.de) > BORNES_GABARIT_3.coteMots || nbMots(c.vers) > BORNES_GABARIT_3.coteMots)) res.push({ sceneId: s.id, detail: `la transformation « ${l.texte} » : ${BORNES_GABARIT_3.coteMots} mots au plus de chaque côté de la flèche.` });
    }
    const idees = de("idee-recue");
    if (idees.length > 1) res.push({ sceneId: idees[1].s.id, detail: `une seule idée reçue par page.` });
    for (const { l, s } of idees) if (nbMots(l.texte) > BORNES_GABARIT_3.ideeMots) res.push({ sceneId: s.id, detail: `l'idée reçue « ${l.texte} » fait ${nbMots(l.texte)} mots ; ${BORNES_GABARIT_3.ideeMots} au plus.` });
    for (const b of ["avant", "apres"] as const) for (const { l, s } of de(b)) if (nbMots(l.texte) > BORNES_GABARIT_3.comparaisonMots) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[b]} « ${l.texte} » fait ${nbMots(l.texte)} mots ; ${BORNES_GABARIT_3.comparaisonMots} au plus.` });
    // Barré seulement une idée reçue explicitement étiquetée : aucune autre ligne barrée.
    for (const { l, s } of lignes) if (l.marque === "barre" && l.bloc !== "idee-recue") res.push({ sceneId: s.id, detail: `« ${l.texte} » est barrée : au style « ${STYLE_GABARIT_3} », seule une idée reçue (bloc « idee-recue », étiquetée « Idée reçue ») est barrée.` });
    for (const s of p.scenes)
      for (const g of s.elements) {
        if (g.type !== "geste" || g.geste !== "barrer") continue;
        const cible = lignesDe(s).find((l) => l.id === g.cibleId);
        if (cible?.bloc !== "idee-recue") res.push({ sceneId: s.id, detail: `le geste « barrer » vise « ${cible?.texte ?? g.cibleId} » : seule une idée reçue est barrée.` });
      }
    // Partie par partie.
    if (role === "accroche" && !suite) {
      const s0 = fiche.scenes[0];
      const accroche = phrases.find((x) => x.s === s0 && x.l.ancre === 0);
      if (!accroche) res.push({ sceneId: s0.id, detail: `l'accroche (la douleur) est la phrase clé de la page 1, au mot 0 : elle est écrite en très grand DÈS LA PREMIÈRE IMAGE (elle sert de miniature).` });
    }
    if (role === "exemple" && !suite) {
      const groupe = [p];
      for (let j = i + 1; j < pages.length && estPageSuite(pages, j); j++) groupe.push(pages[j]);
      const ls = groupe.flatMap((x) => x.scenes.flatMap((s) => lignesDe(s)));
      const preuves = groupe.flatMap((x) => x.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "preuve" ? e.lignes : []))));
      const nAvant = ls.filter((l) => l.bloc === "avant").length + preuves.filter((l) => /^\s*avant\s*:/iu.test(l)).length;
      const nApres = ls.filter((l) => l.bloc === "apres").length + preuves.filter((l) => /^\s*apr[eè]s\s*:/iu.test(l)).length;
      if ((nAvant || nApres) && (nAvant !== 1 || nApres !== 1)) res.push({ sceneId: premiere.id, detail: `l'exemple écrit un « avant » ET un « après » (un de chaque).` });
    }
    if (role === "retenir" && !suite) {
      // 15/10 (gabarit cadré) : « À retenir » écrit l'IDÉE, en une phrase ; la liste des étapes n'est plus demandée.
      const items = de("liste");
      if (!phrases.length && !items.length && !de("detail").length) res.push({ sceneId: premiere.id, detail: `« À retenir » écrit l'idée de la vidéo : une ligne « bloc » « phrase-cle », l'idée en une phrase reprise du texte dit.` });
      if (items.length > BORNES_GABARIT_3.retenirMax) res.push({ sceneId: premiere.id, detail: `« À retenir » : ${items.length} éléments ; ${BORNES_GABARIT_3.retenirMax} au plus.` });
    }
    if (role === "appel") {
      const appels = de("appel");
      if (!appels.length && !suite) res.push({ sceneId: premiere.id, detail: `la page d'appel écrit la phrase d'appel en grand : une ligne « bloc » « appel » (« Réservez un appel de diagnostic »).` });
      if (appels.length > 1) res.push({ sceneId: appels[1].s.id, detail: `un seul appel.` });
    }
    for (const { l, s } of de("appel")) if (s !== derniere && role !== "appel") res.push({ sceneId: s.id, detail: `l'appel « ${l.texte} » s'écrit sur la page d'appel, à la fin.` });
    // Le texte écrit reprend le texte dit ; aucun nombre écrit qui ne soit dit.
    for (const { l, s } of [...phrases, ...de("detail"), ...idees]) {
      const part = partDite(l.texte, dit);
      if (part < BORNES_GABARIT.partMotsDits) res.push({ sceneId: s.id, detail: `${NOMS_BLOCS[l.bloc!]} « ${l.texte} » ne reprend pas le texte dit de sa page (${Math.round(part * 100)} % de ses mots sont dits) : écrivez les mots que la voix dit.` });
    }
    // Un chiffre dit n'est jamais retiré de l'écrit en laissant une phrase tronquée ou fausse (vidéo d'essai
    // v-667edcd8e3a8 : « dix minutes » écrit « des minutes », « Trois tâches » écrit « Tâches »). Sur l'exemple
    // illustratif, la mise en page le rétablit en chiffres (la mention le signale) ; ailleurs, la fiche est refusée.
    if (role !== "exemple")
      for (const { l, s } of lignes) {
        if (l.bloc === "appel") continue;
        const retires = chiffresRetires(l.texte, dit);
        for (const x of retires)
          res.push({ sceneId: s.id, detail: `« ${l.texte} » a retiré « ${x.dit.toLowerCase()} », que la voix dit (« ${x.dit.toLowerCase()} ${x.mot.toLowerCase()} ») : la phrase écrite n'est jamais tronquée ni fausse. Sans source pour ce chiffre, reformulez-la en phrase complète et juste, sans quantité (« Les ${x.mot.toLowerCase()} … »), ou écrivez le chiffre avec un élément « chiffre » sourcé.` });
        // Un décompte annoncé (« Trois réflexes ») n'est pas un chiffre à sourcer : il reste écrit (vidéo v-b2d772d28b97).
        for (const x of decomptesRetires(l.texte, dit))
          if (!retires.some((r) => cle(r.mot) === cle(x.mot))) res.push({ sceneId: s.id, detail: `« ${l.texte} » a retiré le décompte « ${x.dit.toLowerCase()} ${x.mot.toLowerCase()} » que la voix annonce : un décompte n'est pas un chiffre à sourcer, il reste écrit (« ${x.dit.charAt(0).toUpperCase()}${x.dit.slice(1).toLowerCase()} ${x.mot.toLowerCase()}… » ou « ${x.valeur} ${x.mot.toLowerCase()}… »).` });
      }
    const ditChiffres = new Set([...chiffres(dit), ...mots(dit).map(cle), ...nombresDits(dit)]);
    for (const { l, s } of lignes) {
      if (l.bloc === "liste" || l.bloc === "appel") continue;
      for (const c of chiffres(l.texte)) if (!ditChiffres.has(c) && !ditChiffres.has(LETTRES[c] ?? "")) res.push({ sceneId: s.id, detail: `« ${l.texte} » écrit « ${c} », que la voix ne dit pas sur cette page.` });
    }
    // Étapes numérotées 1, 2, 3…
    if (role === "solution" && !suite) {
      const numeros = p.scenes.flatMap((s) => (s.gabarit?.numero ? [{ s, n: s.gabarit.numero.n }] : []));
      if (numeros.length > 1) res.push({ sceneId: numeros[1].s.id, detail: `la page ${p.page} porte ${numeros.length} numéros d'étape ; un seul par page.` });
      if (numeros[0]) {
        if (numeros[0].n !== etapeAttendue) res.push({ sceneId: numeros[0].s.id, detail: `l'étape de la page ${p.page} porte le numéro ${numeros[0].n} ; ${etapeAttendue} est attendu.` });
        etapeAttendue = numeros[0].n + 1;
      }
    }
  });
  if (!pages.length) res.push({ detail: "la fiche n'a aucune page." });
  return res;
}

/** Libellé de l'étiquette de partie (écrit en haut de la page). */
export function libellePartie(role: RolePage | undefined): string {
  switch (role) {
    case "accroche":
      return "ACCROCHE";
    case "douleur":
      return "LA DOULEUR";
    case "solution":
      return "LA SOLUTION";
    case "exemple":
      return "EXEMPLE";
    case "retenir":
      return "À RETENIR";
    case "appel":
      return "À VOUS";
    default:
      return "";
  }
}
