/** Types d'entité sous lesquels un rendu est rangé (3e segment de la clé `studio/{env}/{type}/{entiteId}/…`). */
export const TYPE_ENTITE_VISUEL = "visuel" as const;
export type TypeEntiteMedia = typeof TYPE_ENTITE_VISUEL;

/** Segment réel des clés écrites par le rendu : `studio/{env}/visuels/{empreinte sur 32 caractères}/…`. */
export const SEGMENT_CLE_VISUELS = "visuels" as const;
