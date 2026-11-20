/**
 * N-05-VOLET-a : choix des 2 captures du volet « avant / après » à partir des captures gardées d'un tutoriel
 * (entrée structurelle `{ cle }[]`) : la première est l'« avant », la dernière l'« après ». Pure : ne lève jamais,
 * ni réglage, ni date, ni hasard. Aucun importeur pour l'instant.
 */
export function capturesDuVolet(captures: unknown): { avant: string; apres: string } | null {
  try {
    if (!Array.isArray(captures)) return null;
    const cles: string[] = [];
    for (const c of captures) {
      const cle = (c as { cle?: unknown } | null)?.cle;
      if (typeof cle === "string" && cle.trim() !== "") cles.push(cle.trim());
    }
    if (cles.length < 2) return null;
    const avant = cles[0]!;
    const apres = cles[cles.length - 1]!;
    return avant === apres ? null : { avant, apres };
  } catch {
    return null;
  }
}
