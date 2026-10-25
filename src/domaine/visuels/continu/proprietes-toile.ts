import { GABARITS } from "../../../briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../../briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../../briques/visuels/continu/registre-raccords";
import { ToileSpec, type ToileSpecType } from "./schema-toile";
import { VERSION_TOILE_SOCLE } from "./version";

export interface VersionsToile {
  socle: string;
  gabarits: Record<string, number>;
  parcours: Record<string, number>;
  raccords: Record<string, number>;
}

const CLES_VERSIONS = ["socle", "gabarits", "parcours", "raccords"];

function objetSimple(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Valide une table de versions (gabarits, parcours ou raccords) contre le registre : chaque entrée doit exister et porter la version courante. */
function tableDeVersions(brut: unknown, nom: string, registre: { id: string; version: number }[]): Record<string, number> {
  if (brut === undefined) return {};
  if (!objetSimple(brut)) throw new Error(`Version de toile invalide : les versions des ${nom}s doivent former un objet`);
  for (const [id, version] of Object.entries(brut)) {
    const e = registre.find((x) => x.id === id);
    if (!e || e.version !== version) throw new Error(`Version de toile indisponible : ${nom} ${id} version ${String(version)} au lieu de ${e ? e.version : "inconnu"}`);
  }
  return brut as Record<string, number>;
}

/** Valide les propriétés d'une toile reçues par studio-rendu. Les erreurs de version commencent par « Version de toile » : « indisponible » (versions pas encore alignées) est réessayable, « absente » et « invalide » donnent un refus. */
export function validerProprietesToile(brut: unknown): { toile: ToileSpecType; versions: VersionsToile } {
  if (!objetSimple(brut)) throw new Error("Propriétés de toile invalides : un objet est attendu");
  const inconnues = Object.keys(brut).filter((c) => c !== "toile" && c !== "versions");
  if (inconnues.length) throw new Error(`Propriétés de toile invalides : clé inconnue (${inconnues.join(", ")})`);

  const v = brut.versions;
  if (!objetSimple(v) || Object.keys(v).some((c) => !CLES_VERSIONS.includes(c))) throw new Error("Version de toile absente ou invalide");
  if (v.socle !== VERSION_TOILE_SOCLE) throw new Error(`Version de toile indisponible : socle ${String(v.socle)} au lieu de ${VERSION_TOILE_SOCLE}`);
  const gabarits = tableDeVersions(v.gabarits, "gabarit", GABARITS.map((g) => ({ id: g.type, version: g.version })));
  const parcours = tableDeVersions(v.parcours, "parcours", PARCOURS);
  const raccords = tableDeVersions(v.raccords, "raccord", RACCORDS.map((r) => ({ id: r.type, version: r.version })));

  const r = ToileSpec.safeParse(brut.toile);
  if (!r.success) throw new Error(`Toile invalide : ${r.error.issues.map((i) => i.message).join(" ; ")}`);
  const toile = r.data;

  // Chaque gabarit, parcours et raccord utilisé doit avoir sa version déclarée (et courante, vérifiée ci-dessus).
  const types = new Set(toile.pages.map((p) => p.type));
  for (const type of types) if (gabarits[type] === undefined) throw new Error(`Version de toile absente : gabarit ${type}`);
  for (const p of PARCOURS) if (p.pagesTypes.some((t) => types.has(t)) && parcours[p.id] === undefined) throw new Error(`Version de toile absente : parcours ${p.id}`);
  for (const t of new Set(toile.raccords.map((x) => x.type))) if (raccords[t] === undefined) throw new Error(`Version de toile absente : raccord ${t}`);

  return { toile, versions: { socle: v.socle, gabarits, parcours, raccords } };
}
