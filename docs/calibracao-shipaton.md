# Calibração do Gêmeo da Planta — revisão para a Shipaton

Data: 29/09/2026. Escopo: regras de secagem (backend), checagem em três camadas, planta virtual do Laboratório Shipaton, e a pergunta "precisamos de IA?".

## 1. Como o sistema decide (resumo)

- A pessoa checa a terra em três camadas: **superfície** (ponta do dedo), **meio** (dedo, uns 5 cm) e **fundo** (palito de madeira ou o furo de drenagem). Cada uma: seca, úmida ou molhada; o fundo aceita "não alcancei".
- Cada espécie tem uma profundidade que decide a rega (`backend/app/species.py`, campo `dryness`):
  - `top` (superfície): lírio-da-paz, samambaia, calathea, pilea, gérbera, girassol, manjericão.
  - `half` (até ~5 cm): costela-de-adão, jiboia, ficus-elástica, orquídea.
  - `full` (vaso inteiro): babosa, espada-de-são-jorge, zamioculca, cacto, echevéria.
- As camadas viram uma leitura única nessa profundidade (`backend/app/soil.py`). Um **ciclo** vai da rega até a primeira checagem seca. Com 3 ciclos, a janela passa a vir só dos registros da própria planta. Antes disso, é uma estimativa geral por espécie e vaso (`backend/app/forecast.py`), misturada aos primeiros ciclos.
- Padrões que só as camadas mostram:
  - **Fundo molhado com superfície seca:** o app manda esperar, mesmo em plantas de superfície.
  - **Fundo seco até 2 dias depois da rega:** a água não chegou lá.
  - **Fundo não alcançado:** nunca conta como seco para plantas que secam por inteiro.

## 2. Fontes usadas na calibração

