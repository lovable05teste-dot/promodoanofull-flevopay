# Complementos após pagamento

A página `/pix` preserva a compra principal e exibe três ofertas em cards verticais somente após a consulta da FortPay retornar `COMPLETED`. Cada complemento é opcional e tem seu próprio Pix; a geração exige uma escolha explícita do comprador.

O servidor assina o contexto da compra principal usando a chave FortPay existente, confere novamente o pagamento antes de emitir cada Pix e obtém o preço e os itens do catálogo. Nenhuma nova variável de ambiente é necessária.

Os eventos `InitiateCheckout` e `Purchase` usam o pixel global da loja com IDs distintos de complemento. `Purchase` somente é enviado quando a cobrança específica do complemento é aprovada. O Pix de cada complemento é preservado na sessão para a volta do banco.

## Preços de venda configurados

São preços escolhidos para esta loja, não alegações de preços atuais dos fornecedores. Os acessórios custam até R$69,90; os controles DualSense e Xbox Series custam R$249,90, dentro do teto de R$250 para a faixa superior informada pelo usuário. Não são exibidos descontos ou preços anteriores não verificados.

## Mapeamento

| Produto principal | Três complementos |
|---|---|
| Jogo de panelas antiaderente 10 peças | Kit de utensílios de silicone — R$49,90; Descanso de panela em silicone — R$19,90; Par de luvas térmicas de cozinha — R$29,90 |
| Forno Elétrico Philco 65L Dupla Resistência PFE65 | Assadeira para forno — R$49,90; Par de luvas térmicas de cozinha — R$29,90; Timer digital de cozinha — R$29,90 |
| Smartphone Xiaomi Redmi 15C 4G BR 4+4GB RAM Virtual + 256GB | Capa para Redmi 15C — R$19,90; Película para Redmi 15C — R$19,90; Cabo USB-C — R$29,90 |
| Robô Aspirador de Pó Velds 3 em 1 – Varre Aspira e Passa Pano com Mapeamento via App e Sensor Antiqueda, Preto | Kit de panos de microfibra — R$19,90; Borrifador de limpeza — R$14,90; Kit de panos para piso — R$19,90 |
| Purificador de Água Gelada, Fria e Natural Eletrônico Compacto Electrolux | Garrafa para água 500 ml — R$29,90; Escova para garrafas — R$19,90; Kit de panos de microfibra — R$19,90 |
| Sony PlayStation 4 PS4 Slim 500GB + 2 Controles + Jogo | Controle sem fio compatível com PS4 — R$69,90; Headset gamer com conexão 3,5 mm — R$69,90; Kit de capas para analógicos — R$19,90 |
| Freezer Horizontal 418L Inverter Bivolt Branco Midea | Kit de potes para alimentos — R$49,90; Termômetro para geladeira e freezer — R$29,90; Kit de formas de gelo — R$19,90 |
| Lavadora Lava Jato Portátil Pressão 2 Baterias + Maleta | Shampoo automotivo — R$29,90; Escova manual de lavagem — R$29,90; Kit de panos de microfibra — R$19,90 |
| Console Xbox Series X 1 TB Branco com Controle | Controle sem fio Xbox Series — R$249,90; Headset gamer com conexão 3,5 mm — R$69,90; Kit de capas para analógicos — R$19,90 |
| Chave De Impacto Parafusadeira Furadeira Several Importados Verde | Kit de brocas — R$39,90; Jogo de bits com suporte magnético — R$29,90; Par de luvas de trabalho — R$24,90 |
| Capacete Para Moto Integral Helt Street Polar | Balaclava para motociclista — R$19,90; Par de luvas para motociclista — R$39,90; Kit de limpeza para viseira — R$29,90 |
| Andador Infantil Bebê Antiqueda Torino Galzerano | Chocalho para bebê — R$29,90; Babador de silicone — R$19,90; Copo infantil com alças — R$29,90 |
| PlayStation 5 Slim Disk com Astro Bot e Gran Turismo 7 | Controle DualSense para PS5 — R$249,90; Headset gamer com conexão 3,5 mm — R$69,90; Kit de capas para analógicos — R$19,90 |
| Cafeteira Três Corações Espresso LOV Automática para Cápsulas Monodose | Caixa com 10 cápsulas Três Corações — R$29,90; Par de xícaras de café — R$39,90; Organizador de cápsulas de café — R$39,90 |
| Roçadeira Knakasaki 75cc 3,5hp Gasolina 2 Tempos Profissional Multifuncional | Protetor facial — R$39,90; Abafador de ruído — R$39,90; Cinto de sustentação para roçadeira — R$49,90 |
| Motosserra Sabre Tekna 18 Sn E Corrente Oregon 54,5cc | Protetor facial — R$39,90; Abafador de ruído — R$39,90; Par de luvas de trabalho — R$24,90 |
| Churrasqueira Califórnia Bacia Esmaltada | Pegador para churrasco — R$29,90; Pincel culinário de silicone — R$19,90; Par de luvas térmicas de cozinha — R$29,90 |
| Cadeira De Praia Aço MOR - Super Resistente Portátil Camping Piscina Jardim - CORES VARIADAS | Bolsa térmica portátil — R$49,90; Guarda-sol de praia — R$69,90; Bolsa estanque para celular — R$19,90 |
| Escada De Alumínio Dobrável Compacta com 3 Degraus - Botafogo - Leve e Resistente | Óculos de proteção — R$19,90; Par de luvas de trabalho — R$24,90; Cinto porta-ferramentas — R$39,90 |
| Fritadeira Elétrica AFON-12L-BG Forno Oven 12 Litros Preto Mondial | Forma de silicone para air fryer — R$29,90; Pegador para churrasco — R$29,90; Par de luvas térmicas de cozinha — R$29,90 |
| Geladeira Consul Frost Free 297 Litros Branca - CRB36MB | Kit de potes para alimentos — R$49,90; Termômetro para geladeira e freezer — R$29,90; Kit de formas de gelo — R$19,90 |
| Fogão Brastemp 4 Bocas Inox BFO4NBR - Bivolt | Assadeira para forno — R$49,90; Par de luvas térmicas de cozinha — R$29,90; Timer digital de cozinha — R$29,90 |
| Bateria Moura 60Ah M60GD Automotiva 12V Original | Multímetro digital — R$49,90; Escova para terminais de bateria — R$19,90; Protetores para terminais de bateria — R$19,90 |
| JBL Boombox 4 Caixa de Som Bluetooth IP68 34h Playtime | Bolsa de transporte para Boombox 4 — R$69,90; Fone de ouvido Bluetooth — R$69,90; Kit de panos de microfibra — R$19,90 |
| Bicicleta Alumínio Aro 29 Ksw 24v Freio Disco Xlt | Kit de luzes para bicicleta — R$39,90; Bomba portátil de bicicleta — R$39,90; Cadeado para bicicleta — R$29,90 |
| Esmerilhadeira Angular Bosch GWS 850 850W Disco 115mm | Kit de discos de corte 115 mm — R$29,90; Óculos de proteção — R$19,90; Par de luvas de trabalho — R$24,90 |
| Cômoda 8 Gavetas 2 Portas Albatroz Verona Com Cabideiro | Kit de divisórias para gaveta — R$29,90; Caixas organizadoras de tecido — R$39,90; Kit de feltros para móveis — R$19,90 |
| Pneu Direction 2 Touring Aro 13 175/70R13 82T Goodyear | Medidor de pressão dos pneus — R$29,90; Kit de tampas de válvula — R$9,90; Compressor portátil 12 V — R$69,90 |
| Lavadora De Alta Pressão 1700W 2000 PSI Bosch GHP 200 | Shampoo automotivo — R$29,90; Escova manual de lavagem — R$29,90; Kit de panos de microfibra — R$19,90 |
| Climatizador de Ambientes Industrial e Residencial CLI70 SJ Ventisol | Escova de limpeza — R$19,90; Kit de panos de microfibra — R$19,90; Borrifador de limpeza — R$14,90 |
| Smart TV AOC 50U6125 50 Polegadas 4K LED | Cabo HDMI — R$29,90; Suporte para TV de 50 polegadas — R$69,90; Kit de limpeza para telas — R$29,90 |

