"use server";
/**
 * Réglages › Tutoriel d'outil › Réserve. Session exigée. Un seul champ change par envoi (« allumer un par un »).
 * Ne passe PAS par tutoriel-console.ts. N'appelle aucun fournisseur. N'écrit que `tutoriel.reserve.reglages`
 * (par `ecrireReglagesReserve`) : jamais `tutoriel.plafondClaudeUsd`, jamais le plafond de l'usine.
 * La limite par vidéo ne peut que RESTREINDRE le tirage (les plafonds existants restent au-dessus d'elle).
 */
import { revalidatePath } from "next/cache";
import { sousVerrouCreditsPartage } from "@/donnees/memoire";
import {
  PAR_SEMAINE_MAX,
  PARAM_RESERVE_REGLAGES,
  PLAFOND_VIDEO_MAX_CENTIMES,
  lireReglagesReserveBrut,
  type ReglagesReserve,
} from "@/domaine/tutoriel-reserve";
import { ErreurStudio, journaliser, lireParametre, sousVerrou } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { ecrireReglagesReserve } from "@/services/tutoriel-reserve";

export type ResultatReglageReserve = { ok: true } | { ok: false; raison: string };

type ChampSaisi = "actif" | "parSemaine" | "voix" | "plafondVideo";

/** « 1,25 » ou « 1.25 » → 125 centimes. Tout autre format (signe, exposant, texte, 3 décimales) → null. */
function centimesDeSaisie(brut: string): number | null {
  const m = /^\s*(\d{1,2})(?:[.,](\d{1,2}))?\s*$/.exec(brut);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

const interrupteur = (v: unknown): boolean | null => (v === "oui" ? true : v === "non" ? false : null);

/** Applique UN champ sur les réglages lus ; `null` + raison si la saisie est refusée. */
function appliquer(courant: ReglagesReserve, champ: ChampSaisi, valeur: unknown): { suivant: ReglagesReserve; phrase: string } | string {
  if (champ === "actif" || champ === "voix") {
    const v = interrupteur(valeur);
    if (v === null) return "Choisissez Allumer ou Éteindre.";
    return champ === "actif"
      ? { suivant: { ...courant, actif: v }, phrase: `prise automatique ${v ? "allumée" : "éteinte"}` }
      : { suivant: { ...courant, voix: v }, phrase: `voix ${v ? "allumée" : "éteinte"}` };
  }
  if (typeof valeur !== "string") return "La saisie n'est pas valable.";
  if (champ === "parSemaine") {
    if (!/^[0-9]$/.test(valeur.trim()) || Number(valeur) > PAR_SEMAINE_MAX) return `Indiquez un nombre entier de 0 à ${PAR_SEMAINE_MAX}.`;
    const n = Number(valeur);
    return { suivant: { ...courant, parSemaine: n }, phrase: `rythme réglé à ${n} par semaine` };
  }
  const centimes = centimesDeSaisie(valeur);
  if (centimes === null || centimes < 1 || centimes > PLAFOND_VIDEO_MAX_CENTIMES) return "Indiquez une limite de 0,01 à 10,00 (deux décimales au plus).";
  return { suivant: { ...courant, plafondVideoCentimes: centimes }, phrase: "limite par vidéo modifiée" };
}

/** Formulaire : champs `champ` (actif | parSemaine | voix | plafondVideo) et `valeur`. Les autres champs du formulaire sont ignorés. */
export async function enregistrerReglagesReserveAction(donnees: FormData): Promise<ResultatReglageReserve> {
  await exigerSession();
  const champ = donnees.get("champ");
  if (champ !== "actif" && champ !== "parSemaine" && champ !== "voix" && champ !== "plafondVideo") return { ok: false, raison: "Ce réglage n'est pas modifiable ici." };
  const valeur = donnees.get("valeur");
  // Lecture + application + écriture sous les mêmes verrous que la réserve (crédits partagé PUIS boucle, même ordre que RES-1) :
  // sans eux, trois envois simultanés lisent le même état et seul le dernier est gardé.
  const r = await sousVerrouCreditsPartage(() =>
    sousVerrou(async (): Promise<{ phrase: string } | { raison: string }> => {
      // Échec fermé : une lecture qui LÈVE refuse l'envoi sans rien écrire (écrire par-dessus un état illisible l'écraserait avec le défaut,
      // p. ex. en perdant la limite par vidéo). Absent (null) → défaut éteint ; forme corrompue → défaut (lireReglagesReserveBrut).
      let courant: ReglagesReserve;
      try {
        courant = lireReglagesReserveBrut(await lireParametre<unknown>(PARAM_RESERVE_REGLAGES, null));
      } catch {
        return { raison: "Réglages illisibles, réessayez." };
      }
      const a = appliquer(courant, champ, valeur);
      if (typeof a === "string") return { raison: a };
      try {
        await ecrireReglagesReserve(a.suivant);
      } catch (e) {
        if (e instanceof ErreurStudio) return { raison: e.message };
        throw e;
      }
      return { phrase: a.phrase };
    }),
  );
  if ("raison" in r) return { ok: false, raison: r.raison };
  await journaliser("reglage", `Tutoriel d'outil, réserve : ${r.phrase}`);
  revalidatePath("/reglages/tutoriel-outil");
  return { ok: true };
}
