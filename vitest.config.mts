import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Les services importent « server-only » : neutralisé dans les tests.
      "server-only": fileURLToPath(new URL("./tests/vide.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // studio-rendu en MODE ESSAI explicite pendant les tests (relecture sécurité R45) : adresses de ce poste
    // (127.0.0.1) et fichiers locaux permis. Jamais en production (`modeEssai` l'ignore si NODE_ENV=production) ;
    // les tests des gardes le retirent eux-mêmes. Hôtes fictifs des anciens tests du contrat (« r2 », « r2.exemple ») :
    // permis comme le serait le point d'accès R2 du compte.
    env: { STUDIO_RENDU_ESSAI: "1", STUDIO_RENDU_HOTES: "r2,r2.exemple" },
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
