"use server";

/**
 * « Retenir ce sujet » (carte d'une proposition de la semaine). Le navigateur n'envoie QUE `debut` (lundi de la semaine) et `cle` (la carte) :
 * le sujet, le jour et le réseau sont relus ici, dans la dernière semaine gardée par le serveur (réglage `calendrier.proposerSemaine.derniere`).
 * Une clé inconnue, ou d'une autre semaine, est refusée. Le secret de l'usine ne quitte jamais le serveur.
 * Aucun appel de modèle, aucune dépense, rien chez le diffuseur, aucun créneau créé, aucune fabrication lancée :
 * on écrit le sujet au Studio (`ecrireSujetDeLUsine`) et l'usine note le jour et le réseau visés (porte `retenir`).
 * Verrou : contrôle « déjà traité » et écriture passent l'un après l'autre (deux onglets, deux clics : un seul sujet). C'est `creerVerrou()`
 * et non `sousVerrou`, car `creerSujet` prend déjà `sousVerrou` (non réentrant : le même verrou bloquerait). Valable pour un seul processus.
 */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { exigerSession } from "@/services/auth";
import { creerVerrou, depots, ErreurStudio, essayer, maintenant, type Resultat } from "@/services/_commun";
import { lireDerniereSemaine } from "@/services/proposer-semaine";
import { avecViseeUsine, retenirSujetUsine, usineActive } from "@/services/usine-porte";
import { ecrireSujetDeLUsine } from "@/services/usine-sujet";
import { creerCarrouselDeLUsine } from "@/services/usine-carrousel";
import { lancerRendu } from "@/visuels/services/carrousels";
import { dependancesCarrousels } from "@/visuels/services/production";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";

const idee = z.object({
  signature: z.string().min(1),
  parts: z.record(z.string(), z.string().nullable()),
  metier: z.string(),
  taille: z.string(),
  service: z.string().optional(),
  douleur: z.string().min(1),
  casUsage: z.string(),
  sujet: z.string().optional(),
  format: z.string().optional(),
  famille: z.string().optional(),
  fin: z.string().optional(),
});
const visee = z.object({
  jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reseau: z.enum(RESEAUX_DECLINAISON as [string, ...string[]]),
});
const unALaFois = creerVerrou();

const PHRASE_PROPOSITION_INCONNUE = "Cette proposition n'est plus à jour. Demandez la semaine à nouveau, puis retenez le sujet.";

export async function retenirSujetSemaineAction(debut: unknown, cle: unknown): Promise<Resultat<{ id: string; rappelUsine: boolean; type?: "carrousel" }>> {
  await exigerSession();
  return essayer(() =>
    unALaFois(async () => {
      if (!usineActive()) throw new ErreurStudio("USINE_ETEINTE", "L'usine n'est pas reliée.");
      const derniere = typeof debut === "string" && typeof cle === "string" ? await lireDerniereSemaine() : null;
      const proposition = derniere && derniere.debut === debut ? derniere.propositions.find((p) => p.cle === cle) : undefined;
      if (!proposition) throw new ErreurStudio("RETENIR_INCONNUE", PHRASE_PROPOSITION_INCONNUE);
      const v = visee.safeParse({ jour: proposition.jour, reseau: proposition.reseau });
      const i = idee.safeParse(proposition.sujet);
      if (!v.success || !i.success) throw new ErreurStudio("RETENIR_VISEE", "Ce jour ou ce réseau n'est pas reconnu : le sujet n'a pas été retenu.");
      if (proposition.type === "carrousel") {
        // Carrousel : un brouillon à relire (jamais validé, préparé, programmé ni publié). `ecrireSujetDeLUsine` refuserait (formats vidéo seulement).
        const c = await creerCarrouselDeLUsine(i.data, { reseau: v.data.reseau, jour: v.data.jour });
        after(async () => {
          try {
            await lancerRendu(c.id, dependancesCarrousels());
          } catch {
            // Un brouillon bloqué par la porte ne se rend pas : la fiche l'explique.
          }
        });
        revalidatePath("/calendrier");
        revalidatePath("/carrousels");
        return { ...c, type: "carrousel" as const };
      }
      // Un sujet venu de l'usine est numéroté trop tard pour `controlerSujetCentral` : on refuse ici, sous le verrou, la même signature déjà retenue.
      const dejaRetenu = await depots().scriptsMaitres.trouver((m) => !m.archiveLe && m.origineUsine?.signature === i.data.signature);
      if (dejaRetenu) {
        // L'Usine n'a pas confirmé (panne de `retenir` au premier essai) : on la rappelle, le contrat prévoit le rejeu (`deja: true`).
        if (!dejaRetenu.origineUsine?.prevenueLe && dejaRetenu.origineUsine) {
          const o = dejaRetenu.origineUsine;
          if (await avecViseeUsine(v.data, () => retenirSujetUsine(o, dejaRetenu.id))) {
            await depots().scriptsMaitres.modifier(dejaRetenu.id, { origineUsine: { ...o, prevenueLe: maintenant() } });
          }
        }
        throw new ErreurStudio("RETENIR_DEJA", "Ce sujet est déjà retenu.");
      }
      const r = await avecViseeUsine(v.data, () => ecrireSujetDeLUsine(i.data, { reseaux: [v.data.reseau], typeContenu: "video", dateVisee: v.data.jour }));
      revalidatePath("/calendrier");
      return r;
    }),
  );
}
