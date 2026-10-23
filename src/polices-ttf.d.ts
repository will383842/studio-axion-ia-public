/** Les compositions Remotion (`studio-rendu/`) importent leurs polices `.ttf` comme des URL ; le typage racine les voit via les tests. */
declare module "*.ttf" {
  const url: string;
  export default url;
}
