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
import { validerProposition } from "@/domaine/plan-editorial/statuts";
import { changerStatut, creerCreneau, type CreneauPlan } from "@/services/plan-editorial";
import { programmerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";

/** Heure de publication (Paris) par réseau : fixe, le fondateur peut décaler ensuite depuis le calendrier. */
const HEURES: Partial<Record<IdReseau, string>> = { linkedin: "08:30", instagram: "12:30", facebook: "17:30" };
const COMPTE_CIBLE = "compte-studio";
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
async function validerParLeFondateur(d: DepotsPasserelle, creneauId: string, maintenant: string): Promise<void> {
  if ((await d.creneaux.obtenir(creneauId))?.statut === "propose") await changerStatut(d, creneauId, "a_valider", "studio", maintenant);
  const c = await d.creneaux.obtenir(creneauId);
  if (c?.statut !== "a_valider") return;
  const v = validerProposition(c, "studio", maintenant, "fondateur");
  if (!v.ok) throw new Error(v.raison);
  await d.creneaux.enregistrer(v.creneau as CreneauPlan);
}

/**
 * Crée (ou retrouve) le créneau du visuel validé et le programme. Idempotent : id de créneau stable par visuel.
 * Rien n'est écrit si une vérification échoue.
 */
export async function programmerEnUnClic(d: DepotsPasserelle, visuelId: string, jour: string, maintenant: string): Promise<{ creneauId: string }> {
  const v = await d.visuels.obtenir(visuelId);
  if (!v) throw new Error(`Visuel introuvable : ${visuelId}`);
  if (v.statut !== "valide" && v.statut !== "programme") throw new Error(`Visuel non validé (statut « ${v.statut} ») : il ne peut pas être programmé.`);
  if (!v.reseaux || v.reseaux.length === 0) throw new Error("Aucun réseau préparé : utiliser d'abord « Préparer pour les réseaux ».");
  const creneauId = `cre_${v.id}`;
  const existant = await d.creneaux.obtenir(creneauId);
  if (existant) {
    // Créneau déjà créé : l'heure peut être passée depuis le premier clic ; jamais de Publication « programmée » dans le passé.
    const passes = Object.entries(existant.heuresParReseau).filter(([, h]) => Date.parse(h) <= Date.parse(maintenant)).map(([r]) => r);
    if (passes.length > 0) throw new Error(`Heure de publication déjà passée (${passes.join(", ")}) : choisir un jour plus tard.`);
  } else {
    if (!JOUR.test(jour) || Number.isNaN(Date.parse(jour))) throw new Error("Jour invalide (AAAA-MM-JJ attendu).");
    if (jour < jourDeParis(maintenant)) throw new Error("Jour invalide : il est déjà passé.");
    const heuresParReseau: Partial<Record<IdReseau, string>> = {};
    for (const r of v.reseaux) heuresParReseau[r] = instantParis(jour, HEURES[r]!);
    const passes = v.reseaux.filter((r) => Date.parse(heuresParReseau[r]!) <= Date.parse(maintenant));
    if (passes.length > 0) throw new Error(`Heure de publication déjà passée (${passes.join(", ")}) : choisir un jour plus tard.`);
    await creerCreneau(d, { id: creneauId, jourVise: jour, heuresParReseau, compteCible: COMPTE_CIBLE, visuelId: v.id }, maintenant);
  }
  await validerParLeFondateur(d, creneauId, maintenant);
  await programmerVisuel(d, creneauId, maintenant);
  return { creneauId };
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
