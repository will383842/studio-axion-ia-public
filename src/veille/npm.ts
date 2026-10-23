/** Source « registre npm » : dernière version publiée (`dist-tags.latest`) et sa date. Page publique, gratuite. */
import { empreinte, lireJson, SourceMuette } from "./http";
import type { ContexteLecture, Lecture } from "./types";

interface DocumentNpm {
  "dist-tags"?: { latest?: string };
  time?: Record<string, string>;
}

export async function lireNpm(paquet: string, c: ContexteLecture): Promise<Lecture> {
  try {
    const doc = await lireJson<DocumentNpm>(c.appeler, `https://registry.npmjs.org/${encodeURIComponent(paquet).replace("%40", "@")}`, c.delaiMs);
    const version = doc["dist-tags"]?.latest;
    if (!version) return { ok: false, raison: "Aucune version publiée trouvée." };
    return {
      ok: true,
      version,
      date: doc.time?.[version],
      lien: `https://www.npmjs.com/package/${paquet}/v/${version}`,
      notes: `${paquet} ${version}`,
      empreinte: empreinte(version),
    };
  } catch (e) {
    return { ok: false, raison: e instanceof SourceMuette ? e.raison : "La source ne répond pas." };
  }
}
