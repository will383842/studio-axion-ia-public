/**
 * Pinterest, PR 1 : inventaire des listes de réseaux écrites en dur.
 *
 * Une nouvelle liste littérale d'au moins trois réseaux (les identifiants du registre) qui oublie Pinterest est une
 * panne silencieuse : l'épingle n'a ni pastille de filtre, ni nom, ni créneau. Ce test lit les sources (hors tests) :
 * chaque liste doit contenir `pinterest`, OU figurer dans la table d'exclusions ci-dessous, AVEC son motif écrit.
 * Une exclusion qui ne correspond plus à aucune liste échoue aussi (table tenue à jour).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "../..");
const IDS = ["linkedin", "instagram", "facebook", "tiktok", "youtube-shorts", "youtube"];
const LISTE = /\[([^[\]]*)\]/g;
const CITE = /["'](linkedin|instagram|facebook|tiktok|youtube-shorts|youtube)["']/g;

/**
 * Exclusions : [chemin, repère, motif]. Le repère est un bout de texte de la LIGNE où la liste s'ouvre (le nom de la
 * constante) : une nouvelle liste oubliée dans le même fichier reste donc rouge. Seuls les dossiers entiers de la chaîne
 * vidéo (chemin finissant par « / », repère vide) sont exclus en bloc. Le motif dit POURQUOI Pinterest y est absent.
 */
const EXCLUSIONS: ReadonlyArray<readonly [string, string, string]> = [
  // Chaîne VIDÉO : une épingle n'est pas une vidéo (B-3).
  ["src/formats/", "", "formats de vidéo : Pinterest volontairement absent, une épingle est une image"],
  ["src/moteurs/", "", "moteurs de montage vidéo : Pinterest volontairement absent"],
  ["src/briques/", "", "briques de la chaîne vidéo (fins, sous-titres, incrustations) : Pinterest volontairement absent"],
  ["src/domaine/qualite-script/", "", "recettes de qualité des scripts vidéo : Pinterest volontairement absent"],
  ["src/domaine/ecriture-commune/", "", "écriture des scripts vidéo : Pinterest volontairement absent"],
  ["src/domaine/image-video/", "", "format image-vidéo : Pinterest volontairement absent"],
  ["src/domaine/productions/", "", "demande de production vidéo : Pinterest volontairement absent"],
  ["src/donnees/generateur/", "", "données du générateur de textes vidéo : Pinterest volontairement absent"],
  ["src/components/formats/", "", "écrans des formats vidéo : Pinterest volontairement absent"],
  ["src/components/ui/CalqueZonesReseaux.tsx", "reseaux = [", "zones protégées d'une vidéo : Pinterest volontairement absent"],
  ["src/components/generateur/CeQuiMarche.tsx", "ORDRE_RESEAUX", "statistiques des vidéos : Pinterest volontairement absent"],
  ["src/reseaux/codes.ts", "RESEAUX_DECLINAISON", "RESEAUX_DECLINAISON : déclinaisons vidéo, Pinterest volontairement absent"],
  ["src/reseaux/adaptation-derivation.ts", "const RESEAUX", "adaptation de vidéo dérivée : Pinterest volontairement absent"],
  ["src/reseaux/placement-hashtags.ts", "RESEAUX_PLACEMENT", "RESEAUX_PLACEMENT (les réseaux d'écriture) : Pinterest volontairement absent de la liste ; `bornes` traite Pinterest à part, avec les bornes d'affichage"],
  ["src/domaine/duree-par-reseau.ts", "RESEAUX_DUREE", "durées de vidéo : Pinterest volontairement absent"],
  ["src/domaine/classement-generateur.ts", "ORDRE_PUBLICATION_PAR_DEFAUT", "classement du générateur vidéo : Pinterest volontairement absent"],
  ["src/domaine/reseaux-par-defaut.ts", "RESEAUX_PAR_DEFAUT", "réseaux par défaut d'une vidéo : Pinterest volontairement absent"],
  ["src/domaine/mesures-visuels.ts", "ORDRE_RESEAUX", "mesures de visuels : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/services/cas-concret.ts", "RESEAUX_CAS", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/services/cas-concret-suivi.ts", "const RESEAUX", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/services/cas-concret-vue.ts", "const RESEAUX", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/app/(studio)/cas-concret/", "", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/services/extraits-maison-v4.ts", "TOUS_RESEAUX", "extraits vidéo : Pinterest volontairement absent"],
  ["src/services/sources-retouche-extrait-v4.ts", "TOUS_RESEAUX", "extraits vidéo : Pinterest volontairement absent"],
  ["src/services/tableau-code.ts", "const ORDRE", "codes de version d'un tableau animé : Pinterest volontairement absent"],
  ["src/services/pret-a-partir.ts", "HASHTAGS_ATTENDUS", "kit « prêt à partir » d'une vidéo : Pinterest volontairement absent"],
  ["src/services/mesures-exemples.ts", "const RESEAUX", "exemples de mesures : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/domaine/mesures.ts", "RESEAUX_LIEN", "mesures par réseau : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/domaine/mesures.ts", "RESEAUX_MESSAGE", "mesures par réseau : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/donnees/memoire/demo.ts", "const publications", "données de démonstration"],
  // Boîte de réception : Pinterest n'en a pas côté Zernio (ADR-0015, limites écrites).
  ["src/fournisseurs/publication/zernio-inbox-corps.ts", "RESEAUX_LISTE_COMMENTAIRES", "boîte de réception : Pinterest n'en a pas, volontairement absent"],
  ["src/services/mots-capacites.ts", "export const RESEAUX", "boîte de réception : Pinterest n'en a pas, volontairement absent"],
  ["src/services/mots-cibles-vue.ts", "as ReseauSite[]", "mots-clés de la boîte de réception : volontairement absent"],
  ["src/domaine/guide-reseau/", "", "guide de la boîte de réception : volontairement absent"],
  ["src/domaine/liens-bio.ts", "RESEAUX_LIEN_PROFIL", "lien en bio : Pinterest volontairement absent"],
  // Premier commentaire, republication : sans objet pour une épingle (ADR-0015).
  ["src/domaine/ecriture-post/commentaire.ts", "PREMIER_COMMENTAIRE_RESEAUX", "PREMIER_COMMENTAIRE_RESEAUX : pas de premier commentaire sur Pinterest"],
  ["src/domaine/republication/regles.ts", "RESEAUX_REPUBLICATION", "RESEAUX_REPUBLICATION : une épingle ne se republie pas"],
  // Envoi : Pinterest ne s'envoie pas avant les PR 3 à 5 (la liste unique des réseaux d'envoi arrive en PR 2).
  ["src/services/plan-editorial.ts", "RESEAUX_ENVOI", "RESEAUX_ENVOI : Pinterest absent jusqu'à la PR 5"],
  ["src/domaine/reseaux-visuel-envoi.ts", "RESEAUX_VISUEL_ENVOI", "liste unique des réseaux qui reçoivent un visuel : Pinterest absent jusqu'aux PR 3 à 5"],
  ["src/domaine/visuels/depot.ts", "z.enum", "dépôt de visuels envoyés (zod, image de rendu) : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/app/(studio)/reglages/actions-zernio.ts", "RESEAUX_CONNUS", "RESEAUX_CONNUS (comptes Zernio) : Pinterest arrive en PR 3"],
  ["src/domaine/calendrier/manques.ts", "ORDRE_RESEAUX", "créneaux attendus : Pinterest n'a pas de jour attendu en V1"],
  // Anciens liens du calendrier : les quatre réseaux d'avant Pinterest, lus comme « tous » (lireReseaux).
  ["src/components/calendrier/lire-reseaux.ts", "ANCIENS_RESEAUX", "les quatre réseaux d'avant Pinterest : un ancien lien ?reseaux= est lu comme « tous »"],
  // Anciens outils et files de travail sans Pinterest.
  ["src/services/import-buffer/cibles.ts", "RESEAUX_IMPORTES", "import de l'ancien outil : Pinterest n'y existe pas"],
  ["src/services/import-buffer/lire-publies.ts", "RESEAUX_INVENTAIRE", "import de l'ancien outil : Pinterest n'y existe pas"],
  ["src/fournisseurs/publication/buffer.ts", "RESEAUX_PREMIER_COMMENTAIRE", "ancien outil : Pinterest n'y existe pas"],
  ["src/services/a-traiter-onglets.ts", "ONGLETS_A_TRAITER", "file « à traiter » : Pinterest absent en V1"],
  ["src/services/a-traiter-types.ts", "RESEAUX_A_TRAITER", "file « à traiter » : Pinterest absent en V1"],
];

