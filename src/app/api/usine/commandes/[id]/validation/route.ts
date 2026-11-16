import type { NextRequest } from "next/server";
import { depots } from "@/donnees/memoire";
import { CODES_REFUS, NOTE_MAX, VALIDE_PAR, traiterValidation, validerEntreeDuServeur, type CodeRefus } from "@/services/porte-validation";
import { journaliser } from "@/services/_commun";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2, appel 3 : la validation (ou le refus) venue de l'Usine pour une commande. La route n'appelle que
 * `validerEntreeServeur` (CAL-21) : l'envoi reste derrière les trois réglages, éteints. Aucun réglage écrit.
 * Le corps n'accepte aucun champ d'état (la garde renvoie 400 `champ_invalide`). Le journal ne garde ni texte ni note.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/commandes/[id]/validation";
const HEX64 = /^[0-9a-f]{64}$/;
const INSTANT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function toutArreterActif(): boolean {
  const v = (process.env.USINE_TOUT_ARRETER ?? "").trim().toLowerCase();
  return !["", "0", "false", "non"].includes(v);
}

export async function POST(requete: NextRequest, contexte: { params: Promise<{ id: string }> }) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["etape", "decision", "empreinte", "valide_par", "valide_le", "refus_code", "note", "repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    if (toutArreterActif()) {
      statut = 423;
      return reponseErreur(423, "Tout est arrêté : la validation est refusée.", "tout_arrete");
    }
    const invalide = (message: string) => {
      statut = 400;
      return reponseErreur(400, message, "champ_invalide");
    };
    const { etape, decision, empreinte, valide_par: validePar, valide_le: validele, refus_code: refusCode, note } = porte.corps;
    if (etape !== "video" && etape !== "script") return invalide("Étape inconnue.");
    if (decision !== "valide" && decision !== "refuse") return invalide("Décision inconnue.");
    if (typeof empreinte !== "string" || !HEX64.test(empreinte)) return invalide("Empreinte illisible.");
    if (typeof validePar !== "string" || !VALIDE_PAR.test(validePar)) return invalide("Auteur de la validation illisible.");
    if (typeof validele !== "string" || !INSTANT_UTC.test(validele) || Number.isNaN(Date.parse(validele))) return invalide("Date de validation illisible.");
    if (decision === "refuse" && (typeof refusCode !== "string" || !(CODES_REFUS as readonly string[]).includes(refusCode))) return invalide("Motif de refus inconnu.");
    if (note !== undefined && (typeof note !== "string" || note.length > NOTE_MAX || /[\r\n]/.test(note))) return invalide("Note illisible (300 signes, une ligne).");

    const { id } = await contexte.params;
    const d = depots();
    const r = await traiterValidation(
      { depots: { creneaux: d.creneauxEditoriaux, journal: d.journalDecalages }, validerEntree: validerEntreeDuServeur, maintenant: () => new Date().toISOString() },
      id,
      { etape, decision, empreinte, validePar, ...(decision === "refuse" ? { refusCode: refusCode as CodeRefus } : {}), ...(typeof note === "string" && note ? { note } : {}) },
    );
    // Trace de la décision : clé, étape, décision, 12 premiers signes de l'empreinte, auteur. Ni note ni texte.
    try {
      await journaliser("porte", `Validation usine ${id} étape ${etape} décision ${decision} empreinte ${empreinte.slice(0, 12)} par usine:${validePar} : ${r.ok ? "acceptée" : `refusée (${r.http})`}`);
    } catch {
      /* le journal ne change jamais la réponse */
    }
    if (!r.ok) {
      statut = r.http;
      return reponseErreur(r.http, r.message, r.code);
    }
    return reponseJson(200, r.corps);
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
