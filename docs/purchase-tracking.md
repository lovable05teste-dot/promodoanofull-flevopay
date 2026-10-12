# Compra confirmada — Meta Pixel

O layout global inicializa o pixel `4686534118338697` nos produtos e no checkout.

Antes, a consulta da FortPay somente mudava a tela para “Pagamento confirmado”; não enviava `Purchase`. Agora `/pix` envia `Purchase` exclusivamente quando `getPixStatus` retorna `COMPLETED` após consultar a FortPay no servidor. A geração da cobrança e o upload de comprovante não confirmam compras.

O valor em BRL, IDs dos produtos, nome e quantidade ficam no snapshot retornado pela criação da cobrança. O evento usa `trackSingle` para o pixel da loja e `eventID: purchase_<transactionId>`. O cache de deduplicação é por pixel e transação, sem impedir outra compra do mesmo produto. O retorno do banco, foco e recarga retomam a consulta do Pix; não geram automaticamente uma nova cobrança dentro do mesmo checkout. O cache dura até 24 horas, compatível com `expire_in_days: 1`. CPF/e-mail não são persistidos nesse cache; somente seu digest é usado para verificar se o checkout é o mesmo.

## Verificação

- `npm run test:purchase`: testa FortPay → status → fila do Meta nos 31 produtos, valores, SKUs, carrinho, deduplicação, storage bloqueado, pixel lento e recuperação do Pix. Usa respostas simuladas, sem cobranças reais.
- `npm run test:ic`: valida o rastreamento de checkout existente.
- `npm run build`: compila cliente e servidor.

Para validação real, uma compra legítima confirmada deve aparecer em “Testar eventos” do pixel, com o valor da cobrança e o ID do produto. “sent” no código significa enfileirado no pixel, não confirmação de recebimento nem de atribuição ao anúncio.

## Limites

A implementação é do pixel no navegador. Uma compra paga com a página fechada e sem retorno não dispara esse evento; bloqueadores também podem impedir a entrega. Este repositório ainda não possui webhook de pagamentos com API de Conversões. Para esse caminho são necessários o contrato/autenticação do webhook da FortPay, armazenamento durável da atribuição e token da API de Conversões, com deduplicação usando o mesmo eventID. Eventos de compra enviados por outra integração devem usar o mesmo eventID para deduplicação entre integrações. Não há envio retroativo das vendas anteriores.
