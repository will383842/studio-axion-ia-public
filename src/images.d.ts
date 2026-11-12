// Images importées en statique (ex. logo de la page publique). Next les déclare dans next-env.d.ts, généré au build seulement :
// cette déclaration permet au tsc différentiel de la CI (sans build) de les connaître.
declare module "*.png" {
  const image: import("next/image").StaticImageData;
  export default image;
}
