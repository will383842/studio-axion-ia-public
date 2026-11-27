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

/** Motifs d'exclusion : un chemin exact, ou un dossier (finit par « / »). Le motif écrit dit POURQUOI Pinterest y est absent. */
const EXCLUSIONS: ReadonlyArray<readonly [string, string]> = [
  // Chaîne VIDÉO : une épingle n'est pas une vidéo (B-3).
  ["src/formats/", "formats de vidéo : Pinterest volontairement absent, une épingle est une image"],
  ["src/moteurs/", "moteurs de montage vidéo : Pinterest volontairement absent"],
  ["src/briques/", "briques de la chaîne vidéo (fins, sous-titres, incrustations) : Pinterest volontairement absent"],
  ["src/domaine/qualite-script/", "recettes de qualité des scripts vidéo : Pinterest volontairement absent"],
  ["src/domaine/ecriture-commune/", "écriture des scripts vidéo : Pinterest volontairement absent"],
  ["src/domaine/image-video/", "format image-vidéo : Pinterest volontairement absent"],
  ["src/domaine/productions/", "demande de production vidéo : Pinterest volontairement absent"],
  ["src/donnees/generateur/", "données du générateur de textes vidéo : Pinterest volontairement absent"],
  ["src/components/formats/", "écrans des formats vidéo : Pinterest volontairement absent"],
  ["src/components/ui/CalqueZonesReseaux.tsx", "zones protégées d'une vidéo : Pinterest volontairement absent"],
  ["src/components/generateur/CeQuiMarche.tsx", "statistiques des vidéos : Pinterest volontairement absent"],
  ["src/reseaux/codes.ts", "RESEAUX_DECLINAISON : déclinaisons vidéo, Pinterest volontairement absent"],
  ["src/reseaux/adaptation-derivation.ts", "adaptation de vidéo dérivée : Pinterest volontairement absent"],
  ["src/reseaux/placement-hashtags.ts", "placement des hashtags d'une vidéo (4 réseaux d'écriture) : Pinterest volontairement absent"],
  ["src/domaine/duree-par-reseau.ts", "durées de vidéo : Pinterest volontairement absent"],
  ["src/domaine/classement-generateur.ts", "classement du générateur vidéo : Pinterest volontairement absent"],
  ["src/domaine/reseaux-par-defaut.ts", "réseaux par défaut d'une vidéo : Pinterest volontairement absent"],
  ["src/domaine/mesures-visuels.ts", "mesures de visuels : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/services/cas-concret.ts", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/services/cas-concret-suivi.ts", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/services/cas-concret-vue.ts", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/app/(studio)/cas-concret/", "format vidéo « cas concret » : Pinterest volontairement absent"],
  ["src/services/extraits-maison-v4.ts", "extraits vidéo : Pinterest volontairement absent"],
  ["src/services/sources-retouche-extrait-v4.ts", "extraits vidéo : Pinterest volontairement absent"],
  ["src/services/tableau-code.ts", "codes de version d'un tableau animé : Pinterest volontairement absent"],
  ["src/services/pret-a-partir.ts", "kit « prêt à partir » d'une vidéo : Pinterest volontairement absent"],
  ["src/services/mesures-exemples.ts", "exemples de mesures : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/domaine/mesures.ts", "mesures par réseau : Pinterest volontairement absent jusqu'à la PR 8"],
  ["src/donnees/memoire/demo.ts", "données de démonstration"],
  // Boîte de réception : Pinterest n'en a pas côté Zernio (ADR-0015, limites écrites).
  ["src/fournisseurs/publication/zernio-inbox-corps.ts", "boîte de réception : Pinterest n'en a pas, volontairement absent"],
  ["src/services/mots-capacites.ts", "boîte de réception : Pinterest n'en a pas, volontairement absent"],
  ["src/services/mots-cibles-vue.ts", "mots-clés de la boîte de réception : volontairement absent"],
  ["src/domaine/guide-reseau/", "guide de la boîte de réception : volontairement absent"],
  ["src/domaine/liens-bio.ts", "lien en bio : Pinterest volontairement absent"],
  // Premier commentaire, republication : sans objet pour une épingle (ADR-0015).
  ["src/domaine/ecriture-post/commentaire.ts", "PREMIER_COMMENTAIRE_RESEAUX : pas de premier commentaire sur Pinterest"],
  ["src/domaine/republication/regles.ts", "RESEAUX_REPUBLICATION : une épingle ne se republie pas"],
  // Envoi : Pinterest ne s'envoie pas avant les PR 3 à 5 (la liste unique des réseaux d'envoi arrive en PR 2).
  ["src/services/essai-zernio.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/publications.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/branchement-envoi-calendrier.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/valider-entree.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/zernio.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/envoi-visuel-creneau.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/rangement-contenus.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/services/plan-editorial.ts", "RESEAUX_ENVOI : Pinterest absent jusqu'à la PR 5"],
  ["src/app/(studio)/infographies/actions.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/app/(studio)/carrousels/[id]/actions.ts", "envoi d'un visuel : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/domaine/visuels/depot.ts", "dépôt de visuels envoyés (zod, image de rendu) : Pinterest absent jusqu'aux PR 2 à 5"],
  ["src/app/(studio)/reglages/actions-zernio.ts", "RESEAUX_CONNUS (comptes Zernio) : Pinterest arrive en PR 3"],
  ["src/domaine/calendrier/manques.ts", "créneaux attendus : Pinterest n'a pas de jour attendu en V1"],
  // Anciens outils et files de travail sans Pinterest.
  ["src/services/import-buffer/", "import de l'ancien outil : Pinterest n'y existe pas"],
  ["src/fournisseurs/publication/buffer.ts", "ancien outil : Pinterest n'y existe pas"],
  ["src/services/a-traiter-onglets.ts", "file « à traiter » : Pinterest absent en V1"],
  ["src/services/a-traiter-types.ts", "file « à traiter » : Pinterest absent en V1"],
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

const exclusionDe = (fichier: string) => EXCLUSIONS.find(([m]) => (m.endsWith("/") ? fichier.startsWith(m) : fichier === m));

interface Liste {
  fichier: string;
  ligne: number;
  avecPinterest: boolean;
}
const LISTES: Liste[] = [];
for (const chemin of sources(join(RACINE, "src"))) {
  const texte = readFileSync(chemin, "utf-8");
  const fichier = relative(RACINE, chemin).split("\\").join("/");
  for (const m of texte.matchAll(LISTE)) {
    const ids = new Set([...m[1]!.matchAll(CITE)].map((x) => x[1]));
    if (ids.size < 3 || !IDS.some((i) => ids.has(i))) continue;
    LISTES.push({ fichier, ligne: texte.slice(0, m.index).split("\n").length, avecPinterest: /["']pinterest["']/.test(m[1]!) });
  }
}

describe("Pinterest : aucune liste de réseaux oubliée", () => {
  it("l'inventaire trouve des listes (le détecteur marche)", () => {
    expect(LISTES.length).toBeGreaterThan(20);
    expect(LISTES.some((l) => l.avecPinterest)).toBe(true);
  });
  it("chaque liste d'au moins trois réseaux contient Pinterest ou est exclue avec son motif", () => {
    const oubliees = LISTES.filter((l) => !l.avecPinterest && !exclusionDe(l.fichier)).map((l) => `${l.fichier}:${l.ligne}`);
    expect(oubliees, "ajouter pinterest à la liste, ou une exclusion motivée dans ce test").toEqual([]);
  });
  it("chaque exclusion a un motif et correspond encore à une liste", () => {
    for (const [motif, raison] of EXCLUSIONS) {
      expect(raison.length, motif).toBeGreaterThan(10);
      expect(LISTES.some((l) => (motif.endsWith("/") ? l.fichier.startsWith(motif) : l.fichier === motif) && !l.avecPinterest), `exclusion périmée : ${motif}`).toBe(true);
    }
  });
});
