# Validação da refatoração v2 — 9 de setembro de 2026

## Confirmado

- TypeScript sem erros; bundles Expo para iOS, Android e web exportados.
- 74 testes de backend aprovados: 66 existentes e 8 novos testes da camada sensorless, contexto e perfil do cuidador.
- Teste de modelo frontend aprovado: limites de calibração e estado desconhecido sem evidências, preservando compatibilidade futura.
- Percurso automatizado no Edge, 393 × 852: primeiro onboarding → login/acesso demo → identificação manual → cadastro completo → detalhes → check-in seco → recomendação baseada no vaso → rega → histórico → Home → Activity → Profile → recarregamento → Learning.
- Perfil, ambiente, planta e eventos permaneceram no banco após recarregamento. Nenhum erro de console no percurso.
- Dados de testes isolados em um banco próprio na porta 8002. Nenhuma planta do jardim principal foi apagada.

## Evidência visual

Capturas em `review/v2/`: perguntas, convite, login, cadastro, contexto, vaso, substrato, detalhes, check-in, confirmação, recomendação, rega, histórico, Home, Activity, Profile e aprendizagem. Gravações do percurso em `review/v2/video/`. Capturas inspecionadas para hierarquia, espaçamento, CTA principal, abas, conteúdo com rolagem e fidelidade à identidade.

Os cenários de 320 × 700 com movimento reduzido, falha/retry de gravação, resposta desconhecida e observação visual têm capturas próprias e relatório `state-errors.json`.

## Limites

Não houve execução em simulador ou aparelho nativo nesta sessão. Exportação não equivale a teste em iPhone/Android. Gestos nativos, câmera física, permissões, VoiceOver/TalkBack, fontes ampliadas do sistema e 60 fps em release precisam de validação em aparelho. O servidor Expo está preparado para o iPhone já usado pelo usuário.

Clima, identificação por IA, OAuth, push, pagamentos reais e fotos em storage remoto permanecem integrações futuras. A camada sensorless é um motor de regras explicável, não um modelo preditivo treinado. Baseline de intervalos tem limite metodológico documentado.

P0 foi o escopo aplicado. P1/P2 do brief continuam posteriores, conforme `docs/REFACTOR-V2.md`.
