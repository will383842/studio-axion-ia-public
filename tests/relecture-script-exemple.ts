/**
 * Script d'EXEMPLE de l'aperçu « Relire le script » : la vidéo de référence v4 (texte de
 * `docs/formats/v4-reference/voix4.json`, recopié ici pour ne pas embarquer l'horodatage), et un FAUX adaptateur
 * (aucun réseau, aucune dépense). PUR, testé.
 */
import { phrasesDe } from "@/domaine/lecture";
import { niveauPour, type EcritLigne, type LigneScript, type PastilleControle, type ScriptRelu } from "@/domaine/relecture-script";

export const TEXTE_V4 =
  "On recrute nos collaborateurs en quinze minutes. Oui, quinze minutes. Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature. Plus d'une heure, pour chaque personne. Alors on a tout automatisé. La personne voit notre annonce. Elle s'inscrit toute seule, en vingt secondes. Elle reçoit ses e-mails toute seule. Elle choisit elle-même son rendez-vous. Et si elle oublie, le rappel part tout seul. Nous, on arrive pour la visio. Quinze minutes. C'est notre seul travail. Derrière, le contrat part tout seul. Elle signe sur son téléphone. Et le dossier est classé. Résultat : des heures gagnées, à chaque recrutement. Et dans votre entreprise, quelle tâche pourrait tourner toute seule ? Écrivez PLAN en commentaire. On vous envoie le plan de cette machine.";

/** Débit mesuré de la voix v4 : 130 mots lus en 42,9 s. */
export const DEBIT_V4 = 3.03;

const fait = (texte: string): EcritLigne => ({ texte, modifiable: false });
const libre = (texte: string): EcritLigne => ({ texte, modifiable: true });

/** Partie et textes écrits de chaque phrase (rang 1 à 20). */
const HABILLAGE: Record<number, { groupe?: string; ecrits?: EcritLigne[]; verrouille?: boolean }> = {
  1: { groupe: "Accroche", ecrits: [fait("*15* MINUTES")] },
  3: { groupe: "Avant", ecrits: [libre("AVANT")] },
  4: { ecrits: [fait("*+1 H* PAR PERSONNE")] },
  5: { groupe: "La machine", ecrits: [libre("TOUT *AUTOMATISÉ*")] },
  7: { ecrits: [fait("*20 S*")] },
  12: { ecrits: [fait("*15* MIN")] },
  17: { groupe: "Résultat", ecrits: [libre("DES *HEURES* GAGNÉES")] },
  18: { groupe: "Question" },
  19: { groupe: "Appel", ecrits: [fait("PLAN")], verrouille: true },
};

export function lignesV4(): LigneScript[] {
  let groupe = "Accroche";
  return phrasesDe(TEXTE_V4).map((dit, i) => {
    const h = HABILLAGE[i + 1] ?? {};
    groupe = h.groupe ?? groupe;
    return { id: `p${i + 1}`, dit, groupe, ...(h.ecrits ? { ecrits: h.ecrits } : {}), ...(h.verrouille ? { verrouille: true } : {}) };
  });
}

const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

/** Faux contrôle (aucun réseau) : phrase vide, phrase de plus de 20 mots (C8, au barème de la ligne). */
export function controlerEssai(s: ScriptRelu): PastilleControle[] {
  const res: PastilleControle[] = [];
  for (const l of s.lignes) {
    if (!l.dit.trim()) res.push({ ligneId: l.id, niveau: "bloquant", texte: "Phrase vide." });
    else if (mots(l.dit) > 20) {
      const niveau = niveauPour("C8", s.auteurs[l.id] ?? "machine");
      if (niveau) res.push({ ligneId: l.id, niveau, code: "C8", texte: "Plus de 20 mots." });
    }
  }
  return res;
}