## Referências de pesquisa

As imagens foram localizadas na internet e salvas localmente para evitar dependência de links externos. A imagem de cada oferta corresponde ao complemento descrito. Não são usadas notas ou avaliações inventadas.

| Complemento | Referência |
|---|---|
| Kit de utensílios de silicone | [Jogo Kit Com 12 Peças Utensílios De Cozinha Colheres Espatulas Pegador Silicone Copo Suporte - Prime - Conjunto de Utensílios - Magazine Luiza](https://www.magazineluiza.com.br/jogo-kit-com-12-pecas-utensilios-de-cozinha-colheres-espatulas-pegador-silicone-copo-suporte-prime/p/gbjc7jk699/ud/cjtu/?seller_id=woofdistribuidora) |
| Descanso de panela em silicone | [Apoio Descanso para Panela 16,5 Cm Quadrado em Silicone 	008534 Mor - TudodeFerramentas - Levando Praticidade ao seu Dia a Dia](https://www.tudodeferramentas.com.br/produto/apoio-descanso-para-panela-165-cm-quadrado-em-silicone-008534-mor.html) |
| Par de luvas térmicas de cozinha | [Manoplas de silicona para horno, resistentes al calor, antideslizantes, aptas para asar y cocinar, de color negro - Leroy Merlin](https://www.leroymerlin.es/productos/manoplas-de-silicona-para-horno-resistentes-al-calor-antideslizantes-aptas-para-asar-y-cocinar-de-color-negro-98937448.html) |
| Pegador para churrasco | [Pinça de Churrasco Longa em Aço Inoxidável, Cabo Antideslizante e Ideal para Alimentos Quentes - Haustter](https://haustter.com/products/pinca-churrasco-aco-inox-cabo-antideslizante-haustter) |
| Pincel culinário de silicone | [Pincel Culinário de Silicone Cozinha e Churrasqueira Untar:vermelho - MadeiraMadeira](https://www.madeiramadeira.com.br/pincel-culinario-de-silicone-cozinha-e-churrasqueira-untar-vermelho-409887946.html) |
| Bolsa térmica portátil | [Borsa frigo Hi-Tec Termina 10 - Decathlon](https://www.decathlon.it/p/mp/borsa-frigo-hi-tec-termina-10/ebf3309c-8167-4918-b049-2e2287224d03/c8) |
| Guarda-sol de praia | [Sombrilla de Playa, Sombrilla Playa Grande Inclinable 30°, Sombrilla Terraza Exterior Protección UV, con Tejido Oxford engrosado, Tacos en - Leroy Merlin](https://www.leroymerlin.es/productos/sombrilla-de-playa-sombrilla-playa-grande-inclinable-30-sombrilla-terraza-exterior-proteccion-uv-con-tejido-oxford-engrosado-tacos-en-87746169.html) |
| Bolsa estanque para celular | [Waterproof Phone Pouch with Adjustable Lanyard, Universal Fit Dry Bag Case for Smartphones up to 6.9", Clear Touch Screen, IPX8 Waterproof for Beach, Swimming, Travel & Outdoor ,Black - Walmart.com](https://www.walmart.com/ip/20061369477) |
| Óculos de proteção | [Óculos De Proteção Transparente Epi Para Segurança Trabalho Vonder - Óculos de Proteção - Magazine Luiza](https://www.magazineluiza.com.br/oculos-de-protecao-transparente-epi-para-seguranca-trabalho-vonder/p/ac79cga92a/pi/ocpr/) |
| Par de luvas de trabalho | [Luva de Nylon com Banho Nitrílico Preto Total Nitril Full Volk CA 25280, resistente e flexível para proteção industrial](https://www.fastepis.com.br/luvas/nitrilicas/luva-de-nylon-com-banho-nitrilico-preto-total-nitril-full-volk) |
| Cinto porta-ferramentas | [KOYYTO 19 Pocket Tool Belts with Quick Release Buckle- Heavy Duty Detachable & Adjustable Utility Belt,Work Apron for Men and Women,for Electrician,Carpenter,Construction Tool Belt Pouches,Khaki Tool Pouch2 - AusPower Australia](https://auspowers.com/products/koyyto-19-pocket-tool-belts-with-quick-release-buckle-heavy-duty-detachable-adjustable-utility-belt-work-apron-for-men-and-women-for-electrician-carpenter-construction-tool-belt-pouches-khaki-tool-pouch2) |
| Kit de panos de microfibra | [3 Panos Super Absorvente Microfibra Multiuso 29x29cm Não Solta Fiapos Casa Carro Escritório - ALKLIN - Pano - Magazine Luiza](https://www.magazineluiza.com.br/3-panos-super-absorvente-microfibra-multiuso-29x29cm-nao-solta-fiapos-casa-carro-escritorio-alklin/p/gc4h3ddb3d/me/pano/) |
| Borrifador de limpeza | [Pulverizador Borrifador 500ml – Prático, Resistente e Multifuncional - SindicoShop - Produtos para Condomínios e Empresas](https://www.sindicoshop.com.br/produto/pulverizador-borrifador-transparente-500ml.html) |
| Kit de panos para piso | [3 Pano de Chão Microfibra Ecomais 40cm x 60cm Azul Toalha de Limpeza Residencial Automotivo Macio - Akora - Limpeza Automotiva - Magazine Luiza](https://www.magazineluiza.com.br/3-pano-de-chao-microfibra-ecomais-40cm-x-60cm-azul-toalha-de-limpeza-residencial-automotivo-macio-akora/p/bjg8k63g1d/au/plau/) |
| Forma de silicone para air fryer | [Molde de Silicona para Freidora de Aire Redondo](https://www.fravega.com/p/molde-de-silicona-para-freidora-de-aire-redondo-22470720/) |
| Kit de potes para alimentos | [Magazine Luiza - Pra você é Magalu!](https://www.magazineluiza.com.br/kit-10-potes-de-plastico-hermeticos-transparente-c-tampa-electrolux/p/gdk6e6j7e1/ud/poud/?seller_id=maxxmercadinho) |
| Termômetro para geladeira e freezer | [Taylor Digital Refrigerator / Freezer Thermometer 5262798](https://www.webstaurantstore.com/taylor-digital-refrigerator-freezer-thermometer-5262798/9135262798.html) |
| Kit de formas de gelo | [Kit 2 Formas para Gelo de Silicone Forma Dobrável 18 Cavidades Colorida Retangular Flexível Forminha - Shopee Brasil](https://shopee.com.br/Kit-2-Formas-para-Gelo-de-Silicone-Forma-Dobr%C3%A1vel-18-Cavidades-Colorida-Retangular-Resistente-Flex%C3%ADvel-Forminhas-Fundo-Forminha-i.974787590.22692897369) |
| Caixa com 10 cápsulas Três Corações | [Cápsula Tradicional de Café Filtrado Três Corações - Casa Sertaneja Eletro - Aqui nós não perdemos negócio!](https://www.casasertaneja.com.br/capsula-tradicional-de-cafe-filtrado-tres-coracoes) |
| Par de xícaras de café | [COFFEE BAR - Könitz](https://www.koenitz.com/en/coffee-bar) |
| Organizador de cápsulas de café | [LILIAN GIFT DESIGN - PORTA 16 CAPSULAS COM TAMPA EM ACRILICO TRES CORACOES 25X25X5CM](https://www.liliangift.com.br/cozinha/acessorios-de-cozinha/porta-16-capsulas-com-tampa-em-acrilico-tres-coracoes-25x25x5cm) |
| Assadeira para forno | [Assadeira Retangular ABC em Alumínio 45x30 cm](https://www.multibar.com.br/1201_assadeira_retangular_em_aluminio_45x30_cm_abc/p) |
| Timer digital de cozinha | [TIMER DIGITAL COZINHA - A melhor Misturadora de doces](https://www.brothermix.com.br/timer-digital-cozinha) |
| Multímetro digital | [multímetro digital eda 8pj - tensão, corrente e resistência - MercadoCar](https://mercadocar.com.br/multimetro-digital-para-medicao-de-tensao-continua-e-alternada-9v-preto-eda-8pj) |
| Escova para terminais de bateria | [Battery Terminal Cleaning Tool Cleaning Battery Wire Brush Lightweight Hand Tool Universal Dirty Brushes Battey Brush for Car Marine RV - Walmart.ca](https://www.walmart.ca/en/ip/Battery-Terminal-Cleaning-Tool-Cleaning-Battery-Wire-Brush-Lightweight-Hand-Tool-Universal-Dirty-Brushes-Battey-Brush-for-Car-Marine-RV/5EDT6XYX31F4) |
| Protetores para terminais de bateria | [Battery Terminal Insulating Protector Boat Cars Battery Cable Covers Cap, 2pcs - eBay](https://www.ebay.com/itm/186011271047) |
| Bolsa de transporte para Boombox 4 | [JBL BAG BOOMBOX 4 - Bolsa de transporte para caixa de som JBL Boombox 4](https://www.jbl.com.br/BAG-BOOMBOX-4.html) |
| Capa para Redmi 15C | [Tech-Protect FlexAir Transparent Case for Xiaomi Redmi 15C](https://motivs.eu/en/tech-protect-flexair-case-for-xiaomi-redmi-15c-transparent) |
| Película para Redmi 15C | [Produtos com até 15 OFF no PIX  KaBuM](https://www.kabum.com.br/produto/922882/pelicula-hidrogel-hd-frente-e-verso-para-xiaomi-redmi-15c-5g) |
| Cabo USB-C | [Cable Original Apple Usb C / Usb C 1 Metro - CABLE ORIGINAL APPLE USB C USB C 1MT — Dimm](https://www.dimm.com.uy/catalogo/cable-original-apple-usb-c-usb-c-1-metro-cable-original-apple-usb-c-usb-c-1mt_802234_802234) |
| Garrafa para água 500 ml | [GARRAFA / SQUEEZE DE 500 ML – Grupo M - Produtos e Brindes personalizados](https://mcopos.com/products/squeeze-500ml) |
| Escova para garrafas | [日本製 清潔刷 瓶刷 長柄洗瓶刷 奶瓶刷 特殊材質輕鬆洗淨不費力 - 蝦皮購物](https://shopee.tw/%E6%97%A5%E6%9C%AC%E8%A3%BD-%E6%B8%85%E6%BD%94%E5%88%B7-%E7%93%B6%E5%88%B7-%E9%95%B7%E6%9F%84%E6%B4%97%E7%93%B6%E5%88%B7-%E5%A5%B6%E7%93%B6%E5%88%B7-%E7%89%B9%E6%AE%8A%E6%9D%90%E8%B3%AA%E8%BC%95%E9%AC%86%E6%B4%97%E6%B7%A8%E4%B8%8D%E8%B2%BB%E5%8A%9B-i.11243936.6062167589) |
| Kit de luzes para bicicleta | [LAMPKA ROWEROWA PRZEDNIA I TYLNA LED NA ROWER KIEROWNICĘ ZESTAW USB MOCNA - 5907068864177 - 17367104420 - Allegro](https://allegro.pl/oferta/lampka-rowerowa-przednia-i-tylna-led-na-rower-kierownice-zestaw-usb-mocna-17367104420) |
| Bomba portátil de bicicleta | [Comprar Bomba de bicicleta portátil liga alumínio tubo pneu mini bomba mão alta pressão inflator bomba pneu da bicicleta a partir de 14 - Joom](https://www.joom.com/pt/products/5f02e3da62138a0106328e11) |
| Cadeado para bicicleta | [Cadeado Bicicleta reforçado 12mmx80cm Aço Revestido 2 Chaves - Ideal para Bike, Moto ou Portão - Shopee Brasil](https://shopee.com.br/Cadeado-Bicicleta-refor%C3%A7ado-12mmx80cm-A%C3%A7o-Revestido-2-Chaves-Ideal-para-Bike-Moto-ou-Port%C3%A3o-Seguro-e-Resistente-i.696093200.23893509689) |
| Kit de discos de corte 115 mm | [Kit com 10 Discos de Corte Inox 115mm x 1mm x 22,22mm Cortag - Arcazul Ferramentas: Ferramentas Elétricas Máquinas e Acessórios em Curitiba](https://www.arcazulferramentas.com.br/kit-com-10-discos-de-corte-inox-115mm-x-1mm-x-2222mm-cortag) |
| Kit de divisórias para gaveta | ["Kabuer Adjustable Drawer Dividers, Honeycomb Plastic Organizer, 18 Slots, 14.5""x13.75""x2.6" - Walmart.com](https://www.walmart.com/ip/380468922) |
| Caixas organizadoras de tecido | [Shopee Brasil - Ofertas incríveis. Melhores preços do mercado](https://shopee.com.br/Kit-4-Caixa-De-Armazenamento-De-Roupas-Com-Al%C3%A7as-Cesta-De-Grande-Capacidade-Para-Roupas-Cobertores-Colchas-Brinquedos-i.800287152.22698057035) |
| Kit de feltros para móveis | [Self Adhesive Floor Protectors Felt Pads Chair Legs Table Pad Feet Anti Scratch  - eBay UK](https://www.ebay.co.uk/itm/144361117392) |
| Chocalho para bebê | [Chocalho Infantil Buba Baby Shake](https://www.brascol.com.br/chocalho-infantil-buba-baby-shake-1134179420/p) |
| Babador de silicone | [Babador Pega Migalhas em Silicone Verde - Buba - Baby Buys Brasil](https://www.babybuysbrasil.com.br/babador-pega-migalhas-em-silicone-verde-buba) |
| Copo infantil com alças | [Copo de Treinamento com Alça e Bico Rígido 180ml Buba Gatinho - Droga Raia - Droga Raia](https://www.drogaraia.com.br/copo-de-treinamento-com-alca-e-bico-rigido-180ml-buba-745213.html) |
| Kit de brocas | [Jogo de Brocas Com 16pçs Fertak Para Furar Concreto, Madeira e Metal Kit de Broca Com Estojo Plástico Organizador Broca Para Furadeira. - FERTAK TOOLS - Broca - Magazine Luiza](https://www.magazineluiza.com.br/jogo-de-brocas-com-16pcs-fertak-para-furar-concreto-madeira-e-metal-kit-de-broca-com-estojo-plastico-organizador-broca-para-furadeira-fertak-tools/p/ge062kkh45/fs/fbrc/) |
| Jogo de bits com suporte magnético | [Kit bits/ponteiras 8 peças sextavado 1/4" extensão magnética - Vonder - Fercosa ferramentas](https://www.fercosa.com.br/kit-bitsponteiras-8-pecas-sextavado-14-extensao-magnetica-vonder) |
| Balaclava para motociclista | [Alpinestars Open Face Balaclava - Bayside Performance](https://www.baysideperformance.ca/alpinestars-open-face-balaclava) |
| Par de luvas para motociclista | [Luva X11 Impact 2 Cano Longo Couro Moto Braga](https://motobraga.com.br/produto/3022/luva-x11-impact-2-cano-longo-couro) |
| Kit de limpeza para viseira | [- Muc-Off UK](https://muc-off.com/products/visor-lens-goggle-cleaning-kit) |
| Medidor de pressão dos pneus | [Medidor Calibrador De Pressão Digital Para Pneus Em Geral Vonder - Soluções Em Peças Para Motores](https://www.lojadomotor.com.br/medidor-calibrador-de-pressao-digital-para-pneus-em-geral-vonder) |
| Kit de tampas de válvula | [Affordable Tyre valve caps for your car: order from AUTODOC](https://www.autodoc.parts/car-accessories/tyre-valve-caps) |
| Compressor portátil 12 V | [Compressor de ar automotivo portátil 12V 37L/min com bolsa - 5805555 - Denzel](https://www.dutramaquinas.com.br/p/compressor-de-ar-automotivo-12-volts-5805555-5805555) |
| Shampoo automotivo | [Lava Autos Neutro Concentrado Shampoo Automotivo 500ML Vintex - UP CARSHOP](https://www.upcarshop.com.br/produto/lava-autos-500ml.html) |
| Escova manual de lavagem | [K2 Četka za ručno pranje](https://amalgam.rs/product/k2-cetka-za-rucno-pranje) |
| Controle sem fio compatível com PS4 | [Magazine Luiza - Pra você é Magalu!](https://www.magazineluiza.com.br/controle-wireless-touchpad-double-shock-4-para-ps-4-ponto-do-nerd/p/cf2619487e/ga/otga/) |
| Controle DualSense para PS5 | [Controle sem fio DualSense Sony - PS5 - Mundo Joy Games - Venda, Compra e Assistência em Games e Informática](https://www.mundojoygames.com.br/playstation/playstation-5/acessorios/controle-sem-fio-dualsense-sony-ps5) |
| Controle sem fio Xbox Series | [Controle Sem fio Xbox One Series x/s com Bluetooth Carbon Black - Original - Microsoft - 1914 em Promoção - Ofertas na Americanas](https://www.americanas.com.br/controle-sem-fio-xbox-one-series-x-s-com-bluetooth-carbon-black-original-microsoft-1914-2784415019/p) |
| Headset gamer com conexão 3,5 mm | [Headset Gamer P3 PS4 / XBOX / SWITCH 2m Hoopson F-103-AZ. MERCORIENTAL M-2513 - MadeiraMadeira](https://www.madeiramadeira.com.br/headset-gamer-p3-ps4-xbox-switch-2m-hoopson-f-103-az-mercoriental-m-2513-608122070.html) |
| Kit de capas para analógicos | [4x Controller Grips Thumb Stick Cap Cover for PS5 PlayStation 5 & Xbox Series✔ - eBay](https://www.ebay.com/itm/314931939845) |
| Escova de limpeza | [Escova Para Limpeza Com Cerdas Macias Vonixx - Mendes Auto - Produtos e Equipamentos para Estética Automotiva](https://www.mendesauto.com.br/produtos-para-estetica-automotiva/escova-para-limpeza-com-cerdas-macias-vonixx) |
| Cabo HDMI | [Cabo HDMI Macho x Macho Versão 2.0 4K  2,0m PluscableRecycle Informática - Cartuchos de Tinta, Toner e Acessórios para Informática](https://www.recycleinformatica.com.br/cabos/cabo-de-video/cabo-hdmi-macho-x-macho-versao-2-0-4k-2-0m-pluscable) |
| Suporte para TV de 50 polegadas | [Magazine Luiza - Pra você é Magalu!](https://www.magazineluiza.com.br/suporte-fixo-de-parede-para-tv-de-23-a-63-suporta-ate-50kg-kit-parafuso-yara/p/ek42hh9307/et/sufx/) |
| Kit de limpeza para telas | [Screen cleaner SVC1131/10 - Philips](https://www.philips.co.uk/c-p/SVC1131_10/screen-cleaner) |
| Protetor facial | [Przyłbica osłona twarzy Honeywell PERFORMA NOVA 820140 (HON-820140) - Dobra Cena - Sklep BHP Online - Behapownia](https://behapownia.pl/przylbica-performa-nova-820140) |
| Abafador de ruído | [ – 1000 Marcas Safety Brasil](https://www.1000marcasbrasil.com.br/products/abafador-de-ruidos-tipo-concha-23-db-amarelo-3m-h9a-ca-12189-hb004153605) |
| Cinto de sustentação para roçadeira | [Cinto De Sustentação Duplo Roçadeira Universal Confortável - MercadoLivre](https://www.mercadolivre.com.br/cinto-de-sustentaco-duplo-rocadeira-universal-confortavel/p/MLB48221948) |
| Fone de ouvido Bluetooth | [Fone ouvido sem fio bluetooth  que carrega - Pontofrio](https://www.pontofrio.com.br/fone-ouvido-sem-fio-bluetooth--que-carrega/b) |

## Validação

- `npm run test:upsells`: três ofertas em cada um dos 31 produtos, 65 imagens locais, preço no servidor, assinatura e bloqueio de compras pendentes/reembolsadas.
- `npm run test:purchase` e `npm run test:ic`: regressão do rastreamento.
- `npm run build`: cliente e servidor.

As verificações de pagamento usam respostas simuladas e não criam cobranças reais. A conta FortPay continua usando o produto e a oferta cadastrados na integração existente com valor dinâmico. A entrega física e o estoque dos novos complementos precisam ser atendidos pela loja.

Para cobranças principais criadas antes da atualização, o cache antigo pode não conter o contexto assinado; nesse caso as ofertas não são exibidas. Não se gera uma nova cobrança principal para forçar upsells.
