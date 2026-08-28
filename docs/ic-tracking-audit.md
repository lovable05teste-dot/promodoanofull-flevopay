# Auditoria do InitiateCheckout (IC)

## Escopo encontrado

- Página principal (`/`): produto principal montado manualmente a partir de `clone-site.html`.
- Template dinâmico (`/produto/$id`): usado por todos os produtos ativos do catálogo.
- Checkout interno: `/endereco` → `/entrega` → `/pagamento` → `/revisao` → `/pix`.
- Carrinho persistente: `/carrinho`, com produtos, variações e quantidades salvos no `localStorage`.
- Catálogo: 28 produtos ativos, todos com ID, nome e preço válidos.
- Pixel: um único carregador oficial da UTMify. Não existe implementação própria de Meta Conversions API neste repositório.

## Falhas encontradas

1. O link interno usado para sinalizar o IC à UTMify só era acionado depois que `fbq` confirmava o envio. Se o Meta demorasse para carregar, nem o Meta nem a UTMify recebiam o sinal.
2. Produto, carrinho e página principal tinham implementações separadas. O template dinâmico repetia o clique e segurava a navegação por 8 segundos, criando risco de duplicidade e comportamento diferente entre páginas.
3. Os links ocultos existiam em `/endereco` e `/pix`, mas dependiam do sucesso do evento anterior; portanto não funcionavam como fallback real.
4. A página de revisão seguia para o PIX sem tentar o IC. A única proteção restante ficava na página do PIX.
5. O carregador oficial da UTMify também era inserido pela página principal, além do root. Havia uma trava, mas eram dois pontos de bootstrap sujeitos a divergência.

## Correção aplicada

O disparo explícito agora usa:

```js
fbq("track", "InitiateCheckout", {
  content_ids: [productId],
  content_type: "product",
  content_name: productName,
  value: numericValue,
  currency: "BRL",
  num_items: 1
}, {
  eventID: eventId
});
```

- O preço brasileiro é convertido para número (`61,93` → `61.93`).
- Cada tentativa recebe um `eventID` único.
- `eventID` e horário ficam no `checkout_product` para impedir outro IC durante 30 minutos nas etapas seguintes.
- Cliques repetidos reutilizam a mesma promessa/evento enquanto o rastreamento está em andamento.
- `/endereco`, `/revisao` e `/pix` têm fallback. O fallback de `/pix` roda antes da chamada da FlevoPay e da geração do QR Code.
- Os botões finais são protegidos do detector automático para não criarem outro IC.
- O sinal da UTMify passou a ser gerado dentro do rastreador compartilhado. Se a UTMify chamar `fbq`, o interceptor completa os parâmetros e mantém o `eventID`; caso não chame, o rastreador envia o Meta IC explicitamente após 180 ms.
- O replay de clique e a espera fixa de 8 segundos foram removidos. A navegação só aguarda a tentativa real de rastreamento.
- O carregador oficial da UTMify existe em um único ponto, no root da aplicação.
- No carrinho, o IC usa todos os IDs únicos, o valor total e a soma das quantidades. O produto permanece salvo ao trocar de página ou fechar e reabrir o navegador, até ser removido pela lixeira.

## Conversions API

Não foi encontrada chamada à Graph API da Meta, token da Meta, Pixel ID da Meta para CAPI ou endpoint server-side de `InitiateCheckout`. A integração server-side existente é somente a API de pagamento FlevoPay. Por isso:

- não há hoje um segundo evento CAPI para deduplicar;
- não há envio server-side de email, telefone, IP ou user agent à Meta;
- a regra de SHA-256 não se aplica ao código atual.

Se CAPI for adicionada depois, o backend deve receber o `icEventId` salvo e usá-lo como `event_id`, normalizando e aplicando SHA-256 a email/telefone antes do envio. Token da Meta deve permanecer somente no servidor.

## Produtos fora do catálogo ativo

Os IDs abaixo estão desativados porque chegaram sem imagens válidas. Os dados de rastreamento existem no JSON, mas eles não têm página ativa até as imagens serem corrigidas:

- `1497000015`
- `5521000018`
- `8834000019`
- `2278000022`

Nenhum ajuste manual de IC é necessário ao reativá-los: eles usarão o mesmo template dinâmico.

## Checklist no navegador

Antes do teste manual, rode a auditoria automática:

```bash
npm run test:ic
```

Ela valida IDs/preços dos 28 produtos ativos, os seis parâmetros obrigatórios, o carregador único, os pontos de fallback e a ausência de replay/proxy duplicado.

1. Abra uma janela anônima e instale/ative o Meta Pixel Helper.
2. Abra o site com UTMs de teste.
3. Teste pelo menos estes produtos:
   - página principal: ID `6549324`;
   - Eletrônicos: JBL, ID `9909000023`;
   - Eletrodomésticos: Cafeteira, ID `3345000017`;
   - Ciclismo: Bicicleta, ID `9218300153`;
   - Ferramentas: Esmerilhadeira, ID `8501150023`.
4. Em cada teste, clique uma vez em “Comprar agora”.
5. No Pixel Helper, confirme exatamente um `InitiateCheckout` e confira os seis parâmetros comerciais.
6. Dê clique duplo e avance até PIX: não deve aparecer um segundo IC.
7. Adicione dois produtos diferentes ao carrinho, atualize a página e confirme que eles continuam lá. Clique em “Continuar a compra” e confira um único IC com os dois `content_ids`, o total do carrinho e `num_items` correto.
8. Antes de gerar um novo teste, execute no Console:

```js
localStorage.removeItem("checkout_product");
sessionStorage.removeItem("tracking_ic_debug");
```

9. Após chegar ao checkout, veja o diagnóstico persistido:

```js
JSON.parse(sessionStorage.getItem("tracking_ic_debug") || "[]")
```

Deve existir apenas uma entrada com `status: "sent"` por tentativa. Entradas posteriores com `status: "deduplicated"` confirmam que o fallback foi bloqueado corretamente.

10. No Events Manager da Meta, abra “Testar eventos”, repita o fluxo e confira o IC com o mesmo ID, nome e valor mostrados no produto.
