"""Language of the guidance text. English is the source and the stored form (twin snapshots,
change reports); Portuguese (Brazil) is produced for the garden snapshot when the app asks
for it with Accept-Language. Placeholders use braces: tr('It has been {n}.', 'pt', n=...).
"""

PT = {
    # Guidance templates
    'Your pot has no drainage hole, so extra water can stay at the bottom.': 'Seu vaso não tem furo de drenagem, então o excesso de água pode ficar parado no fundo.',
    'Check the self-watering reservoir before adding water.': 'Confira o reservatório do vaso autoirrigável antes de colocar mais água.',
    'Start with a soil check': 'Comece checando a terra',
    'A first soil check tells Rootera where this plant is starting from. Every later check is compared with it.': 'Uma primeira checagem da terra mostra ao Rootera de onde esta planta está partindo. Cada checagem depois é comparada com ela.',
    'Check the soil next': 'Cheque a terra agora',
    'You noticed a change in how it looks. The soil adds context before you change anything in your routine.': 'Você notou uma mudança na aparência. A terra dá contexto antes de você mudar algo na rotina.',
    'Look at the leaves in a day or two': 'Olhe as folhas em um ou dois dias',
    'You watered after noticing a change. Give it a day or two and look at the leaves again before adding more water.': 'Você regou depois de notar uma mudança. Espere um ou dois dias e olhe as folhas de novo antes de regar mais.',
    'Look at the leaves again tomorrow': 'Olhe as folhas de novo amanhã',
    'You found the soil {soil} and noticed a change in the leaves. See whether the change continues before adjusting care.': 'Você achou a terra {soil} e notou uma mudança nas folhas. Veja se a mudança continua antes de ajustar o cuidado.',
    'You found the soil dry': 'Você achou a terra seca',
    'If you water, pour slowly until a little drains out, then empty the saucer. Record it here so Rootera can follow the next cycle.': 'Se for regar, despeje devagar até escorrer um pouco e depois esvazie o pratinho. Registre aqui para o Rootera acompanhar o próximo ciclo.',
    'If you water, use a small amount and record it so Rootera can follow the next cycle.': 'Se for regar, use pouca água e registre aqui para o Rootera acompanhar o próximo ciclo.',
    'Nearly dry': 'Quase seca',
    'There is still some moisture below the surface. Another check tomorrow will show whether it has dried through.': 'Ainda há um pouco de umidade abaixo da superfície. Outra checagem amanhã mostra se secou por completo.',
    'The soil is close to dry. This species usually prefers water around this point, so a check tomorrow is worthwhile.': 'A terra está quase seca. Esta espécie costuma preferir água mais ou menos neste ponto, então vale checar amanhã.',
    'Still moist': 'Ainda úmida',
    'The soil is wet': 'A terra está encharcada',
    'Your check found moisture below the surface. Holding off on water for now keeps the roots from sitting wet.': 'Sua checagem encontrou umidade abaixo da superfície. Esperar para regar evita que as raízes fiquem encharcadas.',
    'With no drainage hole, excess water has nowhere to go.': 'Sem furo de drenagem, o excesso de água não tem para onde ir.',
    'The bottom is still wet': 'O fundo ainda está molhado',
    'The surface is dry, but the bottom of the pot is still wet. Water now would sit around the roots, so wait until the bottom dries too.': 'A superfície está seca, mas o fundo do vaso ainda está molhado. Regar agora deixaria água parada nas raízes; espere o fundo secar também.',
    'Dry as deep as you could check. This species likes to dry all the way through, so the bottom decides.': 'Seca até onde deu para checar. Esta espécie gosta de secar por inteiro, então quem decide é o fundo.',
    'A wooden skewer pushed to the bottom of the pot and left a minute shows it: it comes out clean and dry when the bottom is dry.': 'Um palito de madeira enfiado até o fundo por um minuto mostra: ele sai limpo e seco quando o fundo está seco.',
    'The bottom was still dry after the watering, so the water may not have reached it.': 'O fundo continuou seco depois da rega, então a água pode não ter chegado lá.',
    'Next time, pour slowly until a little water comes out of the drainage hole.': 'Na próxima, regue devagar até sair um pouco de água pelo furo.',
    'No clear answer yet': 'Ainda sem resposta clara',
    'That is fine. Soil can be hard to read at first. Next time, try a little deeper or compare with how it felt right after watering.': 'Tudo bem. No começo é difícil sentir a terra. Da próxima vez, tente um pouco mais fundo ou compare com como estava logo depois de regar.',
    'Watering recorded': 'Rega registrada',
    'Give it time to soak in. A soil check in a day or two shows how quickly this pot dries.': 'Dê tempo para a água penetrar. Uma checagem em um ou dois dias mostra a rapidez com que este vaso seca.',
    'In your last {n} cycles, the soil dried about {baseline} after watering, judging by your checks. It has been {since}.': 'Nos seus últimos {n} ciclos, pelas suas checagens, a terra secou cerca de {baseline} depois da rega. Já se passaram {since}.',
    'Probably not dry yet': 'Provavelmente ainda não secou',
    'A general estimate for this species and pot is about {low} to {high} days after watering. It has been {since}. Your own checks will replace it.': 'Uma estimativa geral para esta espécie e vaso é de {low} a {high} dias depois da rega. Já se passaram {since}. Suas checagens vão substituí-la.',
    'Your first cycles suggest about {low} to {high} days after watering. It has been {since}.': 'Seus primeiros ciclos indicam de {low} a {high} dias depois da rega. Já se passaram {since}.',
    'Around when it usually dries': 'Perto de quando costuma secar',
    'Check the soil today': 'Cheque a terra hoje',
    'Worth an early check': 'Vale uma checagem antecipada',
    'An early check shows whether this pot dries sooner than the estimate.': 'Uma checagem antecipada mostra se este vaso seca antes do estimado.',
    'Your last check, {ago}, found the soil dry. If you watered since, record it; if not, a quick check confirms it before you water.': 'Sua última checagem, {ago}, achou a terra seca. Se você regou depois, registre; se não, uma checagem rápida confirma antes de regar.',
    'Your last soil check was {ago}. Soil changes day to day, so a new check keeps the picture current.': 'Sua última checagem da terra foi {ago}. A terra muda de um dia para o outro, então uma nova checagem mantém tudo atualizado.',
    'There is no soil check since the last watering. A quick check shows how this pot is drying.': 'Não há checagem da terra desde a última rega. Uma checagem rápida mostra como este vaso está secando.',
    'Getting started': 'Começando',
    'Learning': 'Aprendendo',
    'Pattern found': 'Padrão encontrado',
    'Typical time until the soil dries after watering, judging by your checks. How often you check affects this number.': 'Tempo típico até a sua primeira checagem seca depois da rega. A frequência das suas checagens afeta este número.',
    '{n} hour': '{n} hora',
    '{n} hours': '{n} horas',
    '{n} days': '{n} dias',
    'today': 'hoje',
    'yesterday': 'ontem',
    '{n} days ago': 'há {n} dias',
    # Error details the app may show as they are
    'Plant not found': 'Planta não encontrada.',
    'Record not found': 'Registro não encontrado.',
    'Plant limit reached for your plan.': 'Limite de plantas do seu plano atingido.',
    'Observation ID reused with different data': 'Este registro já foi salvo com outros dados.',
    'Plant ID already used with different data': 'Esta planta já foi salva com outros dados.',
    'Invalid user token': 'Sessão inválida. Abra o app de novo.',
    'Photo identification is not connected yet.': 'A identificação por foto ainda não está conectada.',
    'Could not reach Pl@ntNet.': 'Não foi possível falar com o Pl@ntNet.',
    'The photo could not be read.': 'Não foi possível ler a foto.',
    'RevenueCat is not configured on the server.': 'A loja ainda não está configurada no servidor.',
    'Could not reach RevenueCat.': 'Não foi possível falar com a loja.',
    # Soil words used inside sentences
    'dry': 'seca', 'slightly moist': 'levemente úmida', 'moist': 'úmida', 'very wet': 'encharcada',
}

