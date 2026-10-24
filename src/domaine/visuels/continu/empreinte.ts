import { createHash } from "node:crypto";
import { GABARITS } from "../../../briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../../briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../../briques/visuels/continu/registre-raccords";
import { canonique } from "./canonique";
import type { ToileSpecType } from "./schema-toile";
import { VERSION_TOILE_SOCLE } from "./version";

/** Empreinte SHA-256 de la toile : socle, versions des gabarits, parcours et raccords utilisés, puis toile canonique. */
export function empreinteToile(toile: ToileSpecType): string {
  const types = new Set(toile.pages.map((p) => p.type));
  const gabarits = GABARITS.filter((g) => types.has(g.type)).map((g) => `${g.type}:${g.version}`).sort();
  const parcours = PARCOURS.filter((p) => p.pagesTypes.some((t) => types.has(t))).map((p) => `${p.id}:${p.version}`).sort();
  const utilises = new Set(toile.raccords.map((r) => r.type));
  const raccords = RACCORDS.filter((r) => utilises.has(r.type)).map((r) => `${r.type}:${r.version}`).sort();
  const entete = [VERSION_TOILE_SOCLE, gabarits.join(","), parcours.join(","), raccords.join(",")].join("\n");
  return createHash("sha256").update(`${entete}\n${canonique(toile)}`).digest("hex");
}
