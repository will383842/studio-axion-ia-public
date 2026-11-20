/**
 * T-EXT-55 · doubles de l'équipe : un dossier fictif complet (maquette vivante à zones déclarées), sans aucun appel réel.
 */
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { EtatTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";
import { roleAnalyste } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import { roleChefDeProjet } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import type { DossierLu, EntreesEquipe, EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { figerRegistre } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { roleStrategeValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import type { IdRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { commandeTutoriel } from "./doubles";

const T0 = Date.UTC(2026, 10, 19, 9);

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

export const FILM = {
  version: "navigation-filmee.v1",
  videoCle: "studio/test/film.mp4",
  maquette: "stocks",
  largeur: 1080,
  hauteur: 1350,
  debutFilmMs: 400,
  dureeVoixMs: 60000,
  cibles: [
    { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 },
    { etapeId: "e2", zonePct: { x: 60, y: 50, largeur: 30, hauteur: 12 }, instantMs: 8000, finMs: 10000 },
  ],
};

/** Commande « dossier déposé » : aucune phrase collée, ni idée. */
export const commandeDossier = (film?: unknown): CommandeFabrication =>
  commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { depot: { mode: "dossier", fichierId: "f1", attestationImages: true }, fin: "aucune", ...(film ? { navigationFilmee: film } : {}) } } } as never);

export interface Equipe {
  port: PortEquipe;
  appels: IdRole[];
  dossierLu: number;
  tronc: { evaluer: string[][]; corrections: [string, string][] };
}

/** Faux port : un appel = la simulation du rôle (aucun Claude). `panne` : le premier appel de ce rôle lève (rien n'est payé). */
export function fauxPort(options: { panne?: IdRole; tronc?: boolean; illisible?: IdRole } = {}): Equipe {
  const eq: Equipe = { port: undefined as never, appels: [], dossierLu: 0, tronc: { evaluer: [], corrections: [] } };
  let enPanne = options.panne;
  const roles = { "chef-de-projet": roleChefDeProjet, analyste: roleAnalyste, stratege: roleStrategeValeur } as const;
  let fiche: { moments: { id: string; zoneId: string }[] } | undefined;
  eq.port = {
    maintenant: () => new Date(T0).toISOString(),
    async appelerRole(role, entree) {
      if (enPanne === role) {
        enPanne = undefined;
        throw new Error("panne");
      }
      eq.appels.push(role);
      // Réponse réelle payée, refusée par la garde du rôle : le port rend la sortie « illisible » (jamais undefined).
      if (options.illisible === role) return { illisible: true };
      if (role === "scenariste") return fauxScenariste(fiche!);
      const sortie = (roles as Record<string, { simuler(e: typeof entree): unknown }>)[role]!.simuler(entree);
      if (role === "stratege") fiche = sortie as never;
      return sortie;
    },
    async lireDossier() {
      eq.dossierLu++;
      return dossierComplet();
    },
    ...(options.tronc
      ? {
          tronc: {
            evaluer: (versions: readonly { id: string; texte: string }[]) => {
              eq.tronc.evaluer.push(versions.map((v) => v.id));
              return ["Remarque du tronc : la 3e phrase est longue."];
            },
            noterCorrection: (avant: string, apres: string) => void eq.tronc.corrections.push([avant, apres]),
          },
        }
      : {}),
  };
  return eq;
}


/** Ce que fait l'action de T-EXT-33 « valider » : le registre est figé dans l'équipe avant de reprendre. */
export function avecRegistreFige(t: Travail): Travail {
  const e = (((t.parametres?.tutoriel as EtatTutoriel | undefined)?.equipe) as EtatEquipe);
  const f = figerRegistre(e.registre!, new Date(T0).toISOString());
  if (!f.ok) throw new Error(f.erreur);
  return { ...t, parametres: { ...t.parametres, tutoriel: { ...(t.parametres!.tutoriel as EtatTutoriel), equipe: { ...e, registre: f.registre } } } };
}

