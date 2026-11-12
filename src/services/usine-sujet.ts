/** « Écrire ce sujet » (idées de l'usine) : crée le sujet pré-rempli, garde les codes, prévient l'usine. Rien n'est payé ici. */
import "server-only";
import { depots, horodatage, journaliser, maintenant, ErreurStudio } from "@/services/_commun";
import { nouvelId } from "@/lib/ids";
import { listerFormatsActifs } from "@/formats";
import { creerSujet } from "@/services/generateur";
import { controlerSujetCentral, ErreurSujetDejaTraite } from "@/services/sujet-central-controle";
import { retenirSujetUsine } from "@/services/usine-porte";
import type { IdeeUsine, TypeContenuUsine } from "@/domaine/usine";
import type { Matiere, ReseauDeclinaison } from "@/domaine/types";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";

/** Code du refus : le format de l'idée n'est pas disponible (contrat d'échange : 422, format non disponible). */
export const format_non_disponible = "FORMAT_NON_DISPONIBLE";

/** Le format de l'idée s'il correspond à un format actif (accents et casse ignorés). Absent, inconnu ou éteint : refus, jamais de repli sur un autre format. */
export function formatPourIdeeUsine(format: string | undefined): string {
  const actifs = listerFormatsActifs();
  const n = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const cherche = format ? n(format) : "";
  const trouve = cherche ? actifs.find((f) => [f.id, f.nom, f.nomCourt].some((x) => x && n(x) === cherche)) : undefined;
  if (!trouve) throw new ErreurStudio(format_non_disponible, "Le format de cette idée n'est pas disponible : aucun sujet n'a été écrit.");
  return trouve.id;
}

export async function ecrireSujetDeLUsine(
  idee: IdeeUsine,
  options: { reseaux: string[]; typeContenu: TypeContenuUsine },
): Promise<{ id: string; rappelUsine: boolean }> {
  const reseaux = RESEAUX_DECLINAISON.filter((r) => options.reseaux.includes(r)) as ReseauDeclinaison[];
  const choisis = reseaux.length ? reseaux : ([...RESEAUX_DECLINAISON] as ReseauDeclinaison[]);
  const origine = { signature: idee.signature, parts: idee.parts, typeContenu: options.typeContenu };
  const cible = [idee.metier, idee.taille].filter(Boolean).join(", ");
  let formatId: string;
  try {
    formatId = formatPourIdeeUsine(idee.format);
  } catch (e) {
    // Refus visible : journalisé avec la signature de l'idée, avant tout sujet, matière ou rappel à l'usine.
    if (e instanceof ErreurStudio && e.code === format_non_disponible) {
      await journaliser("usine", `Idée refusée, ${format_non_disponible} : format « ${idee.format ?? "absent"} » (signature ${idee.signature})`);
    }
    throw e;
  }
  const ideeDuSujet = `${idee.douleur} ${idee.casUsage}`.trim();

  // Lot L5 : pas d'écran pour choisir ici. Un sujet déjà traité est refusé AVANT d'écrire la moindre matière (erreur claire,
  // journalisée) ; la clé `usine:<cas d'usage>` est celle de l'idée. Jamais de passage en force.
  const d = depots();
  try {
    await controlerSujetCentral({ idee: ideeDuSujet, formatId, origineUsine: origine });
  } catch (e) {
    // Déjà traitée à l'identique : l'idée sort de la réserve (jamais reproposée à chaque clic). Un « proche » la laisse.
    if (e instanceof ErreurSujetDejaTraite && e.refus.niveau === "identique") {
      const jugee = await d.ideesJugees.trouver((x) => x.signature === idee.signature && !x.utiliseeLe);
      if (jugee) await d.ideesJugees.modifier(jugee.id, { utiliseeLe: maintenant() });
    }
    throw e;
  }

  // La douleur et le cas d'usage deviennent de la matière, avec leur source (l'usine), jamais un cas client : pas d'accord à demander.
  const matiereIds: string[] = [];
  for (const texte of [idee.douleur, idee.casUsage].filter(Boolean)) {
    const m: Matiere = {
      id: nouvelId("mat"),
      type: "observation",
      texte,
      source: { origine: "veille", detail: `Usine ${idee.signature}`, date: maintenant() },
      motsCles: [],
      saisiePar: "proposee-machine",
      statut: "validee",
      ...horodatage(),
    };
    await d.matieres.enregistrer(m);
    matiereIds.push(m.id);
  }

  const sujet = await creerSujet(
    {
      idee: ideeDuSujet,
      cible: cible || undefined,
      reseaux: choisis,
      formatId,
      matiereIdsImposees: matiereIds,
      origineUsine: origine,
    },
    { dejaControle: true },
  );
  await journaliser("sujet", `Sujet venu de l'usine : « ${sujet.brief.idee} »`, { type: "sujet", id: sujet.id });
  // Idée déjà jugée par le comité : elle sort de sa réserve (jamais montrée deux fois).
  const jugee = await d.ideesJugees.trouver((x) => x.signature === idee.signature && !x.utiliseeLe);
  if (jugee) await d.ideesJugees.modifier(jugee.id, { utiliseeLe: maintenant() });
  const prevenue = await retenirSujetUsine(origine, sujet.id);
  return { id: sujet.id, rappelUsine: !prevenue };
}