| Grupo | O que as fontes dizem | Fonte |
|---|---|---|
| Superfície | Regar quando os 2,5–5 cm de cima secam; cerca de uma vez por semana | [SDSU Extension, Peace Lily](https://extension.sdstate.edu/peace-lily-houseplant-how), [Ask Extension](https://ask.extension.org/kb/faq.php?id=922140) |
| Meio (costela) | Regar semanalmente ou quando os 2,5–5 cm de cima secam; 7–14 dias | UMN Extension (via [Planet Houseplant](https://planethouseplant.com/when-should-you-water-monstera-deliciosa/)), [UConn Home & Garden](https://homegarden.cahnr.uconn.edu/factsheets/monstera-deliciosa) |
| Meio (jiboia) | Deixar secar bem; na prática, os 2,5–5 cm de cima, a cada 7–10 dias | [Clemson HGIC](https://hgic.clemson.edu/factsheet/how-to-grow-pothos-indoors-epipremnum-spp-care-cultivars-and-common-problems/) |
| Vaso inteiro | Cactos e suculentas: "uma ou duas vezes por mês"; babosa e espada-de-são-jorge: a cada 2–3 semanas no verão, terra completamente seca | [Virginia Tech SPES-804](https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-804.html), [Almanac, Aloe](https://www.almanac.com/plant/aloe-vera) |
| Fatores do vaso | Vaso pequeno, barro, substrato graúdo e mais luz secam mais rápido; vaso grande e substrato fino seguram água | [Colorado State PlantTalk 1315](https://planttalk.colostate.edu/topics/houseplants/1315-houseplants-containers/) |

Todas as fontes dizem que a checagem com o dedo vale mais que o calendário, e é assim que o app funciona.

## 3. O que a revisão encontrou e corrigiu

1. **Jiboia mal calibrada.** Estava como planta de superfície, então o app sugeriria regar a cada ~4 dias. As fontes indicam de 7 a 10. Passou para "até ~5 cm".
2. **Janela de largura zero** ("4–4 dias"). Como ninguém checa com precisão maior que um dia, a janela agora tem no mínimo 1 dia. Nas simulações de cuidadores, o acerto da janela subiu de 57–87% para 68–96%, sem mudar nenhum resultado de cuidado.
3. **Abas Agora e Ritmo em desacordo.** Uma dizia "falta 1 dia" e a outra "pode estar seca". Agora as duas usam uma regra só de fase: antes da checagem, checagem cedo, janela, passou.
4. **A rodada de checagens gravava um valor só.** Isso contornava as três camadas obrigatórias. Corrigido.
5. **Laboratório:** uma checagem digitada podia ser ignorada. Corrigido.
6. **Furos de rota testados, todos já fechados** (`backend/tests/test_holes.py`):
   - marcar uma planta como exemplo para escapar do limite do plano;
   - usar o id do exemplo de outra conta;
   - uma leitura única contradizendo as camadas;
   - datas no futuro ou sem fuso horário;
   - registrar em planta arquivada;
   - limites do laboratório.

## 4. A planta virtual do laboratório

Tempos até cada camada secar, para um vaso médio de plástico com furo, substrato comum, luz forte indireta, dentro de casa (`backend/app/lab.py`, `TRUTH_DAYS`):

| Profundidade | Superfície | Meio (~5 cm) | Fundo |
|---|---|---|---|
| Superfície | 5,5 d | 8 d | 11 d |
| Meio | 4,5 d | 9 d | 13 d |
| Vaso inteiro | 3,5 d | 9 d | 16 d |

Esses tempos se ajustam por:
- **Vaso:** o pequeno encurta, o grande alonga.
- **Sem furo:** o fundo leva mais que o dobro.
- **Luz:** pouca luz alonga, sol direto encurta.
- **Ritmo individual da planta:** de 0,8 a 1,2.

O Rootera nunca lê esses números. Ele só vê o que o cuidador simulado registra.

### Resultados (8 semanas, vaso médio, luz forte indireta)

Colunas: Real = dias até secar de verdade; Aprendido = o que o Rootera aprendeu, em dias; Encharc./Sede/Mal = dias da planta nesse estado.

| Espécie | Método | Real | Aprendido | Janela | Regas | Encharc. | Sede | Mal |
|---|---|---|---|---|---|---|---|---|
| lírio-da-paz | Rootera | 5,2 | 4,5 | 4–5 (ciclos) | 10 | 0 | 0 | 0 |
| lírio-da-paz | a cada 3 dias | 5,2 | – | 3–6 (estimativa) | 19 | 50 | 0 | 37 |
| lírio-da-paz | a cada 14 dias | 5,2 | 5,0 | 5–6 (ciclos) | 4 | 0 | 24 | 16 |
| costela-de-adão | Rootera | 8,6 | 9,0 | 9–10 (ciclos) | 6 | 0 | 0 | 0 |
| costela-de-adão | toda semana | 8,6 | – | 6–13 (estimativa) | 8 | 0 | 0 | 0 |
| jiboia | a cada 14 dias | 8,6 | 9,0 | 9–10 (ciclos) | 4 | 0 | 0 | 0 |
| babosa | Rootera | 15,2 | 16,0 | 15–16 (ciclos) | 4 | 0 | 0 | 0 |
| babosa | toda semana | 15,2 | – | 13–27 (estimativa) | 8 | 42 | 0 | 29 |

Leitura:
- **Com o método Rootera,** todas as 16 espécies ficam sem nenhum dia encharcado ou com sede. As regas saem a cada ~6 dias (superfície), ~8,6 (meio) e ~15 (vaso inteiro), que é o que as fontes recomendam. O aprendido fica a no máximo 0,8 dia do real.
- **Com regas num calendário fixo antes de secar,** o Rootera nunca vê um ciclo completo e fica na estimativa geral. É o comportamento correto, e o laboratório explica isso para quem testa.

### Limites conhecidos (honestos)

- **Sem clima.** Calor, umidade do ar e estação ainda não entram; no inverno tudo seca mais devagar. O espaço está reservado (`WEATHER` em `lab.py`, `weather_connected` no gêmeo, cartão "Em breve" na tela).
- **Um ciclo só fecha com uma checagem seca.** Quem rega sempre antes de secar não ensina o Rootera. Melhoria possível depois da Shipaton: usar "ainda úmida no dia X" como limite inferior.
- **Os tempos por camada são uma escolha calibrada, não uma medição.** As fontes dão intervalos de rega, não curvas de umidade por profundidade. A direção de cada fator vem das fontes; o tamanho de cada fator é conservador.

## 5. Precisamos de IA para o gêmeo?

**O que as APIs de planta já trazem:**

| API | Traz dados de cuidado? | O quê |
|---|---|---|
| Pl@ntNet (integrada hoje) | Não | Só identifica a espécie ([docs](https://my.plantnet.org/doc/api/identify)) |
| Kindwise plant.id | Parcial | `watering` mínimo/máximo numa escala 1–3 (seca, média, úmida), compilada do MOBOT e do RHS ([handbook](https://www.kindwise.com/handbook)) |
| Perenual | Parcial | `watering_general_benchmark`, por exemplo "5–7 dias", sem profundidade ([docs](https://perenual.com/docs/api)) |

Nenhuma traz o que o Rootera usa: a profundidade que decide a rega, as notas por espécie, a dica de checagem e a janela inicial. Como elas trazem parte disso, a ideia de IA continua, mas só para uma coisa: **gerar as notas de espécies fora do catálogo de 16**. Hoje essas plantas entram como "outra" e aprendem só com as checagens.

**Como seria:** a espécie é identificada pelo Pl@ntNet. Uma única chamada de IA por espécie, feita no servidor, devolve um JSON fechado: profundidade (`top`/`half`/`full`), resumo, quando regar e dica de checagem. A saída é validada, presa aos intervalos conhecidos, guardada em cache para todos os usuários e marcada na tela como "notas geradas". Ela nunca passa por cima dos ciclos da própria planta.

| | Gemini Flash-Lite | DeepSeek | Sem IA (Kindwise → profundidade) |
|---|---|---|---|
| Custo | Centavos por mil espécies | O mais barato | Plano pago da Kindwise |
| Qualidade | Boa, com saída em JSON estruturado | Boa em texto; JSON menos rígido | Dado real, mas grosseiro (3 níveis) |
| Risco de inventar | Existe; mitigado por enum, limites e cache revisável | Igual | Nenhum |
| Privacidade | Só o nome científico sai do servidor | Dados processados na China, o que pesa para uma loja global | Envia a foto para a Kindwise |
| Latência | Uma vez por espécie (cache) | Igual | Por identificação |
| Credenciais | Chave no servidor, nunca no app | Igual | Igual |

**Recomendação:**
- **Para a Shipaton:** não é necessário. As 16 espécies do catálogo foram escritas à mão, com fontes, e as outras aprendem com as checagens da própria planta, o que é honesto.
- **Depois da Shipaton:**
  1. Mapear o `watering` da Kindwise direto para a profundidade (seca → vaso inteiro, média → meio, úmida → superfície), sem IA.
  2. Usar o Gemini Flash-Lite só para redigir as notas, validado e em cache.
  3. Evitar o DeepSeek enquanto o Rootera guardar dados de usuários fora do Brasil.
