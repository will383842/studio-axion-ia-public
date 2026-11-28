/**
 * L5-22 : « Programmer » sur la fiche d'un carrousel. Un clic crée un créneau du plan, puis la passerelle L4-08 le
 * passe à « programme » (Publications du Studio). Isolation : aucun appel au diffuseur, au réseau ni à un modèle d'IA ;
 * l'envoi reste décidé ailleurs, par le fondateur.
 */
import "server-only";
import { Bouton } from "@/components/ui/Bouton";
import type { IdReseau } from "@/domaine/types";
import { ajouterJoursParis, instantParis } from "@/lib/horloge-paris";
import { cleJour } from "@/lib/dates";
import { COMPTE_PAR_DEFAUT } from "@/domaine/plan-editorial/compte-par-defaut";
import { validerProposition } from "@/domaine/plan-editorial/statuts";
import { changerStatut, creerCreneau, type CreneauPlan } from "@/services/plan-editorial";
import { ErreurVisuel } from "@/visuels/services/carrousels";
import { programmerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";

// Pinterest volontairement absent : une épingle ne naît que par l'import (PR 6), jamais par ce bouton « un clic ».
/** Heure de publication (Paris) par réseau : fixe, le fondateur peut décaler ensuite depuis le calendrier. */
const HEURES: Partial<Record<IdReseau, string>> = { linkedin: "08:30", instagram: "12:30", facebook: "17:30" };
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Le jour (AAAA-MM-JJ) qu'il est à Paris à cet instant ISO : jamais le jour UTC (`cleJour`, heure de Paris). */
export const jourDeParis = (instant: string): string => cleJour(instant);

/** Jour proposé par défaut : demain, à l'heure de Paris. */
export function jourParDefautParis(instant: string): string {
  return ajouterJoursParis(jourDeParis(instant), 1);
}

/**
 * Amène le créneau à « valide » avec la trace du fondateur (CAL-14 : « a_valider » → « valide » ne passe plus par un
 * simple changement de statut). Reprend un créneau resté « propose » ou « a_valider » par un clic interrompu ; un
 * créneau déjà « valide » ou au-delà n'est pas touché (la passerelle décide).
 */
export async function validerParLeFondateur(d: DepotsPasserelle, creneauId: string, maintenant: string): Promise<void> {
  if ((await d.creneaux.obtenir(creneauId))?.statut === "propose") await changerStatut(d, creneauId, "a_valider", "studio", maintenant);
  const c = await d.creneaux.obtenir(creneauId);
  if (c?.statut !== "a_valider") return;
  const v = validerProposition(c, "studio", maintenant, "fondateur");
  if (!v.ok) throw new Error(v.raison);
  await d.creneaux.enregistrer(v.creneau as CreneauPlan);
}

/**
 * Identifiant du créneau à utiliser pour ce visuel : `cre_<id>`, puis `cre_<id>-2`, `-3`… si le précédent a été retiré
 * du calendrier (archivé avec `retireLe`). Rend le premier identifiant absent ou non retiré.
 */
export async function idCreneauDuVisuel(d: DepotsPasserelle, visuelId: string): Promise<string> {
  for (let n = 1; n <= 50; n++) {
    const id = n === 1 ? `cre_${visuelId}` : `cre_${visuelId}-${n}`;
    const c = await d.creneaux.obtenir(id);
    // Seul un créneau archivé PAR UN RETRAIT (`retireLe`) laisse la place : un créneau refusé puis archivé reste refusé.
    if (!c || c.statut !== "archive" || !c.retireLe) return id;
  }
  throw new ErreurVisuel("PROGRAMMER_REFUSE", "Trop de retraits du calendrier pour ce carrousel : programmation refusée.");
}

/**
 * Crée (ou retrouve) le créneau du visuel validé et le programme. Idempotent : id de créneau stable par visuel.
 * Les vérifications du visuel, des réseaux et des heures se font avant toute écriture. Le créneau est validé AVANT les refus de
 * `programmerVisuel` (ex. visuel déjà programmé ailleurs) : s'il refuse, le créneau reste « valide » mais aucune Publication n'est créée.
 */
export type TextesCreneau = Partial<Record<IdReseau, { texte: string; premierCommentaire: string }>>;

export async function programmerEnUnClic(d: DepotsPasserelle, visuelId: string, jour: string, maintenant: string, textes?: TextesCreneau): Promise<{ creneauId: string; aCompleter: IdReseau[] }> {
  const v = await d.visuels.obtenir(visuelId);
  if (!v) throw new ErreurVisuel("INTROUVABLE", `Visuel introuvable : ${visuelId}`);
  if (v.statut !== "valide" && v.statut !== "programme") throw new ErreurVisuel("PROGRAMMER_REFUSE", `Visuel non validé (statut « ${v.statut} ») : il ne peut pas être programmé.`);
  if (!v.reseaux || v.reseaux.length === 0) throw new ErreurVisuel("PROGRAMMER_SANS_RESEAU", "Aucun réseau préparé : utiliser d'abord « Préparer pour les réseaux ».");
  const creneauId = await idCreneauDuVisuel(d, v.id);
  const existant = await d.creneaux.obtenir(creneauId);
  if (existant) {
    // Créneau déjà créé : l'heure peut être passée depuis le premier clic ; jamais de Publication « programmée » dans le passé.
    const passes = Object.entries(existant.heuresParReseau).filter(([, h]) => Date.parse(h) <= Date.parse(maintenant)).map(([r]) => r);
    if (passes.length > 0) throw new ErreurVisuel("PROGRAMMER_DATE", `Heure de publication déjà passée (${passes.join(", ")}) : choisir un jour plus tard.`);
  } else {
    if (!JOUR.test(jour) || Number.isNaN(Date.parse(jour))) throw new ErreurVisuel("PROGRAMMER_DATE", "Jour invalide (AAAA-MM-JJ attendu).");
    if (jour < jourDeParis(maintenant)) throw new ErreurVisuel("PROGRAMMER_DATE", "Jour invalide : il est déjà passé.");
    const heuresParReseau: Partial<Record<IdReseau, string>> = {};
    for (const r of v.reseaux) heuresParReseau[r] = instantParis(jour, HEURES[r]!);
    const passes = v.reseaux.filter((r) => Date.parse(heuresParReseau[r]!) <= Date.parse(maintenant));
    if (passes.length > 0) throw new ErreurVisuel("PROGRAMMER_DATE", `Heure de publication déjà passée (${passes.join(", ")}) : choisir un jour plus tard.`);
    // Seules les légendes des réseaux préparés et non vides sont gardées : jamais de texte inventé ni d'un autre réseau.
    const gardes: NonNullable<TextesCreneau> = {};
    for (const r of v.reseaux) {
      const t = textes?.[r];
      if (t && t.texte.trim()) gardes[r] = { texte: t.texte, premierCommentaire: t.premierCommentaire ?? "" };
    }
    await creerCreneau(d, { id: creneauId, jourVise: jour, heuresParReseau, compteCible: COMPTE_PAR_DEFAUT, visuelId: v.id, ...(Object.keys(gardes).length > 0 ? { textes: gardes } : {}) }, maintenant);
  }
  await validerParLeFondateur(d, creneauId, maintenant);
  await programmerVisuel(d, creneauId, maintenant);
  // Réseaux sans légende enregistrée : le créneau existe, mais ils restent « à compléter ».
  const final = await d.creneaux.obtenir(creneauId);
  const aCompleter = v.reseaux.filter((r) => !final?.textes?.[r]?.texte?.trim());
  return { creneauId, aCompleter };
}

/** Formulaire d'un clic : l'identifiant du visuel et le jour visé (modifiable). L'action est passée en props. */
export function BoutonProgrammerVisuel({ id, action, jourParDefaut }: { id: string; action: (fd: FormData) => Promise<void>; jourParDefaut: string }) {
  return (
    <form action={action} aria-label="Programmer" className="mb-6 flex flex-wrap items-end gap-3 rounded-champ border border-trait bg-surface-1 px-3.5 py-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm font-semibold text-texte-doux" htmlFor={`jour-${id}`}>
        Jour visé
        <input id={`jour-${id}`} type="date" name="jour" required defaultValue={jourParDefaut} className="min-h-11 rounded-champ border border-trait bg-surface-1 px-3 text-[15px] font-normal text-texte" />
      </label>
      <Bouton type="submit" variante="principal" icone="calendrier">
        Programmer
      </Bouton>
    </form>
  );
}
