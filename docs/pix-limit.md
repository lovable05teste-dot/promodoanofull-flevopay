# Limite de geração de Pix

Checkout e complementos usam a mesma quota: no máximo três cobranças pendentes por qualquer um dos sinais IP, documento, e-mail, telefone ou cookie assinado. A troca de sessionStorage não reinicia o limite. O bloqueio impede novas cobranças e permite continuar acessando/pagando os Pix existentes.

O servidor normaliza os dados e usa HMAC para as chaves. IPv6 é agrupado em /64. Na Vercel o IP vem do cabeçalho sobrescrito pela plataforma, nunca do JSON. Fora da Vercel, somente desenvolvimento em localhost é aceito; outra hospedagem precisa de um adaptador de proxy confiável.

Cada identidade tem um ledger privado com até três entradas. Leituras usam `useCache: false`. A criação usa `allowOverwrite: false`; atualizações usam `ifMatch` com o ETag lido. Conflitos são relidos, nunca sobrescritos incondicionalmente. Todas as reservas são gravadas antes da chamada à FortPay, inclusive em instâncias distintas. Não há contador apenas em memória nem listagem truncada de cobranças.

Pedidos iguais reutilizam o resultado persistido. Uma reserva em processamento impede outro POST igual. A identidade do pedido não inclui sessão/UTM/cookie/IP, mas inclui cliente, itens, valor e, para complementos, a transação principal. Notificações de checkout não são reenviadas no reuso.

Só os estados finais da transação consultada na FortPay liberam entradas conhecidas. Resposta desconhecida, erro ou falha de rede mantêm a vaga. Um prazo estimado pelo navegador não libera cobrança ainda pendente na FortPay. Se o POST externo falhar ou perder sua resposta, a reserva sem ID permanece por 24 horas e cinco minutos (a FortPay recebe `expire_in_days: 1`); não há retry automático do POST. Isso prioriza impedir duplicações, podendo exigir espera do cliente após uma falha. Falhas de persistência final também mantêm as reservas anteriores.

Complementos exigem token HMAC válido, oferta pertencente ao produto e compra principal aprovada. Tokens antigos que continham apenas um ID de transação não são aceitos. Respostas da FortPay leem ID/status do objeto da transação, sem procurar ID/status dentro de cliente ou item.

## Configuração e ativação

- Vercel com entrada de tráfego direta, sem proxy externo não configurado.
- Blob **privado**, com `BLOB_READ_WRITE_TOKEN`, ou `BLOB_STORE_ID` e credenciais OIDC da Vercel. O SDK faz as leituras e escritas condicionais. Sem acesso ao armazenamento, a geração falha fechada.
- `FORTPAY_API_TOKEN`, usado para criar e consultar cobranças.
- Recomendado: `PIX_LIMIT_SECRET` aleatório e estável no servidor. Na ausência dele, usa o token FortPay; trocar o segredo reinicia as chaves do limite e invalida cookies. Nunca usar variável `VITE_*` para segredos.
- Produção e preview devem usar stores separados, ou previews não devem gerar cobranças reais.

Os registros antigos `pix-pending/<session>/` não possuem IP/documento e não podem ser atribuídos retroativamente com segurança. O ledger v2 começa vazio. Pix já gerados continuam pagáveis, mas não entram automaticamente na nova quota. Considerar essa janela de transição (24 horas) antes de ativar. Checkout armazenado no navegador antes da mudança também contém token antigo de complemento; não habilitar esses tokens sem autorização verificável.

Antes de promover, verificar acesso ao Blob privado, gravação inicial sem overwrite, disputa por ETag, IP recebido da Vercel e confirmação/expiração com a integração FortPay. Os testes locais usam gateway e store simulados, sem cobrança real. Acesso à Vercel bloqueado impede afirmar que esses requisitos estão ativos em produção.

## Verificação

Node 24 ou superior para os scripts TypeScript sem transpiler:

As versões de React Start/Router/plugin/core estão fixadas em um conjunto compatível com Vite 7. A instalação anterior com intervalos `^` podia instalar React Start que exige Vite 8, ou misturar exports de versões diferentes durante o build Nitro. Dois ajustes de tipos (componente de erro e bytes do QR) e a árvore de rotas regenerada permitem a verificação TypeScript completa.

```sh
npm run test:pix-limit
node scripts/verify-fortpay-responses.mjs
node scripts/verify-upsells.mjs
npm run test:purchase
npm run test:ic
npx tsc --noEmit
npm run build
```

IPs compartilhados também compartilham quota, conforme a regra pedida. VPN com novos dados e cookie novo pode representar outra identidade; isto não identifica uma pessoa de forma infalível. CAPTCHA, WAF, conta verificada e limites de taxa podem complementar a proteção. O status público não é autorização para criar Pix.

Referências oficiais: [Blob SDK e ETags](https://vercel.com/docs/vercel-blob/using-blob-sdk), [cabeçalhos de requisição](https://vercel.com/docs/headers/request-headers).
