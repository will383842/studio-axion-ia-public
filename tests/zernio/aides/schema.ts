import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";

// Validateur minimal contre l'extrait OpenAPI Zernio (spec 1.429.1, fichier nommé 1.418.1).
const CHEMIN = resolve(process.cwd(), "docs/zernio/openapi-extrait-1.418.1.json");

export type Spec = {
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};

export function chargerExtrait(): Spec {
  return JSON.parse(readFileSync(CHEMIN, "utf8")) as Spec;
}

export function creerValidateur(spec: Spec = chargerExtrait()) {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  ajv.addSchema(spec, "spec");
  return (nomSchema: string, valeur: unknown): { ok: boolean; erreurs: string[] } => {
    const v = ajv.getSchema(`spec#/components/schemas/${nomSchema}`);
    if (!v) throw new Error(`schéma inconnu : ${nomSchema}`);
    const ok = v(valeur) as boolean;
    return { ok, erreurs: (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`) };
  };
}
