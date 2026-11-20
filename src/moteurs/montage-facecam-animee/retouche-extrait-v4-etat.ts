/**
 * R4-03-c1-v20j : écrit en avance, monté nulle part ; R4-03-c2 le branche dans `retoucher` (index.ts) ; 0 €, aucun réglage lu (`actif` injecté).
 * Décision et enchaînement de la retouche « changer l'extrait d'un téléphone » : la demande doit viser CETTE version, puis
 * clip (remplacer seulement), application au projet gardé, reprise au rendu. Tout passe par des ports injectés.
 */
export const CLE_ENTREE_RETOUCHE_EXTRAIT_V4 = "retoucheExtraitV4";

type Refus = { refus: { code: string; message: string } };

const EXTRAIT_IMPOSSIBLE: Refus = { refus: { code: "EXTRAIT_IMPOSSIBLE", message: "Le changement d'extrait n'a pas pu être préparé : rien n'a changé." } };

/** La demande liée à la version `parentVersionId` (sans `pourVersionId`), sinon `null` : une demande d'une autre version n'est jamais rejouée. */
export function demandeExtraitPourCetteVersionV4<D>(entrees: Record<string, unknown> | undefined, parentVersionId: string | undefined, lire: (x: unknown) => D | null): D | null {
  try {
    const brute = entrees?.[CLE_ENTREE_RETOUCHE_EXTRAIT_V4];
    if (typeof brute !== "object" || brute === null || Array.isArray(brute)) return null;
    const { pourVersionId, ...reste } = brute as Record<string, unknown>;
    if (typeof pourVersionId !== "string" || pourVersionId === "" || pourVersionId !== parentVersionId) return null;
    return lire(reste);
  } catch {
    return null;
  }
}

export async function etatRetoucheExtraitV4<D extends { action: string }, P, C, E>(
  e: { entrees: Record<string, unknown> | undefined; parentVersionId: string | undefined; actif: boolean },
  f: {
    lire: (x: unknown) => D | null;
    projet: () => P | null;
    clip: (projet: P, demande: D) => Promise<C | Refus>;
    appliquer: (projet: P, demande: D, clip?: C) => { projet: P } | Refus;
    reprendre: (projet: P) => E | null;
    refusProjet: () => { code: string; message: string };
  },
): Promise<null | { etat: E } | Refus> {
  if (!e.actif) return null;
  try {
    const demande = demandeExtraitPourCetteVersionV4(e.entrees, e.parentVersionId, f.lire);
    if (!demande) return null;
    const projet = f.projet();
    if (projet === null || projet === undefined) return { refus: f.refusProjet() };
    let clip: C | undefined;
    if (demande.action === "remplacer") {
      const c = await f.clip(projet, demande);
      if (typeof c === "object" && c !== null && "refus" in c) return c as Refus;
      clip = c as C;
    }
    const applique = f.appliquer(projet, demande, clip);
    if ("refus" in applique) return applique;
    const etat = f.reprendre(applique.projet);
    return etat === null || etat === undefined ? { refus: f.refusProjet() } : { etat };
  } catch {
    return EXTRAIT_IMPOSSIBLE;
  }
}
