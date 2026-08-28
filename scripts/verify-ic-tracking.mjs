import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const disabledIds = new Set(["1497000015", "5521000018", "8834000019", "2278000022"]);
const products = JSON.parse(read("src/lib/products-data.json"));
const activeProducts = [
  {
    id: "6549324",
    title: "Jogo De Panelas Indução Antiaderente Cerâmica 10 Peças PPG PFOA Free Baunilha",
    newPrice: "61,93",
  },
  ...products.filter((product) => !disabledIds.has(String(product.id))),
];

for (const product of activeProducts) {
  const value = Number(String(product.newPrice).replace(/\./g, "").replace(",", "."));
  check(Boolean(String(product.id || "").trim()), "Produto ativo sem ID/SKU");
  check(Boolean(String(product.title || "").trim()), `Produto ${product.id || "?"} sem nome`);
  check(
    Number.isFinite(value) && value > 0,
    `Produto ${product.id || "?"} sem preço numérico válido`,
  );
}

const tracking = read("src/lib/tracking.ts");
for (const field of [
  "content_ids",
  "content_type",
  "content_name",
  "value",
  "currency",
  "num_items",
]) {
  check(tracking.includes(field), `Parâmetro obrigatório ausente no rastreador: ${field}`);
}
check(
  tracking.includes("signalUtmifyInitiateCheckout"),
  "Sinal de IC da UTMify não está centralizado",
);
check(tracking.includes("eventID: eventId"), "eventID Meta não está sendo enviado");
check(tracking.includes("icTrackedAt"), "Deduplicação persistente do IC não encontrada");

const routes = {
  product: read("src/routes/produto.$id.tsx"),
  cart: read("src/routes/carrinho.tsx"),
  address: read("src/routes/endereco.tsx"),
  review: read("src/routes/revisao.tsx"),
  pix: read("src/routes/pix.tsx"),
  home: read("src/routes/index.tsx"),
  root: read("src/routes/__root.tsx"),
};

check(routes.product.includes("trackInitiateCheckout"), "Template dinâmico sem IC");
check(routes.cart.includes("trackInitiateCheckout"), "Carrinho sem IC");
check(routes.address.includes("trackStoredInitiateCheckout"), "Endereço sem fallback de IC");
check(routes.review.includes("trackStoredInitiateCheckout"), "Revisão sem fallback de IC");
check(
  routes.pix.includes("await trackStoredInitiateCheckout"),
  "PIX não aguarda IC antes da cobrança",
);
check(
  routes.home.includes('content_type:"product"'),
  "Página principal sem payload completo de IC",
);

const routeSources = Object.values(routes).join("\n");
check(!routeSources.includes("icReplay"), "Replay de clique ainda pode duplicar IC");
check(!routeSources.includes("icProxyRef"), "Há proxy de UTMify duplicado em uma página");
check(
  (routeSources.match(/UTMIFY_PIXEL_LOADER/g) || []).length === 2,
  "O carregador UTMify não está restrito ao root (import + uso)",
);

if (failures.length) {
  console.error(`Falha na auditoria IC (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`IC validado em ${activeProducts.length} produtos ativos.`);
console.log("Payload completo, um carregador UTMify, deduplicação e fallback antes do PIX: OK.");
console.log(
  "Conversions API da Meta: não implementada neste repositório (somente Pixel client-side). ",
);
