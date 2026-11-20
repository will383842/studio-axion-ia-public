/**
 * T-EXT-55 · doubles de l'équipe : un dossier fictif complet (maquette vivante à zones déclarées), sans aucun appel réel.
 */
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { DossierLu, EntreesEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";

const ZONES = [
  { id: "alertes", prouve: "On voit d'un coup d'œil ce qui manque.", etat: "maintenant", gestes: "clic apparition" },
  { id: "stocks", prouve: "Chaque produit a son niveau.", etat: "les-deux", gestes: "defilement" },
  { id: "commandes", prouve: "Les commandes se suivent seules.", etat: "maintenant", gestes: "survol zoom" },
];

const DONNEES = {
  version: "tableau-de-bord.v1",
  titre: "Exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "trimestre exemple" },
  source: "Outil exemple",
  indicateurs: [{ id: "ruptures", libelle: "Ruptures", valeur: 12, unite: "produits", precision: 0, sens: "baisse-bonne" }],
  series: [],
  comparaisons: [],
  alertes: [],
  calculs: [],
} as unknown as TableauDeBord;

const html = `<html><body>${ZONES.map((z) => `<section class="carte" id="bloc-${z.id}" data-zone="${z.id}" data-zone-prouve="${z.prouve}" data-zone-etat="${z.etat}" data-zone-gestes="${z.gestes}" data-zone-aller="${z.id}">Niveau 37 · exemple</section>`).join("\n")}</body></html>`;
const js = `window.demoMaquette = { aller(e) { /* "alertes" "stocks" "commandes" */ }, reinitialiser() {} };`;

export function dossierComplet(): DossierLu {
  return {
    inventaire: { maquette: true, maquetteVivante: true, tableauDeBord: true, captures: 0, donnees: true, scripts: [], flux: false, conversation: false },
    fichiers: [
      { chemin: "stocks/index.html", contenu: html },
      { chemin: "stocks/app.js", contenu: js },
    ],
    donnees: DONNEES,
    textesMaquette: ZONES.map((z) => ({ etapeId: z.id, textes: ["Niveau 37 · exemple"], creee: false })),
    couleurs: ["#f5f0e6", "#c4572e"],
    polices: ["Manrope"],
    noms: [],
  };
}

export const entreesCompletes = (): EntreesEquipe => ({ dossier: dossierComplet() });

/** Faux scénariste : deux versions qui passent la garde (7 phrases ou moins, 40 à 55 s, une phrase par moment de la fiche). Aucun appel. */
export function fauxScenariste(fiche: { moments: { id: string; zoneId: string }[] }): unknown {
  const phrase = (texte: string, temps: "situation" | "changement" | "gain", extra: Record<string, string> = {}) => ({ texte, temps, apport: "Aide le spectateur à se reconnaître.", ...extra });
  const changements = fiche.moments.map((m) => phrase("Vous voyez tout de suite ici ce qui change pour votre journée, sans rien chercher ni recompter à la main.", "changement", { zoneId: m.zoneId, momentId: m.id }));
  const base = [
    phrase("Chaque jour, vous perdez du temps à chercher.", "situation"),
    phrase("Vous gardez la vue sur ce qui compte vraiment pour votre journée, mais il faut toujours courir après l'information avant de décider.", "situation"),
  ];
  const gain = phrase("Votre entreprise devient plus sereine, plus solide et prête à grandir, parce que chacun sait où en sont les choses.", "gain");
  const rallonge = phrase("Le soir, vous fermez votre journée l'esprit tranquille, sans rien oublier de ce qui devait être fait pour vos clients.", "situation");
  const ajoute = [phrase("Entre deux appels, vous reprenez souvent les mêmes vérifications, et cela vous coûte une bonne partie de votre énergie.", "situation")];
  return {
    version: "scripts-tutoriel.v1",
    versions: [
      { id: "A", source: "ecrit", phrases: [...base, ...ajoute, ...changements, gain] },
      { id: "B", source: "ecrit", phrases: [...base, ...ajoute, rallonge, ...changements, gain] },
    ],
  };
}
