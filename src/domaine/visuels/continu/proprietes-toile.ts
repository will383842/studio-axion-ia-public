import { GABARITS } from "../../../briques/visuels/continu/registre-gabarits";
import { ToileSpec, type ToileSpecType } from "./schema-toile";
import { VERSION_TOILE_SOCLE } from "./version";

export interface VersionsToile {
  socle: string;
  gabarits: Record<string, number>;
}

/** Valide les propriétés d'une toile reçues par studio-rendu. Les erreurs de version commencent par « Version de toile ». */
export function validerProprietesToile(brut: unknown): { toile: ToileSpecType; versions: VersionsToile } {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) throw new Error("Propriétés de toile invalides : un objet est attendu");
  const inconnues = Object.keys(brut).filter((c) => c !== "toile" && c !== "versions");
  if (inconnues.length) throw new Error(`Propriétés de toile invalides : clé inconnue (${inconnues.join(", ")})`);
  const { toile, versions } = brut as { toile?: unknown; versions?: unknown };

  const v = versions as { socle?: unknown; gabarits?: unknown } | undefined;
  if (!v || typeof v !== "object" || Object.keys(v).some((c) => c !== "socle" && c !== "gabarits")) throw new Error("Version de toile absente ou invalide");
  if (v.socle !== VERSION_TOILE_SOCLE) throw new Error(`Version de toile indisponible : socle ${String(v.socle)} au lieu de ${VERSION_TOILE_SOCLE}`);
  const gabarits = (v.gabarits ?? {}) as Record<string, unknown>;
  for (const [type, version] of Object.entries(gabarits)) {
    const g = GABARITS.find((x) => x.type === type);
    if (!g || g.version !== version) throw new Error(`Version de toile indisponible : gabarit ${type} version ${String(version)} au lieu de ${g ? g.version : "inconnu"}`);
  }

  const r = ToileSpec.safeParse(toile);
  if (!r.success) throw new Error(`Toile invalide : ${r.error.issues.map((i) => i.message).join(" ; ")}`);
  return { toile: r.data as ToileSpecType, versions: { socle: v.socle, gabarits: gabarits as Record<string, number> } };
}
