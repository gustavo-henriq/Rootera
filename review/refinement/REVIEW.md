# Rootera — revisão aplicada

9 de setembro de 2026. Auditoria e correções sobre a versão em execução, usando as referências fornecidas e o brief v2 aprovado.

## 1. Home — corrigida

O bloco verde ocupava quase toda a primeira dobra e repetia mensagens genéricas de aprendizado. O resumo ficou compacto, com a planta, o motivo da orientação e uma ação. O histórico abaixo usa registros reais.

Antes:

![Antes](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/01-home-before.png)

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/14-home-after.png)

## 2. Detalhes — corrigidos

A imagem grande empurrava os cuidados para fora da tela. A planta agora aparece junto ao nome; abas com sublinhado se distinguem das respostas de formulário. Solo, rega e aparência ficam acessíveis antes dos detalhes do ambiente.

Antes:

![Antes](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/02-details-before.png)

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/20-details-final.png)

## 3. Check-in — corrigido

As opções deixaram de ser cinco cartões concorrentes. Uma lista agrupada mantém seleção e alvos de toque claros. Salvar volta à planta com confirmação inline; a tela intermediária de sucesso foi removida.

Antes:

![Antes](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/03-check-before.png)

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/11-check-after.png)

## 4. Onboarding — corrigido

Apresentação antes do acesso. A montagem do vaso foi preservada; três notificações entram em sequência, deslocando e escurecendo as anteriores com blur leve. Os exemplos citam dados informados, sem inventar clima, sensores ou porcentagens de saúde. Depois vêm duas perguntas de perfil.

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/05-notifications-after.png)

## 5. Cadastro — corrigido

A escolha manual vai direto ao cadastro, sem confirmar a mesma espécie duas vezes. O formulário passou de seis etapas para duas: planta e ambiente. Vaso, substrato, janela, estágio e tempo com o cuidador ficam em seções opcionais. O teste confirmou tanto o cadastro mínimo quanto a persistência do contexto adicional.

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/09-environment-after.png)

## 6. Atividade — corrigida

A lista principal mostra o histórico registrado, em vez de intercalar avisos genéricos de aprendizado. Checagens pendentes e padrões têm filtros próprios. Datas e origem dos registros ficam explícitas.

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/15-activity-after.png)

## 7. Perfil — corrigido

Grupos simples de linhas substituem cartões e mensagens decorativas. Editar experiência abre somente as perguntas de perfil, sem repetir a introdução.

Depois:

![Depois](C:/Users/Carlos/Documents/Codex/2026-09-07/faz-o-front-end-do-rootera-4/outputs/rootera/review/refinement/16-profile-after.png)

## Regras e dados

- Uma checagem seca recente não solicita imediatamente a mesma checagem novamente.
- Uma resposta “não sei” substitui a afirmação anterior; aparência antiga deixa de aparecer como observação atual.
- Uma observação visual seguida de solo ou rega atualiza a próxima orientação.
- Contexto de drenagem e reservatório continua presente na orientação.
- Regar pode ser registrado com um toque nos detalhes; informações adicionais ficam no botão de opções ao lado.
- Tentativas de gravação reutilizam o identificador do evento. Falha não exibe sucesso nem duplica registros.
- As observações USER continuam separadas da ingestão SENSOR. Banco principal e plantas existentes foram preservados; os testes usaram outro banco.
- O acesso da prévia é identificado como demonstração. Foram retirados botões Google/Apple que não realizavam autenticação.

## Verificação

- 79 testes de backend aprovados.
- TypeScript e testes do modelo aprovados.
- Fluxos exercitados no navegador: onboarding antes do acesso, cadastro com e sem dados opcionais, retorno após salvar, rega com um toque, abas, edição de perfil e persistência após recarregar.
- Teste a 320 × 700 com movimento reduzido: falha 503, nova tentativa, solo desconhecido, nota de aparência e ausência de duplicação.
- Mensagem de erro duplicada removida; contraste do texto de erro e dos textos secundários reforçado.
- Console sem erros na passagem final de navegação; gravações e capturas disponíveis nesta pasta.
- Exportação Expo de iOS, Android e web realizada. Isso não equivale a uma execução nativa em dispositivo.

## Limites

Esta revisão visual foi feita em navegador a 393 × 852 e 320 × 700. Não houve medição de FPS em release nem teste de VoiceOver, Dynamic Type ampliado, teclado nativo ou gestos no iPhone. O tema segue a referência clara aprovada. Autenticação de conta, notificações push, análise automática de fotos e clima continuam sem integração. A identificação por foto é assistida por escolha manual da espécie.