function sources(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...sources(chemin));
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

const dansChemin = (m: string, fichier: string) => (m.endsWith("/") ? fichier.startsWith(m) : fichier === m);
const exclusionDe = (l: { fichier: string; texteLigne: string }) => EXCLUSIONS.find(([m, repere]) => dansChemin(m, l.fichier) && l.texteLigne.includes(repere));

interface Liste {
  fichier: string;
  ligne: number;
  texteLigne: string;
  avecPinterest: boolean;
}
const LISTES: Liste[] = [];
for (const chemin of sources(join(RACINE, "src"))) {
  const texte = readFileSync(chemin, "utf-8");
  const fichier = relative(RACINE, chemin).split("\\").join("/");
  for (const m of texte.matchAll(LISTE)) {
    const ids = new Set([...m[1]!.matchAll(CITE)].map((x) => x[1]));
    if (ids.size < 3 || !IDS.some((i) => ids.has(i))) continue;
    const ligne = texte.slice(0, m.index).split("\n").length;
    LISTES.push({ fichier, ligne, texteLigne: texte.split("\n")[ligne - 1]!, avecPinterest: /["']pinterest["']/.test(m[1]!) });
  }
}

describe("Pinterest : aucune liste de réseaux oubliée", () => {
  it("l'inventaire trouve des listes (le détecteur marche)", () => {
    expect(LISTES.length).toBeGreaterThan(20);
    expect(LISTES.some((l) => l.avecPinterest)).toBe(true);
  });
  it("chaque liste d'au moins trois réseaux contient Pinterest ou est exclue avec son motif", () => {
    const oubliees = LISTES.filter((l) => !l.avecPinterest && !exclusionDe(l)).map((l) => `${l.fichier}:${l.ligne}`);
    expect(oubliees, "ajouter pinterest à la liste, ou une exclusion motivée dans ce test").toEqual([]);
  });
  it("chaque exclusion a un motif et correspond encore à une liste", () => {
    for (const [motif, repere, raison] of EXCLUSIONS) {
      expect(raison.length, motif).toBeGreaterThan(10);
      expect(LISTES.some((l) => dansChemin(motif, l.fichier) && l.texteLigne.includes(repere) && !l.avecPinterest), `exclusion périmée : ${motif} (${repere})`).toBe(true);
    }
  });
});
