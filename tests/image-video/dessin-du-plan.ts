/**
 * Lecture du plan de rendu (blocs transmis aux compositions), sans rien supposer des contrôles : ce que chaque bloc
 * dessine, et ce que les contrôles comptent sans qu'il soit dessiné (règle d'or, `rien-de-compte-sans-dessin.test.ts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CarteImage } from "@/domaine/image-video/carte";
import { compteRythme } from "@/moteurs/montage-image-video/controles-scene";
import type { BlocRenduIV, ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";

const TOLERANCE = 0.4;

const norme = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9%€$]+/g, " ")
    .trim()
    // Un chiffre dit en lettres (« Trois outils », « Zéro erreur », « Le premier ») est le même que son nombre.
    .replace(/\b[a-z0-9]+\b/g, (m) => NOMBRES[m] ?? m);
const NOMBRES: Record<string, string> = { zero: "0", un: "1", une: "1", premier: "1", premiere: "1", "1er": "1", deux: "2", trois: "3", quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9", dix: "10" };

const CLES_HEURE = new Set(["t", "t0", "debut", "frappe", "apparition", "debutCoches", "finCoches", "bascule", "tValeur"]);
const CLES_NOMBRE = new Set(["nombre", "quantite", "compte", "valeur", "cochees"]);
const LISTES_HEURE = new Set(["heures", "heuresLignes", "mots", "chutes", "distinctions"]);

/** Les champs des données d'un écran de fin (`DonneesFinIV`) qu'un composant de fin peut dessiner. */
const CHAMPS_FIN = ["phrase", "mots", "heures", "lignes", "boucle", "heure", "deja", "chiffre", "part"] as const;

/**
 * Parmi les données d'un bloc `variete` d'axe `fin`, ce que le composant dessine VRAIMENT : les champs `d.<champ>` que lit
 * son source (`studio-rendu/compositions/image-video/variete/fin/fin-c.tsx`, `fin-d.tsx`, commentaires retirés). Un
 * texte posé dans les données mais jamais passé au composant n'est pas dessiné (relecture du 23/10/2026 : FIN-C ne
 * passait que `boucle`, `heure`, `deja` ; la phrase-choc, présente dans les données, comptait à tort comme dessinée).
 */
