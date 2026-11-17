/**
 * C9-36a — règles fixes « ce qui est dit → quel objet » (côté Studio, jamais lues par le rendu).
 * Sans modèle ni appel à Claude : nombre dit → gros chiffre, « étape n » → étape, « d'abord … ensuite … enfin » → cartes,
 * « c'est fait / validé / terminé » → coche. Au plus `OBJETS_PAR_VIDEO_MAX`, jamais deux qui se chevauchent.
 * Rien n'est inventé : les valeurs et les mots sont recopiés de ce qui est dit, et chaque proposition passe `garderObjet`.
 * `permis` absent ou vide = éteint (`[]`). Pure, sans exception. Rien ne l'appelle encore (C9-36b). Non exportée par `index.ts`.
 */
import { faitsDuScript } from "../faits-script";
import { OBJET_GROS_CHIFFRE } from "../motion/petits-objets/gros-chiffre";
import { OBJET_ETAPE } from "../motion/petits-objets/etapes";
import { OBJET_CARTES_COCHE } from "../motion/petits-objets/cartes";
import { OBJET_COCHE } from "../motion/petits-objets/marques";
import { MOTS_MAX, OBJETS_PAR_VIDEO_MAX, type DefinitionObjet, type IdPetitObjet } from "../motion/petits-objets/contrat";
import type { MotMinute } from "../plan-scenes/schema";
import { garderObjet } from "./garde";

export interface PropositionObjet {
  id: IdPetitObjet;
  debutSec: number;
  finSec: number;
  parametres: unknown;
  /** Nom de la règle qui a déclenché la proposition. */
  regle: string;
}

/** Zones en % du cadre (surface ≤ SURFACE_MAX). */
const BOITE_CARTES = { x: 20, y: 20, largeur: 60, hauteur: 60 };
const BOITE_COCHE = { x: 35, y: 30, largeur: 30, hauteur: 30 };
const ETAPES_MAX = 9;

const nu = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
const propre = (s: string): string => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const fermeLaPhrase = (s: string): boolean => /[.!?…;:,]\s*$/.test(s);

const ORDINAUX: Record<string, number> = {
  premiere: 1, premier: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7, huitieme: 8, neuvieme: 9,
};
const CARDINAUX: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9 };

/** Un numéro d'étape lu dans un mot (« 3 », « trois »), ou null. */
function numero(w: string): number | null {
  if (/^\d{1,2}$/.test(w)) return Number(w);
  return CARDINAUX[w] ?? null;
}

interface Candidat {
  ordre: number;
  premier: number;
  dernier: number;
  id: IdPetitObjet;
  def: DefinitionObjet<unknown>;
  parametres: unknown;
  regle: string;
}

