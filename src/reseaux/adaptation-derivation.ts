/**
 * Lot G2 : pose les adaptations gratuites (`adaptations.ts`) sur les blocs d'UNE version par réseau. PUR : aucun appel payant,
 * aucune lecture de base. Seule la coupe du segment facultatif est branchée ici (voir docs/ecriture/LOT-D.md pour le reste).
 * Garde-fous : réglage coupé (seul `true` strict allume), script de Will (collé), avocat, réseau hors déclinaison : les blocs
 * reçus sont rendus TELS QUELS (même référence). Toute erreur retombe sur le comportement actuel.
 */
import type { BlocScript } from "@/domaine/types";
import { adaptationsActives, segmentsFacultatifsRetenus } from "./adaptations";
import { ecritureReseau } from "./ecriture";
import type { ReseauDeclinaison } from "@/domaine/types";

const RESEAUX: readonly string[] = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"];

export function adapterBlocsDuCorps(e: { actif: unknown; blocs: BlocScript[]; reseau: string; formatId: string; estCollee: boolean; dureeTexte: (texte: string) => number; /** Durée de l'ouverture et de la fin (le plafond porte sur TOUTE la vidéo). */ dureeHorsCorpsSec?: number }): BlocScript[] {
  try {
    if (!adaptationsActives(e.actif) || e.estCollee || e.formatId === "avocat" || !RESEAUX.includes(e.reseau)) return e.blocs;
    const reseau = e.reseau as ReseauDeclinaison;
    if (!ecritureReseau(reseau).segmentFacultatif.valeur) return e.blocs;
    const tous = e.blocs.flatMap((b) => b.segments);
    // Matière saisie par Will (`sourceTexte`) ou phrase écrite/retouchée par Will (`ecritPar`) : jamais coupée ; elle compte donc dans la durée fixe, pas dans les candidats.
    const deWill = (s: BlocScript["segments"][number]) => !!s.sourceTexte || s.ecritPar === "will";
    const facultatifs = tous.filter((s) => s.facultatif === reseau && s.texte.trim() && !deWill(s));
    if (!facultatifs.length) return e.blocs;
    const fixes = tous.filter((s) => !s.facultatif || (s.facultatif === reseau && deWill(s)));
    const dureeSansFacultatifSec = e.dureeTexte(fixes.map((s) => s.texte).join(" ")) + (e.dureeHorsCorpsSec ?? 0);
    const gardes = new Set(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau, dureeSansFacultatifSec, facultatifs: facultatifs.map((s) => ({ id: s.id, dureeSec: e.dureeTexte(s.texte) })) }));
    if (facultatifs.every((s) => gardes.has(s.id))) return e.blocs;
    return e.blocs
      .map((b) => ({ ...b, segments: b.segments.filter((s) => !(s.facultatif === reseau && !deWill(s) && !gardes.has(s.id))) }))
      .filter((b) => b.segments.length > 0);
  } catch {
    return e.blocs;
  }
}
