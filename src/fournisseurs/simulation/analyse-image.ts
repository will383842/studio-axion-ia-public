/**
 * CLASSEMENT SIMULÉ d'une image de « Mes images » (lot A2) — remplacé par un modèle de vision (Claude) quand une clé
 * existera, sans changer d'interface (`FournisseurIllustration.analyserImage`). Règles sur le NOM du fichier :
 * catégorie, mots-clés FR / EN, description, zones sensibles PROPOSÉES (jamais d'image « prête » sans Will).
 * Les zones sont exprimées sur une grille de 1000 × 1000 (le service les remet à l'échelle de l'image).
 */
import { motsAnglais, motsSignificatifs } from "@/domaine/illustrations";
import type { CategorieMesImages, ZoneSensible } from "@/domaine/types";
import type { AnalyseImage } from "../types";

export const GRILLE_ZONES_SIMULEES = 1000;

const REGLES: { categorie: CategorieMesImages; mots: RegExp; description: string }[] = [
  { categorie: "consoles", mots: /console|dashboard|tableau|graph|courbe|telegram|alerte|capture|screenshot|ecran|automati|stat/, description: "Capture d'une console de suivi" },
  { categorie: "interventions", mots: /formation|conference|atelier|cours|intervention|seminaire|webinaire|salle/, description: "Intervention devant un groupe" },
  { categorie: "evenements", mots: /gofab|salon|stand|evenement|rencontre|forum|meetup/, description: "Stand ou rencontre lors d'un salon" },
  { categorie: "clients", mots: /client|usine|terrain|chantier|entrepot|visite/, description: "Sur le terrain, chez un client" },
  { categorie: "objets", mots: /contrat|facture|devis|telephone|ordinateur|document|papier|courrier|lettre|carnet|pv|amende|avis/, description: "Document posé sur une table, vu de près" },
  { categorie: "marque", mots: /logo|axion|buffer|couverture|visuel|banniere|marque/, description: "Visuel de la marque Axion" },
  { categorie: "bureau", mots: /bureau|desk|cafe|poste|coulisse|travail|clavier/, description: "Bureau de travail" },
];

function zone(type: ZoneSensible["type"], x: number, y: number, largeur: number, hauteur: number): ZoneSensible {
  return { type, x, y, largeur, hauteur, floutee: false };
}

/** Zones à flouter proposées selon la catégorie (positions typiques ; Will les valide d'un toucher). */
function zonesProposees(categorie: CategorieMesImages, nom: string): ZoneSensible[] {
  if (categorie === "consoles") return [zone("nom", 60, 120, 380, 60), zone("email", 60, 200, 420, 50), zone("montant", 560, 420, 300, 90)];
  if (categorie === "objets" && /facture|devis|contrat|pv|amende|avis/.test(nom)) return [zone("nom", 80, 90, 400, 70), zone("montant", 520, 700, 360, 90)];
  if (categorie === "clients") return [zone("logo-client", 40, 40, 220, 120)];
  if (categorie === "interventions" || categorie === "evenements") return [zone("visage", 380, 260, 200, 240)];
  return [];
}

export async function analyserImageSimulee(demande: { fichierCle: string; mime: string; nom: string }): Promise<AnalyseImage> {
  const nom = demande.nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const regle = REGLES.find((r) => r.mots.test(nom)) ?? REGLES.at(-1)!;
  const motsNom = motsSignificatifs(nom.replace(/\.[^.]+$/, "")).filter((m) => !/^(img|dsc|pxl|photo|image|capture|screenshot|\d+)$/.test(m));
  const motsCles = Array.from(new Set([...motsNom, regle.categorie])).slice(0, 12);
  const zones = zonesProposees(regle.categorie, nom);
  const floue = /flou|blur|floue/.test(nom);
  const petite = /mini|petit|thumb|vignette/.test(nom);
  return {
    categorie: regle.categorie,
    motsCles,
    motsClesEn: motsAnglais(motsCles.join(" ")).slice(0, 12),
    description: motsNom.length ? `${regle.description} (${motsNom.slice(0, 4).join(", ")})` : regle.description,
    cadrageVertical: { x: 0.5, y: 0.45, tientEnVertical: regle.categorie !== "consoles" },
    zones,
    visageTiers: regle.categorie === "interventions" || regle.categorie === "evenements",
    qualite: { note: floue ? 40 : petite ? 55 : 82, nette: !floue, assezGrande: !petite, remarques: [...(floue ? ["Image floue"] : []), ...(petite ? ["Image trop petite pour le 1080 × 1920"] : [])] },
  };
}
