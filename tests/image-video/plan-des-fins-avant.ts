/**
 * PLAN DES FINS D'AVANT LE 26/10/2026 (fin « diagnostic » par réseau, question de commentaire par défaut, LinkedIn muet).
 *
 * `planDesFinsIV` ne le produit plus : fin = accroche + appel + lien, LinkedIn dit la fin. Mais le plan d'une vidéo faite
 * avant (ou en cours de fabrication, par exemple arrêtée sur une fin de secours) reste GARDÉ dans son état et doit se
 * lire, se reprendre et se publier comme avant (« les vidéos déjà faites ne changent pas »). Les tests des chaînes de
 * secours (Facebook, Instagram, Shorts) le prouvent sur ce plan, recopié de l'ancienne `planDesFinsIV` (sans fin au mot,
 * qui n'a pas changé).
 */
import { ErreurFin, TABLE_FINS_DIAGNOSTIC, appelDeLaBanque, groupeDe, suiteDeFins, type FinChoisie, type FinTable } from "@/briques/fins";
import { RESEAUX_IV, RESEAUX_IV_HISTORIQUE } from "@/domaine/image-video/plafonds";
import type { DemandePlanDesFinsIV, FinIV, PlanDesFinsIV } from "@/moteurs/montage-image-video/fins";

const DIAGNOSTIC = {
  facebook: ["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"],
  instagram: ["fin-if-diagnostic-gratuit", "fin-ig-lien-profil"],
  tiktok: ["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"],
  "youtube-shorts": ["fin-ty-diagnostic-gratuit", "fin-ty-lien-profil"],
} as const;
const QUESTION = { facebook: "fin-if-question", instagram: "fin-if-question", tiktok: "fin-ty-question-tache", "youtube-shorts": "fin-ty-question-tache" } as const;
const LIGNES_LINKEDIN_MUETTES = ["fin-li-question", "fin-li-rdv-texte"];

function table(): FinTable[] {
  const t: FinTable[] = [...TABLE_FINS_DIAGNOSTIC];
  const a = appelDeLaBanque("fin-ty-lien-profil")!;
  t.push({ id: a.code, groupe: groupeDe(a.reseaux[0]), type: a.type, dit: a.dit, ecran: a.ecran, validee: a.etat === "valide", reseaux: a.reseaux });
  return t;
}

export function planDesFinsAvant(demande: DemandePlanDesFinsIV): PlanDesFinsIV {
  const question = demande.appelCommentaire !== "fin-seule";
  const t = table();
  const groupes = new Map<string, FinIV>();
  const sansFin: PlanDesFinsIV["sansFin"] = [];
  for (const reseau of RESEAUX_IV.filter((r) => demande.reseaux.includes(r))) {
    if (reseau === "linkedin") {
      const muet = LIGNES_LINKEDIN_MUETTES.every((c) => appelDeLaBanque(c)?.dit === "" && appelDeLaBanque(c)?.ecran === "");
      if (!muet) throw new Error("la banque dit quelque chose sur LinkedIn");
      groupes.set("linkedin", { id: "fin-linkedin", reseaux: ["linkedin"], muet: true, appels: [] });
      continue;
    }
    const ids = DIAGNOSTIC[reseau];
    let appels: FinChoisie[];
    try {
      appels = suiteDeFins(reseau, ids, {}, t);
    } catch (e) {
      if (!(e instanceof ErreurFin)) throw e;
      sansFin.push({ reseaux: [reseau], raison: e.message });
      continue;
    }
    let q: FinIV["question"];
    if (question) {
      const l = appelDeLaBanque(QUESTION[reseau])!;
      const propre = demande.questionCommentaire?.trim();
      q = { dit: propre || l.dit, ecran: l.ecran, origine: propre ? "image" : "banque", ligne: QUESTION[reseau] };
    }
    const cle = [q?.dit ?? "", q?.ecran ?? "", ...ids].join("|");
    const g = groupes.get(cle);
    if (g) g.reseaux.push(reseau);
    else groupes.set(cle, { id: "", reseaux: [reseau], muet: false, ...(q ? { question: q } : {}), appels });
  }
  const fins = [...groupes.values()].map((g) => ({ ...g, id: g.muet ? g.id : `fin-${g.reseaux.join("-")}` }));
  fins.sort((a, b) => RESEAUX_IV_HISTORIQUE.indexOf(a.reseaux[0]) - RESEAUX_IV_HISTORIQUE.indexOf(b.reseaux[0]));
  return { fins, reduites: [], sansFin };
}
