/**
 * IMP-1 — REQUÊTES GRAPHQL DE LECTURE SEULE (aucune `mutation`). Champs vérifiés contre `docs/buffer/schema-2026-10.json`.
 * Le compte et les canaux réutilisent les requêtes du fournisseur Buffer du dépôt.
 */
export { REQUETE_CANAUX, REQUETE_COMPTE } from "../../fournisseurs/publication/requetes";

/** Champs lus d'un post (partagés avec la lecture des posts publiés, lire-publies.ts). Lecture seule. */
export const FRAGMENT_POST = `
        id
        channelId
        status
        dueAt
        sentAt
        createdAt
        text
        assets {
          __typename
          id
          type
          mimeType
          source
          ... on ImageAsset { image { altText } }
          ... on VideoAsset { video { fileSize title } }
          ... on DocumentAsset { document { filesize title } }
        }
        metadata {
          __typename
          ... on InstagramPostMetadata { firstComment }
          ... on FacebookPostMetadata { firstComment title linkAttachment { url title } }
          ... on LinkedInPostMetadata { firstComment linkAttachment { url title } }
          ... on TwitterPostMetadata { type }
          ... on YoutubePostMetadata { title }
        }`;

/** Posts non envoyés dont la date prévue est à partir de `$depuis` (brouillons, programmés, à valider, en erreur). */
export const REQUETE_POSTS_A_VENIR = `query PostsAVenir($organizationId: OrganizationId!, $depuis: DateTime, $apres: String, $nombre: Int) {
  posts(first: $nombre, after: $apres, input: { organizationId: $organizationId, filter: { status: [draft, scheduled, needs_approval, error], dueAt: { start: $depuis } }, sort: [{ field: dueAt, direction: asc }] }) {
    edges {
      node {${FRAGMENT_POST}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/** Posts envoyés avec leurs statistiques (export des statistiques passées). */
export const REQUETE_POSTS_ENVOYES_STATS = `query PostsEnvoyesStatistiques($organizationId: OrganizationId!, $apres: String, $nombre: Int) {
  posts(first: $nombre, after: $apres, input: { organizationId: $organizationId, filter: { status: [sent] }, sort: [{ field: dueAt, direction: desc }] }) {
    edges {
      node {
        id
        channelId
        sentAt
        metricsUpdatedAt
        metrics { type name value }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;
