# Rootera v2 — MVP sem dependência de sensores

## Direção escolhida

Foram considerados três caminhos: diário fotográfico, onboarding conversacional e cuidado orientado à próxima ação. A implementação combina perguntas curtas com uma Home orientada à ação. Fotografias do usuário ocupam o hero da planta; as ilustrações aprovadas permanecem como alternativa. Mantidos logo, família tipográfica e paleta creme/oliva.

Referências: padrões de contexto e cuidado do [Planta](https://getplanta.com/), as três pranchas originais, pesquisa anterior de identificação e o brief `rootera_interface_refactor_v2.md`. Mobbin continuava limitado pelo plano; não foi alegado acesso a telas pagas. A pesquisa informa padrões, sem copiar interfaces externas.

## P0 aplicado

- Primeira abertura: onboarding → Welcome/login ou acesso demonstrativo → cadastro. O login não aparece antes das perguntas.
- Duas perguntas sobre experiência e quantidade de plantas, persistidas no Caregiver Profile. Transição para login/acesso demonstrativo e primeiro cadastro ou jardim existente.
- Cadastro em seis etapas após confirmação da espécie: vínculo, tempo com o cuidador, estágio, ambiente, vaso e substrato. Respostas desconhecidas são válidas.
- Home, Plants, Activity e Profile. Uma ação principal na Home, listas visuais e estados vazios.
- Detalhes com hero, próxima ação, justificativa, contexto, aprendizagem e histórico.
- Check-in do solo com cinco respostas; observação visual com detalhes opcionais; registro de rega com detalhes opcionais.
- Orientações adaptadas ao nível de detalhe do cuidador e às evidências registradas.
- Sensores removidos da navegação principal e do onboarding. Código, endpoints, dados e testes anteriores preservados.

## Persistência e modelo

`PlantIn` inclui ambiente tipado, tempo com o usuário, estágio, drenagem, material, vaso autoirrigável e substrato. `ProfileIn` inclui `CaregiverProfile`. Tudo é persistido nas colunas JSON já existentes, sem apagar dados ou exigir alteração destrutiva de schema. Registros antigos continuam válidos.

`SensorlessGuidance` compõe a camada `guidance` do Plant Twin e ela é persistida junto à projeção. Usa exclusivamente eventos USER, horário e contexto declarado; preserva as camadas originais `measured`, `reported` e `inferred` para compatibilidade futura.

A primeira avaliação de solo seco após uma rega pode compor um intervalo observado. Só após três ciclos separados é exibida a mediana desses intervalos, sempre identificada como tempo até a observação, não tempo físico exato de secagem nem calendário de rega. Frequência de check-ins altera essa estimativa. Não há promessa de aprendizagem em sete dias, confiança numérica na UI ou diagnóstico de saúde.

Uma rega invalida o uso de um relato anterior como solo atual. “Não sei” não vira um percentual nem confirmação de solo úmido. Alterações visuais pedem observação, sem diagnóstico. Sensores reais ou demonstrativos não alimentam esta nova camada do MVP.

Novos jardins começam vazios. O seed demonstrativo antigo pode ser habilitado com `ROOTERA_SEED_DEMO=true` no primeiro boot de um novo banco. Jardins existentes são preservados.

## Escopo posterior

P1/P2 continuam posteriores: recuperação clínica, encerramento e histórico de plantas passadas, novos tiers Plus/Pro, linha do tempo fotográfica rica, progressão e análises avançadas. Os planos demonstrativos anteriores foram preservados e tiveram promessas de sensores/clima removidas.

Clima, identificação automática por foto, armazenamento remoto de fotos, push, OAuth e pagamentos reais ainda exigem integração externa. A aplicação informa essas limitações. A preferência de lembretes e a Activity são funcionais; notificações push não são simuladas como entregues.

Foi preservado React Navigation em vez de migrar a navegação existente para Expo Router. A refatoração prioriza comportamento e dados do MVP sem trocar toda a infraestrutura. O restante da stack sugerida pode ser adotado quando houver necessidade concreta.


## Revisão de navegação e hierarquia — 2026-09-09

O cadastro foi reduzido a duas etapas com contexto opcional expansível. Busca manual vai direto ao cadastro. Onboarding apresenta planta e exemplos de notificações antes das duas perguntas; acesso da demonstração vem depois. Cuidados confirmam inline nos detalhes, sem rota intermediária de sucesso. Home usa um resumo compacto; detalhes apresentam ações antes do ambiente; Activity prioriza registros. Ver `review/refinement/REVIEW.md` para evidências e validação.
