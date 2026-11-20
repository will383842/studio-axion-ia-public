/**
 * LECTURE D'UNE CAPTURE DU TABLEAU DE BORD (G4-07, partie préparée) — code PUR : la requête à envoyer plus tard et la
 * lecture de la réponse en donnée BROUILLON au schéma `tableau-de-bord.v1`. Chaque chiffre reste à confirmer par Williams.
 * Rien ne l'appelle : aucun client, aucun rôle enregistré, aucun coût. Le branchement est une autre fiche, payante.
 * Seuls des `import type` viennent des fournisseurs.
 */
import type { ImageClaude, RequeteClaude } from "@/fournisseurs/claude/client";
import { lireTableauDeBord, type TableauDeBord } from "./types";

/** Sortie maximale d'une lecture (même valeur que la lecture d'image voisine). */
export const MAX_JETONS_LECTURE_CAPTURE = 8000;
/** Côté long maximal de la capture, en pixels (valeur recopiée ; un test l'égale à celle du voisin). */
export const COTE_MAX_CAPTURE = 1568;

export const CONSIGNE_LECTURE_CAPTURE = `Tu lis UNE capture d'écran d'un tableau de bord et tu recopies ses chiffres. Tu ne fais pas d'analyse.

Règles, dans l'ordre :
1. Recopie seulement les chiffres VISIBLES sur la capture, tels qu'ils sont écrits. N'en déduis aucun : pas de somme, pas de moyenne, pas de pourcentage que tu aurais calculé toi-même, pas de valeur « probable ».
2. Un chiffre illisible, coupé ou caché : ne l'invente pas, laisse-le de côté (l'indicateur ou le point n'apparaît pas).
3. Un nombre garde son sens : « 1 250 » s'écrit 1250, « 12,5 % » s'écrit 12.5 avec l'unité « % ». La précision est le nombre de décimales affichées.
4. Une série n'existe que si la capture montre un graphique avec au moins 2 points lisibles ; chaque point porte son repère (date, jour, mois) tel qu'écrit.
5. Un calcul n'est rempli que si la capture l'affiche elle-même ; sinon la liste des calculs reste vide.
6. Pas d'adresse courriel, pas de numéro de téléphone, pas de nom de personne : ne recopie aucune donnée personnelle.
7. Les textes sont courts, en français, sans balise ni mise en forme.

Réponse : UN SEUL objet JSON, sans texte autour, au schéma « tableau-de-bord.v1 » :
{
  "version": "tableau-de-bord.v1",
  "titre": texte (80 caractères au plus),
  "periode": { "debut": "AAAA-MM-JJ", "fin": "AAAA-MM-JJ", "libelle": texte },
  "source": texte (60 caractères au plus ; le nom de l'outil visible sur la capture),
  "indicateurs": [ { "id": "minuscules-et-tirets", "libelle": texte, "valeur": nombre, "unite": texte, "precision": entier de 0 à 4, "sens": "hausse-bonne" ou "baisse-bonne" } ] (12 au plus),
  "series": [ { "id": "minuscules-et-tirets", "libelle": texte, "unite": texte, "points": [ { "x": texte, "valeur": nombre } ] } ] (6 au plus, 2 à 12 points chacune),
  "comparaisons": [ { "avant": "id d'un indicateur", "apres": "id d'un indicateur" } ],
  "alertes": [ { "texte": texte, "indicateurId": "id d'un indicateur" } ],
  "calculs": [ { "id": "minuscules-et-tirets", "formule": "id + id", "resultat": nombre } ]
}
Aucun autre champ. Les identifiants sont uniques. Williams relira chaque chiffre : mieux vaut en omettre un que se tromper.`;

export type ImageCapture = { base64: string; type: "image/png" | "image/jpeg"; largeur: number; hauteur: number };

/**
 * Requête d'une lecture : 1 capture, 1 message. Refuse (sans lever) une image trop grande ou aux dimensions fausses ;
 * la réduction à 1 568 px reste à la charge de l'appelant futur.
 */
export function requeteLectureCapture(image: ImageCapture, modele: string): RequeteClaude | { refus: string } {
  const { largeur, hauteur } = image ?? ({} as Partial<ImageCapture>);
  const valide = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
  if (!image || !image.base64 || !valide(largeur) || !valide(hauteur)) return { refus: "La capture est illisible : image ou dimensions absentes." };
  if (Math.max(largeur, hauteur) > COTE_MAX_CAPTURE) {
    return { refus: `La capture mesure ${largeur} × ${hauteur} px : réduis-la à ${COTE_MAX_CAPTURE} px de côté long au plus.` };
  }
  const jointe: ImageClaude = { type: image.type, base64: image.base64, legende: `Capture du tableau de bord (${largeur} × ${hauteur} px).` };
  return {
    modele,
    maxTokens: MAX_JETONS_LECTURE_CAPTURE,
    effort: "medium",
    systeme: [{ texte: CONSIGNE_LECTURE_CAPTURE }],
    messages: [{ role: "user", contenu: "Recopie les chiffres de cette capture au schéma demandé.", images: [jointe] }],
    json: true,
  };
}

/** Un chiffre à confirmer (même forme que celle de l'écran de relecture ; l'égalité des deux listes est testée). */
export type ChiffreARelire = { cle: string; libelle: string; valeur: number; unite: string };

/**
 * Copie locale de la liste des chiffres montrables : le garde du voisin interdit à tout fichier de src/ de citer
 * l'écran de relecture hors de son composant. Un test compare cette liste à celle du voisin.
 */
function tousLesChiffres(d: TableauDeBord): ChiffreARelire[] {
  const liste: ChiffreARelire[] = [];
  for (const i of d.indicateurs) liste.push({ cle: `indicateur:${i.id}`, libelle: i.libelle, valeur: i.valeur, unite: i.unite });
  for (const s of d.series) s.points.forEach((p, n) => liste.push({ cle: `point:${s.id}:${n}`, libelle: `${s.libelle} · ${p.x}`, valeur: p.valeur, unite: s.unite }));
  for (const c of d.calculs) liste.push({ cle: `calcul:${c.id}`, libelle: c.formule, valeur: c.resultat, unite: "" });
  return liste;
}

export type LectureCapture = { ok: true; brouillon: TableauDeBord; aRelire: ChiffreARelire[] } | { ok: false; raisons: string[] };

/** Lit la réponse : brouillon validé par le schéma, TOUS les chiffres à confirmer. Ne lève jamais. */
export function lireLectureCapture(texte: string): LectureCapture {
  try {
    if (typeof texte !== "string" || texte.trim() === "") return { ok: false, raisons: ["La réponse est vide."] };
    const cloture = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/.exec(texte);
    let brut: unknown;
    try {
      brut = JSON.parse(cloture ? cloture[1] : texte);
    } catch {
      return { ok: false, raisons: ["La réponse n'est pas un JSON lisible."] };
    }
    const lu = lireTableauDeBord(brut);
    if (!lu.ok) return { ok: false, raisons: lu.erreurs };
    return { ok: true, brouillon: lu.donnee, aRelire: tousLesChiffres(lu.donnee) };
  } catch {
    return { ok: false, raisons: ["La réponse est illisible."] };
  }
}
