/**
 * NOTE UNIQUE par code et VOYANT (plan v5 B.7.5). PUR.
 * Garde-fous (passe / échoue), puis leviers /100. Les poids ne sont pas étalonnés : ils le seront en G5 sur les
 * étiquettes de Will. Avant G5, seule cette note par code compte ; le choix entre deux bons textes passe par PREF-01.
 */
import { GARDE_FOUS } from "./niveaux";
import type { ViolationControle } from "./types";

export const LEVIERS: readonly { id: string; nom: string; points: number; controles: string[] }[] = [
  { id: "accroche", nom: "Accroche", points: 20, controles: ["C3 bis", "C8", "C41", "C69", "C70", "C14", "C19", "C78"] },
  { id: "preuve", nom: "Preuve et ancrage", points: 12, controles: ["C83", "C1", "C1 bis", "C1 ter", "C2", "C7", "C15", "C16", "C16 bis", "C28", "C29", "C31", "C55", "C57", "C59", "C68", "C76"] },
  { id: "retention", nom: "Rétention", points: 12, controles: ["C11", "C38", "C38 bis", "C39", "C46", "C46 bis", "C62", "C10 ter", "C33", "C81", "C82", "C89", "C90", "C91", "C92", "C93"] },
  { id: "envoi", nom: "Envoi", points: 10, controles: ["C64"] },
  { id: "livraison", nom: "Livraison", points: 8, controles: ["C6", "C6 bis", "C71", "C79"] },
  { id: "mot-cle", nom: "Mot-clé", points: 8, controles: ["C10", "C10 bis", "C75", "C13", "C36"] },
  { id: "oralite", nom: "Oralité", points: 8, controles: ["C5", "C5 bis", "C5 ter", "C9", "C9 bis", "C12", "C24", "C25", "C25 bis", "C27", "C35"] },
  { id: "appel", nom: "Appel", points: 6, controles: ["C3", "C21", "C21 bis", "C34", "C63", "C72"] },
  { id: "ressenti", nom: "Ressenti", points: 6, controles: ["C50", "C51", "C65"] },
  { id: "concret", nom: "Concret", points: 4, controles: ["C17", "C17 bis", "C18", "C20", "C22", "C23", "C26", "C54", "C60", "C73", "C74", "C77"] },
  { id: "ton", nom: "Ton", points: 4, controles: ["C4", "C32", "C37", "C40", "C42", "C48"] },
  { id: "structure", nom: "Structure", points: 2, controles: ["C30", "C30 bis", "C30 ter", "C45 bis", "C66"] },
];

const RETRAIT: Record<ViolationControle["niveau"], number> = { bloquant: 0.5, alerte: 0.2, correction: 0.1, info: 0 };
/** Contrôles de rétention (C89-C93) : des informations qui pèsent quand même, peu (1,2 point chacune sur 12). */
const RETRAIT_INFO_RETENTION: Readonly<Record<string, number>> = { C89: 0.1, C90: 0.1, C91: 0.1, C92: 0.1, C93: 0.1 };
const retraitDe = (v: ViolationControle) => (v.niveau === "info" ? (RETRAIT_INFO_RETENTION[v.controle] ?? 0) : RETRAIT[v.niveau]);

export interface NoteVersion {
  globale: number;
  criteres: Record<string, number>;
  gardeFous: { passe: boolean; echecs: string[] };
}

export function noterVersion(violations: ViolationControle[]): NoteVersion {
  const criteres: Record<string, number> = {};
  let globale = 0;
  for (const l of LEVIERS) {
    const retrait = violations.filter((v) => l.controles.includes(v.controle)).reduce((s, v) => s + retraitDe(v) * l.points, 0);
    const points = Math.max(0, +(l.points - retrait).toFixed(2));
    criteres[l.id] = points;
    globale += points;
  }
  const echecs = [...new Set(violations.filter((v) => v.bloquant && GARDE_FOUS.includes(v.controle)).map((v) => v.controle))];
  return { globale: Math.round(globale), criteres, gardeFous: { passe: !echecs.length, echecs } };
}

/** Voyant d'une version : vert (≥ 85, garde-fous passés), ambre (70-84), rouge (garde-fou échoué ou < 70). */
export function voyant(note: NoteVersion): "vert" | "ambre" | "rouge" {
  if (!note.gardeFous.passe || note.globale < 70) return "rouge";
  return note.globale >= 85 ? "vert" : "ambre";
}