SPECIES_PT = {
    'aloe': {
        'summary': 'Guarda água nas folhas e tolera bem a terra seca.',
        'when_dry': 'A babosa costuma ir melhor quando a terra seca por completo antes da próxima rega.',
        'check_tip': 'Enfie o dedo na terra até a segunda falange. Para a babosa, seca até o fundo é normal antes de regar.',
        'thirst_sign': 'Folhas finas, enroladas ou enrugadas podem aparecer depois de um longo período seco.',
    },
    'peace-lily': {
        'summary': 'Prefere terra levemente úmida, que não seque por completo.',
        'when_dry': 'O lírio-da-paz costuma preferir água quando a camada de cima fica seca, antes de o vaso todo secar.',
        'check_tip': 'Toque os 2 a 3 cm de cima da terra. Seca nessa profundidade costuma ser o sinal para o lírio-da-paz.',
        'thirst_sign': 'Folhas caídas são um sinal comum de sede nesta espécie.',
    },
    'monstera': {
        'summary': 'Gosta de água quando a parte de cima da terra já secou.',
        'when_dry': 'A costela-de-adão costuma ir bem quando mais ou menos o terço de cima da terra secou.',
        'check_tip': 'Enfie o dedo uns 5 cm na terra. Seca nessa profundidade costuma ser o sinal para a costela-de-adão.',
        'thirst_sign': 'Folhas enroladas ou caídas podem indicar que a terra ficou seca por um tempo.',
    },
    'pothos': {
        'summary': 'Tolerante e adaptável; se recupera bem de um período curto sem água.',
        'when_dry': 'A jiboia costuma ir bem quando os primeiros centímetros da terra secaram.',
        'check_tip': 'Toque os 3 a 5 cm de cima da terra. Seca nessa profundidade costuma ser o sinal para a jiboia.',
        'thirst_sign': 'Folhas moles e caídas costumam se recuperar depois da rega.',
    },
    'snake-plant': {
        'summary': 'Guarda água nas folhas grossas e prefere secar por completo.',
        'when_dry': 'A espada-de-são-jorge costuma ir melhor quando a terra seca por completo antes da próxima rega.',
        'check_tip': 'Enfie o dedo fundo na terra ou use um palito de madeira. Seca até o fundo é normal antes de regar.',
        'thirst_sign': 'Folhas enrugadas ou dobrando podem aparecer depois de um período muito longo sem água.',
    },
    'zz': {
        'summary': 'Guarda água em rizomas sob a terra e lida bem com terra seca.',
        'when_dry': 'A zamioculca costuma preferir terra seca por completo antes da rega.',
        'check_tip': 'Enfie o dedo fundo na terra. Seca até o fundo é normal para a zamioculca antes de regar.',
        'thirst_sign': 'Caules enrugados podem aparecer depois de um longo período seco.',
    },
    'pilea': {
        'summary': 'Gosta que a parte de cima da terra seque, mas não o vaso todo.',
        'when_dry': 'A pilea costuma ir bem quando os primeiros centímetros da terra secaram.',
        'check_tip': 'Toque os 2 a 3 cm de cima da terra. Seca nessa profundidade costuma ser o sinal para a pilea.',
        'thirst_sign': 'Folhas caídas e moles são um sinal comum de sede.',
    },
    'cactus': {
        'summary': 'Feito para períodos secos; terra encharcada é o risco maior.',
        'when_dry': 'Cactos costumam ir melhor quando a terra secou totalmente antes da rega.',
        'check_tip': 'Enfie um palito de madeira até o fundo do vaso. Se sair limpo e seco, a terra secou por completo.',
        'thirst_sign': 'Uma superfície murcha ou enrugada pode indicar muito tempo sem água.',
    },
    'gerbera': {
        'summary': 'Uma planta de flor que gosta de terra uniformemente úmida, nunca encharcada, e de luz forte.',
        'when_dry': 'A gérbera costuma querer água quando os 2 a 3 cm de cima da terra secaram.',
        'check_tip': 'Toque os 2 a 3 cm de cima da terra. Seca nessa profundidade costuma ser o sinal para a gérbera. Regue a terra, não o centro das folhas.',
        'thirst_sign': 'Hastes e folhas caem rápido quando ela está com sede.',
    },
    'sunflower': {
        'summary': 'Uma anual que ama sol, de raiz funda; bebe mais no calor e durante a floração.',
        'when_dry': 'O girassol costuma querer água quando os primeiros centímetros secaram, com mais frequência no calor.',
        'check_tip': 'Enfie o dedo uns 5 cm na terra. Seca nessa profundidade costuma ser o sinal para o girassol.',
        'thirst_sign': 'As folhas ficam murchas no calor do dia quando a terra secou.',
    },
    'orchid': {
        'summary': 'Costuma ser cultivada em casca, não em terra; as raízes precisam de ar tanto quanto de água.',
        'when_dry': 'A orquídea costuma querer água quando a casca está quase seca e as raízes ficaram prateadas.',
        'check_tip': 'Olhe as raízes pelo vaso: cinza prateado quer dizer seco, verde quer dizer que ainda há água. Um palito de madeira na casca também funciona.',
        'thirst_sign': 'Folhas moles e enrugadas podem aparecer depois de um longo período seco.',
    },
    'fern': {
        'summary': 'Gosta de terra levemente úmida e ar úmido; não gosta de secar.',
        'when_dry': 'A samambaia costuma querer água assim que a superfície começa a ficar seca.',
        'check_tip': 'Toque os 1 a 2 cm de cima da terra. Para a samambaia, a superfície seca já é o sinal.',
        'thirst_sign': 'As pontas das folhas ficam secas ou pálidas quando a terra seca.',
    },
    'echeveria': {
        'summary': 'Uma suculenta que guarda água nas folhas; terra encharcada é o risco maior.',
        'when_dry': 'A echevéria costuma ir melhor quando a terra secou totalmente antes da rega.',
        'check_tip': 'Enfie um palito de madeira até o fundo do vaso. Se sair limpo e seco, a terra secou por completo.',
        'thirst_sign': 'As folhas ficam moles e levemente enrugadas depois de um longo período seco.',
    },
    'rubber-plant': {
        'summary': 'Um fícus resistente que gosta que a parte de cima da terra seque entre as regas.',
        'when_dry': 'A falsa-seringueira costuma ir bem quando mais ou menos o terço de cima da terra secou.',
        'check_tip': 'Enfie o dedo uns 5 cm na terra. Seca nessa profundidade costuma ser o sinal para a falsa-seringueira.',
        'thirst_sign': 'As folhas podem cair ou enrolar um pouco quando a terra fica seca.',
    },
    'calathea': {
        'summary': 'Gosta de terra levemente úmida e não gosta nem de secar nem de ficar encharcada.',
        'when_dry': 'A calateia costuma querer água quando os 2 cm de cima da terra secaram.',
        'check_tip': 'Toque os 2 cm de cima da terra. Seca nessa profundidade costuma ser o sinal para a calateia.',
        'thirst_sign': 'As folhas se enrolam para dentro quando ela está com sede.',
    },
    'basil': {
        'summary': 'Uma erva de folhas macias que gosta de umidade constante e bastante luz.',
        'when_dry': 'O manjericão costuma querer água quando os 2 cm de cima da terra secaram.',
        'check_tip': 'Toque os 2 cm de cima da terra. Seca nessa profundidade costuma ser o sinal para o manjericão.',
        'thirst_sign': 'As folhas murcham rápido quando a terra seca e costumam se recuperar depois da rega.',
    },
    '': {
        'summary': 'Ainda sem notas da espécie. A orientação depende do que você observa.',
        'when_dry': 'As necessidades variam muito entre espécies, então aqui as suas próprias checagens contam mais.',
        'check_tip': 'Enfie o dedo alguns centímetros na terra e anote se está seca, levemente úmida ou encharcada.',
        'thirst_sign': '',
    },
}


def lang_from(header: str | None) -> str:
    """'pt' for any Portuguese Accept-Language, otherwise English."""
    return 'pt' if (header or '').strip().lower().startswith('pt') else 'en'


def tr(text: str, lang: str = 'en', **values) -> str:
    out = PT.get(text, text) if lang == 'pt' else text
    return out.format(**values) if values else out
