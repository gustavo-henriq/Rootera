# Rootera: roteiro do vídeo (Shipaton 2026, Next Gen Award)

**Regras que o vídeo precisa cumprir** (regulamento oficial):
- Menos de 2 minutos. Os jurados não são obrigados a assistir além disso. Mire em 1:50.
- Mostrar o app **funcionando no aparelho** (o iPhone): grave a tela do próprio celular.
- Público no YouTube ou Vimeo, com o link no formulário.
- Sem música com direitos autorais nem marcas de terceiros. Use a Biblioteca de Áudio do YouTube, ou nenhuma música.

**O que os jurados avaliam no Next Gen**, e onde cada critério aparece:

| Critério | Onde aparece |
|---|---|
| A ideia é clara e resolve um problema real? | 0:00–0:15 |
| Há um app funcionando (vídeo + código)? | 0:15–1:25 |
| Usa a RevenueCat de forma pensada? | 1:25–1:45 |
| Escolhas técnicas, produto e apresentação | Ao longo do vídeo e em 1:45–1:55 |

## A ideia para inovar: "a terra de verdade e a terra do app"

Todo app de plantas mostra telas. O Rootera pode mostrar **a terra**. O fio do vídeo é um vaso de verdade:
- Um palito de madeira entra na terra, e a mesma checagem aparece no app, camada por camada.
- Você corta entre a mão real e a tela, sempre com o mesmo movimento (a mão desce, a tela desce).

Isso prova, sem precisar falar, que o app é baseado no mundo físico. É algo que quase ninguém vai ter.

Outras ideias, se quiser combinar:
- **A planta narra.** Voz em primeira pessoa ("Meu humano me regava toda segunda. Eu não queria água toda segunda.").
- **3 meses em 10 segundos.** O Laboratório Shipaton passa um inverno inteiro e mostra as três fases de aprendizado.
- **Uma cena que acontece no céu.** Grave o céu nublado de verdade e corte para a nuvem do laboratório virando sol.

## Roteiro (legendas em inglês; a narração pode ser em inglês ou em português com legenda)

| Tempo | Imagem | Legenda / narração (EN) | Tradução |
|---|---|---|---|
| 0:00–0:07 | Vaso real. Um dedo entra na terra, depois o palito. | "Every care guide says the same thing: check the soil, not the calendar." | Todo guia diz o mesmo: olhe a terra, não o calendário. |
| 0:07–0:15 | Abertura do app: a semente cai, o logo brota, o mergulho na terra. | "But nobody tells you what the soil is telling you. Rootera does." | Mas ninguém te diz o que a terra está dizendo. O Rootera diz. |
| 0:15–0:30 | Onboarding: as raízes descem e os três cards aparecem sozinhos; escolher a planta. | "It learns from three sources: what you observe, what you tell it, and species notes. Every suggestion shows which one it came from." | Ele aprende de três fontes... Toda sugestão mostra de onde veio. |
| 0:30–0:50 | **Corte duplo:** o palito na terra real / a checagem em 3 camadas no app. Superfície seca, meio úmido, fundo molhado. | "Surface, middle, bottom. Each species decides at its own depth. Dry on top but wet at the bottom? Rootera says wait." | Superfície, meio, fundo. Cada espécie decide na sua profundidade. Seca em cima e molhada no fundo? O Rootera manda esperar. |
| 0:50–1:08 | Página da planta: "Perto de secar" + a linha do tempo; aba Ritmo com os ciclos; a linha do clima. | "Each watering starts a cycle. After one, it's still analyzing. After two, it gets specific. After three, it's your plant's own pattern. Local weather nudges the window." | Cada rega abre um ciclo... Depois de três, é o padrão da sua planta. O clima local ajusta a janela. |
| 1:08–1:25 | Laboratório Shipaton: o regador vira nuvem e depois sol; simular 91 dias no "Inverno em Porto Alegre" com "Seguir o Rootera". | "For the judges: a lab that runs three months of a virtual plant in seconds, with real weather. Rootera stays inside the ranges from university extension guides." | Para os jurados: um laboratório que roda 3 meses em segundos, com clima real, dentro dos intervalos das fontes. |
| 1:25–1:45 | Adicionar a 4ª planta → estante grátis cheia → Rootera+ (mensal, anual, vitalício) → compra → "Gerenciar assinatura" (Customer Center). | "Free keeps three plants. Rootera+ removes the limit: monthly, yearly or lifetime, through RevenueCat Paywalls. The server confirms the entitlement with RevenueCat; the app never decides on its own." | O grátis guarda 3 plantas... O servidor confirma a assinatura na RevenueCat; o app nunca decide sozinho. |
| 1:45–1:55 | Tela final com o logo; texto: "Open source · MIT · github.com/SEU-USUARIO/rootera". | "Rootera. Built by a student for Shipaton 2026." | Feito por um estudante para a Shipaton 2026. |

## O trecho da RevenueCat: escolha antes de gravar

No Expo Go, o SDK da RevenueCat roda em **Preview API Mode**: as compras são simuladas e o Paywall nativo não abre. Você tem duas opções:
1. **Build de desenvolvimento no Android.** É a mais forte. Precisa de um celular Android ou do emulador e de uma conta gratuita na Expo:
   - rode `npx eas build --profile development --platform android` e instale o APK;
   - com a chave do Test Store no `.env`, o Paywall de verdade abre, a compra de teste funciona e o Customer Center também.
   - Grave essa parte no Android. O regulamento aceita, porque o app é feito para iOS e Android.
2. **Só o iPhone (Expo Go).**
   - Tire a chave de teste do `.env`, para o app mostrar o modo prévia identificado ("sem cobrança").
   - Grave o painel da RevenueCat: o entitlement `rootera`, os três produtos, o Paywall publicado e o Customer Center.
   - Na legenda, diga que a compra roda na build nativa.

Em qualquer uma das duas: publique o Paywall e ative o Customer Center no painel **antes** de gravar.

## Checklist de gravação
- iPhone em "Não perturbe", bateria cheia e horário limpo na barra de status.
- Tamanho de texto padrão. Escolha um tema, claro ou escuro, e mantenha até o fim.
- Grave com a gravação de tela do iOS (Central de Controle). Grave cada cena separada e monte depois.
- Use o banco de teste com a "MVP Shipaton" e uma ou duas plantas com histórico. O Laboratório está em Você → Laboratório Shipaton.
- As cenas do vaso real precisam de luz de janela, fundo limpo e o celular num apoio.
- Monte em 1080p (CapCut, iMovie, DaVinci), com legendas grandes e sem música com direitos.
- Envie ao YouTube como **público** (ou não listado) e teste o link numa janela anônima.
