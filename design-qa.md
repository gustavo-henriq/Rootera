# Revisão visual do Rootera

Referência principal: as três pranchas enviadas pelo usuário. As melhorias foram autorizadas após a proposta de restaurar os elementos originais e ajustar movimento e navegação. A skill local Appllama orientou o trabalho; não foi usado acesso Pro. A pesquisa Mobbin estava indisponível por restrição do plano.

## Alterações aplicadas

- Retorno à paleta creme, verde e oliva, logo com broto, plantas ilustradas e vasos de terracota. Botões e cartões com proporções mais próximas das referências.
- Onboarding de identificação: vaso cai primeiro, folhagem entra depois e balança ao pousar. Movimento em Reanimated, cancelado ao sair da etapa.
- Três notificações com entradas sucessivas; cada nova mensagem desloca as anteriores para cima, escurecendo e desfocando suavemente o texto antigo.
- Aprendizado em três estágios e entrada das barras de leitura do sensor. A leitura do onboarding é identificada como exemplo.
- Navegação em abas preserva as telas e oferece retorno ao topo ao tocar na aba ativa. Cadastro e plano concluídos removem etapas obsoletas da navegação. Repetir onboarding nas configurações retorna às configurações.
- Cadastro com linhas compactas e seletores que se abrem sob demanda; câmera com guias de enquadramento, disparador, galeria e troca de câmera.
- Movimento reduzido substitui a sequência das notificações por uma lista estática sem desfoque.

## Conferência visual

Capturas reais do navegador em `review/`: welcome, onboarding 1/3/4, três momentos das notificações, Home, câmera, identificação, cadastro, planos, sucesso e históricos separados. Comparação manual com as pranchas: composição, cores, ilustrações, alinhamento, hierarquia e barra inferior.

Corrigidos durante a conferência: texto solto dentro de componentes de layout, barra inferior com rótulos cortados, linhas do cadastro excessivamente expandidas, guias de câmera excessivamente espessas e sobreposição das notificações no modo de movimento reduzido.

## Resultado e pendências

Revisão no navegador concluída para os percursos registrados. Validação nativa permanece pendente: câmera real, gestos e desempenho exigem aparelho/emulador. As imagens extraídas das referências têm resolução limitada, sobretudo a miniatura de Monstera; arquivos originais de maior resolução permitirão acabamento superior em ampliações.

A implementação mantém controles e dados funcionais, portanto não reproduz percentuais de saúde ou sensores sem evidência. Identificação por foto ainda pede confirmação manual da espécie; planos são demonstrativos. Não foi declarado resultado de IA ou compra real.

## Refinamento de interação

Botões receberam pressão e soltura animadas; confirmações de cuidado/plano receberam pulso único; calibração recebeu barra animada. Todos respeitam movimento reduzido. A revisão adicional corrigiu erros de formulário e navegação sem alterar a identidade visual. Evidências: `review/invalid-calibration.png`, `review/animated-calibration.png`, `review/settings-save-error.png` e gravações em `review/revision-video/`.

## Interface v2

A refatoração de 9/9 substitui os slides descritivos pelo onboarding conversacional antes do login. Home orientada à próxima ação, abas Home/Plants/Activity/Profile, cadastro progressivo e detalhes com justificativa e aprendizagem. Sensores ficam fora da navegação do MVP. A revisão específica e suas limitações estão em `VALIDATION-V2.md`; imagens anteriores neste relatório são históricas.
