/**
 * LOT R1 — LECTURE D'UNE PUBLICATION BUFFER (LECTURE SEULE, GRATUIT), pour l'essai réel du premier brouillon.
 *
 * Affiche l'état (brouillon, programmée…), la date, le compte, et surtout l'HÔTE de la vidéo telle que Buffer la garde :
 *  - hôte Buffer (ou CDN) → Buffer a recopié la vidéo : l'adresse signée R2 (7 jours) peut expirer sans risque ;
 *  - hôte `r2.cloudflarestorage.com` → Buffer relira l'adresse du studio : programmer à moins de 7 jours.
 * N'affiche jamais la clé, ni l'adresse complète (signature), ni le texte.
 *
 * Usage (racine du dépôt) : BUFFER_API_KEY=… pnpm exec tsx outils/buffer/lire-publication.mts <identifiant Buffer>
 *                          BUFFER_API_KEY=… pnpm exec tsx outils/buffer/lire-publication.mts --derniers
 * `--derniers` : les 5 dernières publications créées (identifiant, statut, réseau, création), pour retrouver un brouillon.
 */
import { nettoyerDetail } from "../../src/fournisseurs/mesures/commun";

const cle = process.env.BUFFER_API_KEY?.trim();
const id = process.argv[2]?.trim();
if (!cle || !id || (id !== "--derniers" && !/^[A-Za-z0-9_-]{6,64}$/.test(id))) {
  console.error("Usage : BUFFER_API_KEY=… pnpm exec tsx outils/buffer/lire-publication.mts <identifiant Buffer> | --derniers");
  process.exit(2);
}

async function lire(query: string, variables: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; errors?: { message?: string }[] }> {
  const rep = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${cle}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!rep.ok) throw new Error(`Buffer a répondu ${rep.status}.`);
  try {
    return (await rep.json()) as { data?: Record<string, unknown>; errors?: { message?: string }[] };
  } catch {
    // Jamais le corps brut (il pourrait reprendre la clé ou une adresse signée) : le code HTTP seulement.
    throw new Error(`Buffer a répondu ${rep.status}, réponse illisible.`);
  }
}

const QUERY = `query LecturePublication($id: PostId!) {
  post(input: { id: $id }) {
    id status dueAt sentAt createdAt channelId channelService shareMode externalLink
    error { message }
    assets { __typename mimeType source thumbnail }
  }
}`;

const hote = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return "(illisible)";
  }
};

type Lu = { data?: Record<string, unknown>; errors?: { message?: string }[] };

if (id === "--derniers") {
  const compte = await lire("query Compte { account { organizations { id } } }", {});
  const org = ((compte.data?.account as { organizations?: { id: string }[] } | undefined)?.organizations ?? [])[0]?.id;
  const posts = await lire(
    "query Derniers($o: OrganizationId!) { posts(first: 5, input: { organizationId: $o, sort: [{ field: createdAt, direction: desc }] }) { edges { node { id status channelService createdAt dueAt } } } }",
    { o: org },
  );
  console.log(JSON.stringify(((posts.data?.posts as { edges?: { node: unknown }[] } | undefined)?.edges ?? []).map((e) => e.node), null, 2));
} else {
  const corps: Lu = await lire(QUERY, { id });
  const p = corps.data?.post as (Record<string, unknown> & { assets?: { __typename: string; mimeType: string; source: string; thumbnail: string }[] }) | undefined;
  if (!p) {
    console.error(`Lecture refusée : ${(corps.errors ?? []).map((e) => e.message).join(" ; ").replaceAll(cle, "****")}`);
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify(
        {
          id: p.id,
          statut: p.status,
          reseau: p.channelService,
          mode: p.shareMode,
          date: p.dueAt,
          envoyeeLe: p.sentAt,
          creeeLe: p.createdAt,
          lien: p.externalLink,
          erreur: (p.error as { message?: string } | null)?.message ? nettoyerDetail((p.error as { message: string }).message, [cle]) : null,
          fichiers: (p.assets ?? []).map((a) => ({ type: a.__typename, mime: a.mimeType, hoteSource: hote(a.source), hoteVignette: hote(a.thumbnail), recopieeParBuffer: !/r2\.cloudflarestorage\.com$/.test(hote(a.source)) })),
        },
        null,
        2,
      ),
    );
  }
}
