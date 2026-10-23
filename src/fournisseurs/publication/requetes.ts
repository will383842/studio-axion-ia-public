/**
 * REQUÊTES GRAPHQL DE BUFFER (lot R1), recalées sur le schéma relevé par introspection le 03/10/2026
 * (`docs/buffer/schema-2026-10.json`, `outils/buffer/introspection.mts`). Le test `r1-buffer-schema` vérifie chaque
 * champ, argument et type de variable contre ce relevé : un champ renommé chez Buffer rougit AVANT la production.
 *
 * Une SEULE mutation existe ici : `MUTATION_CREER_POST` (createPost). Aucune suppression, aucune modification :
 * rien n'est jamais effacé chez Buffer (règle 3 du plan).
 */

/** Compte et organisations (le canal appartient à une organisation). */
export const REQUETE_COMPTE = `query Compte {
  account {
    id
    timezone
    organizations { id name channelCount }
  }
}`;

/** Canaux (comptes de réseaux reliés dans Buffer) d'une organisation. */
export const REQUETE_CANAUX = `query Canaux($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) {
    id
    name
    displayName
    service
    type
    avatar
    isDisconnected
    isLocked
    isQueuePaused
    timezone
  }
}`;

/** État d'UNE publication (brouillon, programmée, envoyée, échec) et son lien sur le réseau. */
export const REQUETE_ETAT_POST = `query EtatPublication($id: PostId!) {
  post(input: { id: $id }) {
    id
    channelId
    status
    dueAt
    sentAt
    externalLink
    error { message supportUrl }
  }
}`;

/**
 * Publications récentes de canaux donnés (réconciliation après une coupure : on RELIT avant de renvoyer quoi que ce
 * soit). Tri par création décroissante, à partir d'un instant.
 */
export const REQUETE_POSTS_CANAL = `query PublicationsRecentes($organizationId: OrganizationId!, $channelIds: [ChannelId!], $depuis: DateTime, $nombre: Int) {
  posts(first: $nombre, input: { organizationId: $organizationId, filter: { channelIds: $channelIds, createdAt: { start: $depuis } }, sort: [{ field: createdAt, direction: desc }] }) {
    edges {
      node {
        id
        channelId
        status
        dueAt
        sentAt
        createdAt
        text
        externalLink
      }
    }
  }
}`;

/**
 * Création d'une publication (brouillon `saveToDraft: true` par défaut). La réponse est une UNION : succès
 * (`PostActionSuccess`) ou erreur typée (toutes implémentent `MutationError`).
 */
export const MUTATION_CREER_POST = `mutation CreerPublication($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess {
      post { id channelId status dueAt externalLink }
    }
    ... on MutationError { message }
  }
}`;