function chercher(mots: readonly MotMinute[]): Candidat[] {
  const w = mots.map((m) => nu(m.texte));
  const bruts = mots.map((m) => m.texte);
  const sortie: Candidat[] = [];
  const surEtape = new Set<number>();

  // 1. Nombres dits (chiffres ou en lettres), via faitsDuScript. `ordre` 1 mais ajoutés après les étapes pour exclure leurs mots.
  // 2. Étapes : « étape n », « n-ième étape », éventuellement « sur N ».
  const dites: { n: number; premier: number; dernier: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    if (!/^(l|d)?etapes?$/.test(w[i]!) || w[i]!.endsWith("s")) continue;
    const avant = i > 0 ? ORDINAUX[w[i - 1]!] : undefined;
    const apres = i + 1 < w.length ? numero(w[i + 1]!) : null;
    if (avant !== undefined) dites.push({ n: avant, premier: i - 1, dernier: i });
    else if (apres !== null) dites.push({ n: apres, premier: i, dernier: i + 1 });
  }
  const etapesDites = dites.filter((d) => d.n >= 1 && d.n <= ETAPES_MAX);
  const nGlobal = etapesDites.reduce((m, d) => Math.max(m, d.n), 0);
  for (const d of etapesDites) {
    let dernier = d.dernier;
    let total = 0;
    // « étape 2 sur 4 » : le total est dit.
    if (w[dernier + 1] === "sur") {
      const t = numero(w[dernier + 2] ?? "");
      if (t !== null && t >= d.n && t <= ETAPES_MAX) { total = t; dernier += 2; }
    }
    // Sinon le total est la plus haute étape dite dans la vidéo (jamais un nombre qui n'a pas été dit).
    const N = total || nGlobal;
    for (let k = d.premier; k <= dernier; k++) surEtape.add(k);
    sortie.push({ ordre: 2, premier: d.premier, dernier, id: "objet-etape", def: OBJET_ETAPE as DefinitionObjet<unknown>, parametres: { n: d.n, N }, regle: "etape-dite" });
  }

  // Nombres dits.
  for (const f of faitsDuScript(mots as MotMinute[])) {
    if (f.type !== "nombre") continue;
    const { premier, dernier } = f.mots;
    let pris = false;
    for (let k = premier; k <= dernier; k++) if (surEtape.has(k)) pris = true;
    if (pris) continue;
    const parametres: { valeur: number; unite?: string } = { valeur: f.valeur };
    if (f.unite === "%") parametres.unite = "%";
    sortie.push({ ordre: 1, premier, dernier, id: "objet-gros-chiffre", def: OBJET_GROS_CHIFFRE as DefinitionObjet<unknown>, parametres, regle: "nombre-dit" });
  }

  // 3. Énumération : « d'abord X, ensuite Y, (puis Z,) enfin W » — 2 à 4 éléments, chacun de 1 à MOTS_MAX mots.
  const marqueurs: { idx: number; debut: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    const m = w[i];
    if (m === "dabord" || (m === "abord" && w[i - 1] === "d")) marqueurs.push({ idx: i, debut: m === "abord" ? i - 1 : i });
    else if (m === "ensuite" || m === "enfin") marqueurs.push({ idx: i, debut: i });
  }
  // Une énumération commence à « d'abord » et se termine à « enfin » (ou à la dernière série « ensuite »).
  for (let a = 0; a < marqueurs.length; a++) {
    const m0 = marqueurs[a]!;
    if (w[m0.idx] === "enfin" || w[m0.idx] === "ensuite") continue;
    const serie = [m0];
    for (let b = a + 1; b < marqueurs.length; b++) {
      const mb = marqueurs[b]!;
      if (w[mb.idx] === "dabord" || w[mb.idx] === "abord") break;
      serie.push(mb);
      if (w[mb.idx] === "enfin") break;
    }
    if (serie.length < 2 || serie.length > 4) continue;
    const cartes: string[] = [];
    let ok = true;
    let dernier = m0.idx;
    for (let s = 0; s < serie.length && ok; s++) {
      const debut = serie[s]!.idx + 1;
      const limite = s + 1 < serie.length ? serie[s + 1]!.debut : bruts.length;
      let fin = debut;
      // L'élément s'arrête à la ponctuation dite ou avant le marqueur suivant.
      while (fin < limite && !fermeLaPhrase(bruts[fin]!)) fin++;
      fin = Math.min(fin, limite - 1);
      if (s + 1 === serie.length && fin - debut + 1 > MOTS_MAX) ok = false;
      const morceau = bruts.slice(debut, fin + 1).map(propre).filter(Boolean);
      const texte = morceau.join(" ");
      const taille = texte.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
      if (!texte || taille > MOTS_MAX) { ok = false; break; }
      cartes.push(texte);
      dernier = fin;
    }
    if (!ok || cartes.length !== serie.length) continue;
    sortie.push({ ordre: 3, premier: m0.debut, dernier, id: "objet-cartes-coche", def: OBJET_CARTES_COCHE as DefinitionObjet<unknown>, parametres: { boite: BOITE_CARTES, cartes }, regle: "enumeration-dite" });
    a += serie.length - 1;
  }

  // 4. Coche : « c'est fait », « validé », « terminé ».
  for (let i = 0; i < w.length; i++) {
    let dernier = -1;
    if (w[i] === "cest" && w[i + 1] === "fait") dernier = i + 1;
    else if (w[i] === "c" && w[i + 1] === "est" && w[i + 2] === "fait") dernier = i + 2;
    else if (/^(validee?s?|termine[es]?)$/.test(w[i]!)) dernier = i;
    if (dernier < 0) continue;
    sortie.push({ ordre: 4, premier: i, dernier, id: "objet-coche", def: OBJET_COCHE as DefinitionObjet<unknown>, parametres: { boite: BOITE_COCHE }, regle: "fait-dit" });
    i = dernier;
  }
  return sortie;
}

/** Instants (s) de la proposition : du premier mot à la fin du dernier, bornés par la durée permise de l'objet. */
function fenetre(c: Candidat, mots: readonly MotMinute[]): { debutSec: number; finSec: number } {
  const debutSec = mots[c.premier]!.debutMs / 1000;
  const finMot = mots[c.dernier]!.finMs / 1000;
  const { min, max } = c.def.dureeSec;
  return { debutSec, finSec: debutSec + Math.min(max, Math.max(min, finMot - debutSec)) };
}

export function objetsDepuisMots(mots: readonly MotMinute[], options?: { permis?: readonly string[] }): PropositionObjet[] {
  try {
    const permis = Array.isArray(options?.permis) ? options!.permis!.filter((p): p is string => typeof p === "string") : [];
    if (permis.length === 0 || !Array.isArray(mots) || mots.length === 0) return [];
    for (const m of mots) {
      if (typeof m?.texte !== "string" || !Number.isFinite(m.debutMs) || !Number.isFinite(m.finMs)) return [];
    }
    const candidats = chercher(mots).filter((c) => permis.includes(c.id));
    // Priorité dans l'ordre des règles, puis par temps.
    candidats.sort((a, b) => a.ordre - b.ordre || a.premier - b.premier);
    const retenus: (PropositionObjet & { premier: number })[] = [];
    for (const c of candidats) {
      if (retenus.length >= OBJETS_PAR_VIDEO_MAX) break;
      if (c.def.valider(c.parametres) === null) continue;
      if (garderObjet(c.def, c.parametres, { mots: mots as MotMinute[], premier: c.premier, dernier: c.dernier }) !== "ok") continue;
      const { debutSec, finSec } = fenetre(c, mots);
      if (retenus.some((r) => debutSec < r.finSec && r.debutSec < finSec)) continue;
      retenus.push({ id: c.id, debutSec, finSec, parametres: c.parametres, regle: c.regle, premier: c.premier });
    }
    return retenus.sort((a, b) => a.debutSec - b.debutSec).map(({ premier: _p, ...r }) => r);
  } catch {
    return [];
  }
}
