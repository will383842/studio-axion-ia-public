/** Types d'entité sous lesquels un rendu est rangé (3e segment de la clé `studio/{env}/{type}/{entiteId}/…`). */
export const TYPE_ENTITE_VISUEL = "visuel" as const;
export type TypeEntiteMedia = typeof TYPE_ENTITE_VISUEL;
