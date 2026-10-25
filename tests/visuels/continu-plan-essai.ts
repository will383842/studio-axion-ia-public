// Registres d'essai du planificateur (P4b) : les familles de production arrivent avec les lots P3, en parallèle.
import { z } from "zod";
import type { DefinitionGabarit, FamilleContinu, RoleGabarit } from "@/briques/visuels/continu/registre-gabarits";
import type { DefinitionParcours } from "@/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "@/briques/visuels/continu/registre-raccords";
import type { RegistresPlan } from "@/briques/visuels/continu/plan-toile";
import { texteSansLien } from "@/domaine/visuels/schema";

type Bords = DefinitionGabarit["bordsLibres"];
const PLEIN: Bords = { gauche: [[0, 1440]], droite: [[0, 1440]] };

interface Options {
  sombre?: boolean;
  orangeFort?: boolean;
  cas?: boolean;
  bords?: Bords;
}

function gabarit(type: string, famille: FamilleContinu, role: RoleGabarit, titre: string, texte: string, o: Options = {}): DefinitionGabarit {
  return {
    type,
    famille,
    nom: `Plaquette ${type}`,
    role,
    sombre: o.sombre ?? false,
    orangeFort: o.orangeFort ?? false,
    version: 1,
    schema: z
      .object({
        type: z.literal(type),
        alt: texteSansLien(1, 125),
        rubrique: texteSansLien(1, 28).optional(),
        titre: texteSansLien(1, 40),
        texte: texteSansLien(1, 90),
      })
      .strict(),
    exemple: { type, alt: titre, titre, texte },
    bordsLibres: o.bords ?? PLEIN,
    ...(o.cas ? { cas: true } : {}),
    actif: true,
  };
}

const PLAQUETTES: DefinitionGabarit[] = [
  gabarit("C01", "couverture", "couverture", "Par où commencer ?", "Un point de départ simple.", { bords: { gauche: [[0, 1440]], droite: [[300, 900]] } }),
  gabarit("C02", "couverture", "couverture", "Le vrai coût du temps perdu", "Ce qui revient chaque semaine."),
  gabarit("C03", "couverture", "couverture", "Une idée reçue", "Ce que l’on croit, ce qui se passe.", { orangeFort: true }),
  gabarit("L01", "liste", "contenu", "Trois questions utiles", "Avant de choisir un outil.", { bords: { gauche: [[500, 1300]], droite: [[0, 1440]] } }),
  gabarit("L02", "liste", "contenu", "Ce que ça change", "Au quotidien, pour votre équipe."),
  gabarit("K01", "comparaison", "contenu", "Avant, avec nous", "Le même travail, autrement."),
  gabarit("K02", "comparaison", "contenu", "Ce qui reste à vous", "Vous gardez la main."),
  gabarit("S01", "cas", "contenu", "Les devis du lundi", "Un scénario type, pas à pas.", { cas: true }),
  gabarit("S02", "cas", "contenu", "Les relances oubliées", "Un scénario type, pas à pas.", { cas: true }),
  gabarit("S03", "cas", "contenu", "Le tri des demandes", "Un scénario type, pas à pas.", { cas: true, sombre: true }),
  gabarit("A01", "appel", "appel", "Écrivez-nous", "Dites-nous ce qui vous freine.", { sombre: true }),
  gabarit("A02", "appel", "relance", "À retenir", "Un cas, puis le suivant."),
  gabarit("A03", "appel", "appel", "Enregistrez ce carrousel", "Pour le relire au bon moment.", { orangeFort: true }),
  // Inactif ou d'essai : jamais planifié.
  { ...gabarit("D01", "donnees", "contenu", "Un grand chiffre", "Avec sa source."), actif: false },
  { ...gabarit("X09", "essai", "contenu", "Essai", "Essai."), essai: true },
];

/** id, pages, commence, termine, sombres (maquette : PA et PH ont `dk:[3]`). Drapeaux d'essai : P3h fixe les vrais. */
const DEFS: [string, 3 | 4, boolean, boolean, number[]][] = [
  ["PA", 4, true, false, [3]],
  ["PB", 3, false, false, []],
  ["PC", 3, true, false, []],
  ["PD", 3, false, true, []],
  ["PE", 4, false, false, []],
  ["PF", 4, false, true, []],
  ["PG", 4, true, false, []],
  ["PH", 4, false, true, [3]],
];

export const PARCOURS_ESSAI: DefinitionParcours[] = DEFS.map(([id, pages, commence, termine, sombres]) => ({
  id,
  nom: `Parcours ${id}`,
  pages,
  commence,
  termine,
  pagesTypes: Array.from({ length: pages }, (_, j) => `${id}${j + 1}`),
  sombres,
  version: 1,
}));

const PAGES_PARCOURS: DefinitionGabarit[] = PARCOURS_ESSAI.flatMap((p) =>
  p.pagesTypes.map((t, j) => gabarit(t, "parcours", j === 0 && p.commence ? "couverture" : "contenu", `Étape ${j + 1} du parcours`, "Le visuel glisse d’une page à l’autre.", { sombre: p.sombres.includes(j) })),
);

export const GABARITS_ESSAI: DefinitionGabarit[] = [...PLAQUETTES, ...PAGES_PARCOURS];

export const REGISTRES_ESSAI: RegistresPlan = { gabarits: GABARITS_ESSAI, parcours: PARCOURS_ESSAI, raccords: RACCORDS };

export const SUJETS_ESSAI = [
  "Par où commencer avec l’IA",
  "Gagner du temps sur les devis",
  "Relancer sans y penser",
  "Trier les demandes entrantes",
  "Préparer la semaine",
  "Répondre plus vite aux clients",
  "Ranger ses documents",
  "Former son équipe",
  "Choisir un premier cas",
  "Mesurer ce qui change",
];
