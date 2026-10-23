/**
 * VERSION DU CODE EN LIGNE : le commit posé à la construction de l'image (`STUDIO_COMMIT`, passé par
 * `deploiement/mettre-a-jour.sh`), ou une variable équivalente d'un autre hébergeur. Lue par la traçabilité du tableau
 * animé et par la sonde `/api/sante`. PUR.
 */

/** Version du code lue d'une variable de construction (la première trouvée), sinon « inconnu ». */
export function versionDuCode(env: Record<string, string | undefined>): string {
  for (const nom of ["STUDIO_COMMIT", "GIT_COMMIT", "SOURCE_COMMIT", "COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"]) {
    const v = env[nom]?.trim();
    if (v) return v;
  }
  return "inconnu";
}
