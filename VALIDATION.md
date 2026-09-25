# Validação — 8 de setembro de 2026

## Resultados

- TypeScript: `npm run typecheck` passou.
- Exportação Expo: bundles iOS, Android e web gerados com `npm run build`.
- Backend: 66 testes passaram em SQLite isolado. Dois avisos de depreciação do ambiente de testes; nenhum teste falhou.
- Navegador: Edge automatizado, viewport 393 × 852, com API redirecionada exclusivamente para um banco de teste na porta 8001. O jardim principal não recebeu plantas de QA.
- Percurso exercitado: welcome → quatro etapas de onboarding → Home; limite gratuito → planos → ativação demonstrativa → retorno ao cadastro; câmera com foto de exemplo → seleção manual → cadastro → detalhes; registro de avaliação do solo → histórico da pessoa; histórico de sensores separado; recarregamento com dados persistidos.
- O teste de navegação confirmou o retorno ao jardim depois do cadastro concluído. A ativação de plano devolveu ao fluxo que a abriu.

- Movimento reduzido: conferido em 320 × 700; três mensagens estáticas legíveis e retorno da repetição do onboarding para configurações. Percursos finais sem erros de console ou execução.

## O que os testes do backend cobrem

Separação de observações USER e SENSOR; autenticação e isolamento por proprietário; calibração; leituras fora de ordem, repetidas, futuras e antigas; revogação de dispositivo; reconstrução e persistência do Twin; conflitos entre evidências; exclusão de dados demonstrativos da inferência real. O Twin preserva estado reportado, medido e inferido com proveniência.

## Limites desta verificação

A exportação não é uma compilação assinada nem um teste de instalação nativa. Não havia simulador iOS ou emulador Android disponível nesta sessão. Câmera física, permissões nativas, gestos, VoiceOver/TalkBack, áreas seguras em aparelhos e desempenho de animação ainda precisam ser verificados em dispositivos. Não se afirma desempenho de 60 fps.

Nenhum ESP32 físico ou PostgreSQL externo foi conectado. Foram verificados a API e os contratos usando SQLite. OAuth Google/Apple, identificação por IA, compras reais, notificações push e provisionamento BLE dependem de integrações externas; as telas sinalizam as funções demonstrativas. Fotos continuam sendo referências locais, sem upload para armazenamento remoto.

## Evidências

Capturas e gravações do navegador ficam em `review/`. Os relatórios `errors.json` e `flow-errors.json` registram erros de console e execução dos percursos correspondentes. A validação visual está descrita em `design-qa.md`.

## Revisão adicional: erros e feedback animado

Corrigidos: aceitação de valores ADC não finitos ou fracionários; edição de calibração que descartava referências salvas; risco de reutilizar o ID de um sensor real para uma demonstração; volta para pareamento já concluído; resposta antiga de atualização sobrescrevendo uma gravação recente; estado positivo sem evidências; ausência de estado de erro/progresso ao salvar configurações.

Novos movimentos: pressão e soltura suaves dos botões, pulso único de confirmação de sucesso e transição da barra de calibração. Movimento reduzido remove a escala e torna a barra instantânea. A ilustração antiga que já não era usada foi removida do código, reduzindo os assets exportados.

`npm run test:model` cobre limites ADC, entradas não finitas/fracionárias, pontos de calibração e status desconhecido sem evidências. Os 66 testes do backend, TypeScript e exportação das três plataformas passaram novamente. A revisão no navegador incluiu falha de gravação seguida de recuperação, calibração inválida, reabertura com valores salvos e remoção de etapas concluídas. Capturas e gravações estão em `review/`; erros do percurso em `revision-errors.json`.

A regressão final confirmou que a edição demonstrativa preserva um dispositivo real cadastrado na mesma planta. O teste também mediu a transformação visual do botão durante o toque e confirmou sua ausência com movimento reduzido. Nenhum erro de console nesse percurso.