export function champsDessinesParLaFin(code: string): string[] {
  const source = readFileSync(join(process.cwd(), `studio-rendu/compositions/image-video/variete/fin/${code.toLowerCase()}.tsx`), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return CHAMPS_FIN.filter((c) => new RegExp(`\\bd\\.${c}\\b`).test(source));
}

/**
 * Quand la boucle de FIN-C porte la phrase-choc, l'ouverture reprise ne dessine plus certains textes (la phrase les
 * remplace : `ouverture/ouv-a.tsx` le libellé du résultat, `ouv-d.tsx` les mots de l'accroche, `ouv-e.tsx` le libellé et le
 * détail du gros plan, `ouv-c.tsx` le chiffre « déjà dit » de l'horloge) : ils ne comptent plus comme dessinés.
 */
function boucleSansTextesRemplaces(boucle: unknown): unknown {
  const o = boucle as { code?: string; resultat?: object; mots?: unknown[]; detail?: object; heure?: { texte?: string } | null; objet?: object } | null;
  if (!o || typeof o !== "object") return boucle;
  if (o.code === "OUV-A") return { ...o, resultat: { ...o.resultat, libelle: null } };
  // OUV-C horloge (avec une heure) : ni l'heure écrite (« 23h14 ») ni le libellé de l'objet ne sont dessinés (la phrase prend la place du chiffre).
  if (o.code === "OUV-C" && o.heure) return { ...o, heure: { ...o.heure, texte: "" }, objet: { ...o.objet, libelle: "", chiffre: null } };
  if (o.code === "OUV-D") return { ...o, mots: [] };
  if (o.code === "OUV-E") return { ...o, detail: { ...o.detail, libelle: "", detail: null } };
  return boucle;
}

/** Ce que dessine un bloc : instants (absolus), textes (normalisés), nœuds parlés (toile). */
interface Dessin {
  debut: number;
  fin: number;
  instants: number[];
  textes: string[];
  noeuds: Set<string>;
  /**
   * Bloc `variete` qui redessine une phrase en IMAGE (ouverture, duel de chiffres : maquettes validées par Will, même
   * voix) : un texte sans chiffre ni nœud y est montré par l'image, pas par ses mots ; le changement compté reste exigé.
   */
  image: boolean;
}

function dessinDe(b: BlocRenduIV): Dessin {
  const d: Dessin = { debut: b.debut, fin: b.fin, instants: [b.debut], textes: [], noeuds: new Set(), image: b.sorte === "variete" && (b.axe === "ouverture" || b.axe === "chiffres") };
  const parcourir = (v: unknown, cle: string, decalage: number, sansSchema: boolean) => {
    if (typeof v === "string") d.textes.push(norme(v));
    else if (typeof v === "number") {
      if (CLES_HEURE.has(cle)) d.instants.push(decalage + v);
      if (CLES_NOMBRE.has(cle)) d.textes.push(String(v));
    } else if (Array.isArray(v)) {
      // Texte posé mot à mot (blocs `variete` : ouverture, écrans de texte) : la phrase recomposée est écrite aussi.
      const mots = v.filter((x): x is { texte: string } => !!x && typeof x === "object" && typeof (x as { texte?: unknown }).texte === "string");
      if (mots.length > 1) d.textes.push(norme(mots.map((x) => x.texte).join(" ")));
      for (const x of v) {
        if (typeof x === "number" && LISTES_HEURE.has(cle)) d.instants.push(decalage + x);
        else parcourir(x, cle, decalage, sansSchema);
      }
    } else if (v && typeof v === "object") {
      // Coches d'une nuée : elles tombent en continu de la première à la dernière.
      const o = v as { debutCoches?: number; finCoches?: number };
      if (typeof o.debutCoches === "number" && typeof o.finCoches === "number") for (let x = o.debutCoches; x <= o.finCoches; x += 0.1) d.instants.push(decalage + x);
      for (const [k, x] of Object.entries(v)) if (!(sansSchema && k === "schema")) parcourir(x, k, decalage, sansSchema);
    }
  };
  if (b.sorte === "toile") {
    const p = b.proprietes;
    // La toile ne montre d'un nœud que ce qu'elle fait parler (ou ce qu'elle reprend « déjà vu », ou une vue d'ensemble).
    for (const m of [...p.mots, ...(p.separations ?? []), ...(p.coches ?? []), ...(p.accents ?? [])]) {
      d.noeuds.add(m.noeud);
      d.instants.push(b.debut + m.t);
    }
    for (const n of p.dejaVus ?? []) d.noeuds.add(n);
    for (const e of p.ensembles ?? []) {
      d.instants.push(b.debut + e.debut, b.debut + e.fin);
      for (const n of p.schema.noeuds) d.noeuds.add(n.id);
    }
    for (const e of p.entetes ?? []) {
      d.instants.push(b.debut + e.debut);
      d.textes.push(norme(e.etiquette), norme(e.titre));
    }
    for (const n of p.schema.noeuds) if (d.noeuds.has(n.id)) d.textes.push(norme(`${n.libelle} ${n.detail ?? ""}`));
  } else if (b.sorte === "ecran") {
    const e = b.ecran;
    d.instants.push(e.debutMs / 1000, ...e.evenements.map((x) => x.ms / 1000));
    parcourir({ ...e, evenements: [], debutMs: 0, finMs: 0 }, "", 0, false);
  } else if (b.sorte === "moments") {
    // Une vue d'ensemble montre toute la carte ; les autres moments, leurs seuls textes.
    for (const m of b.moments) {
      if (m.sorte === "ensemble") for (const n of m.schema.noeuds) d.noeuds.add(n.id);
      parcourir(m, "", b.debut, m.sorte !== "ensemble");
    }
  } else if (b.sorte === "variete" && b.axe === "fin") {
    // Fin de variété : seuls comptent les champs que le composant reçoit et dessine.
    const donnees = (b.donnees ?? {}) as Record<string, unknown>;
    const champs = champsDessinesParLaFin(b.code);
    const phraseDansLaBoucle = b.code === "FIN-C" && champs.includes("phrase");
    for (const c of champs) {
      if (!(c in donnees) || (phraseDansLaBoucle && c === "deja")) continue;
      parcourir(c === "boucle" && phraseDansLaBoucle ? boucleSansTextesRemplaces(donnees[c]) : donnees[c], c, b.debut, true);
    }
  } else parcourir(b, "", b.debut, true);
  return d;
}

/** Mots porteurs d'un texte (4 lettres et plus) : un texte affiché « nomme » un nœud s'il en partage un. */
const porteurs = (s: string) => norme(s).split(" ").filter((m) => m.length >= 4);

/**
 * Ce que les contrôles comptent sans que le plan ne le dessine (vide = la règle tient) :
 *  - Q12 : tout événement portant un nœud (même un mouvement de caméra : le contrôle le compte) a ce nœud dans son
 *    bloc : parlé par la toile, ou son libellé / détail / sous-élément écrit, ou le texte de l'événement écrit ET
 *    nommant ce nœud ;
 *  - Q13 : un événement visible qui montre un chiffre (même un en-tête, qui ne compte pas pour le rythme) a son texte
 *    écrit dans son bloc, à cette heure ;
 *  - Q14 : un événement qui compte pour le rythme a un changement rendu à son heure dans son bloc (± 0,4 s), et son
 *    texte, s'il en a un et aucun nœud, est écrit dans ce bloc.
 */
export function comptesNonDessines(r: ResultatMiseEnSceneIV, carte: CarteImage): string[] {
  const dessins = r.ligne.blocs.map(dessinDe);
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const dessinA = (t: number) => dessins.find((d) => t >= d.debut - 1e-6 && t < d.fin - 1e-6) ?? dessins.at(-1)!;
  const ecrit = (d: Dessin, s: string) => {
    const x = norme(s);
    return x.length >= 2 && d.textes.some((y) => ` ${y} `.includes(` ${x} `));
  };
  const mots = (d: Dessin) => new Set(d.textes.flatMap((y) => y.split(" ")));
  // Un texte est écrit tel quel (ou une de ses parties « étiquette|titre ») ; un chiffre l'est si chacun de ses nombres
  // est un nombre entier d'un mot du bloc (« 3 heures » affiché « 3h », « *20* e-mails » affiché par le compteur 20,
  // « *23:14* » affiché « 23h14 »).
  const texteEcrit = (d: Dessin, texte: string, chiffre = false, cles: readonly string[] = []) => {
    if (texte.split("|").some((t) => ecrit(d, t))) return true;
    // Chiffre posé par sa clé (bloc `variete` : « *23:14* » dit, « 23h14 » écrit sur la carte, clé « 1394|heure »).
    if (chiffre && cles.length > 0 && cles.every((c) => d.textes.includes(norme(c)))) return true;
    const nombres = norme(texte).match(/\d+/g) ?? [];
    return chiffre && nombres.length > 0 && nombres.every((x) => [...mots(d)].some((m) => new RegExp(`(^|\\D)${x}(\\D|$)`).test(m)));
  };
  // Tous les mots porteurs d'une forme du nœud sont écrits dans le bloc (« 80 % répondus automatiquement » : la sortie
  // « Répondus automatiquement » et le titre « 16/20 = 80 % »).
  const nomsEcrits = (d: Dessin, f: string) => porteurs(f).length > 0 && porteurs(f).every((m) => mots(d).has(m));
  const manques: string[] = [];
  for (const e of r.ligne.evenements) {
    if (e.instantSec > r.ligne.finVoixSec + 1e-6) continue;
    const d = dessinA(e.instantSec);
    const n = e.ref ? parId.get(e.ref) : undefined;
    const quoi = `${e.ecran ?? "?"} ${e.genre}${e.ref ? ` ${e.ref}` : ""} à ${e.instantSec} s`;
    if (n && !n.photoPersonnes) {
      // Formes écrites d'un nœud : libellé (sans « Alerte » : la source de la notification), détail, sous-éléments ; le
      // premier mot du libellé seulement s'il est un texte entier du bloc (le moteur « IA » de l'entonnoir).
      const premier = norme(n.libelle).split(" ")[0];
      const formes = [n.libelle, n.libelle.replace(/^alertes?\s+/i, ""), n.detail ?? "", ...(n.sousElements ?? []), ...(d.textes.includes(premier) ? [premier] : [])].filter((x) => norme(x).length >= 2);
      // Le texte de l'événement, écrit dans le bloc, nomme le nœud ; ou montre un chiffre de ce nœud (écran « chiffre »).
      const nomme = !!e.texte && texteEcrit(d, e.texte, e.chiffres.length > 0) && (e.chiffres.length > 0 || porteurs(e.texte).some((m) => formes.some((f) => porteurs(f).includes(m))));
      if (!d.noeuds.has(n.id) && !formes.some((f) => ecrit(d, f) || nomsEcrits(d, f)) && !nomme) manques.push(`${quoi} : le bloc « ${n.libelle} » n'est pas dans le plan`);
    } else if (e.texte && e.visible && e.genre !== "camera" && !texteEcrit(d, e.texte, e.chiffres.length > 0, e.chiffres) && !(d.image && e.chiffres.length === 0)) manques.push(`${quoi} : « ${e.texte} » n'est pas dans le plan`);
    if (compteRythme(e) && !d.instants.some((t) => Math.abs(t - e.instantSec) <= TOLERANCE)) manques.push(`${quoi} : aucun changement rendu à cette heure`);
  }
  return manques;
}
