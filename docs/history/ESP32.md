# Integração do ESP32 e banco externo

O backend já recebe, valida e salva o ADC bruto enviado por um dispositivo, com calibração versionada e atualização do Plant Twin. O firmware existente do usuário não foi inspecionado; este documento descreve o contrato HTTP a integrar nele. Não há implementação de descoberta Bluetooth, provisionamento de Wi-Fi ou firmware completo nesta entrega.

## 1. Executar o servidor local

Em um terminal PowerShell, dentro de `outputs/rootera/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:ROOTERA_DEMO = 'true'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

O modo padrão cria `backend/rootera.db` e persiste plantas, ações, dispositivos, calibrações, medições, eventos e Twins. A documentação interativa fica em `http://127.0.0.1:8000/docs`. `GET /health` consulta o banco e informa o modo de demonstração.

No navegador e no simulador iOS executado na mesma máquina do servidor, o cliente pode usar `http://127.0.0.1:8000`. O emulador Android usa `http://10.0.2.2:8000`. Em um celular físico ou ESP32, use o IP da máquina do servidor na mesma rede, como `http://192.168.1.50:8000`; substitua pelo IP real. `127.0.0.1` em outro dispositivo aponta para o próprio dispositivo. Permita a porta local na rede de desenvolvimento. Para uma API hospedada, use HTTPS.

No diretório do aplicativo, configure a URL antes de iniciar o Expo e reinicie-o após alterações:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://192.168.1.50:8000'
$env:EXPO_PUBLIC_DEMO_TOKEN = 'rootera-local-demo'
npm start
```

Esses comandos usam uma credencial pública de demonstração. `EXPO_PUBLIC_DEMO_TOKEN` não deve conter um segredo de produção, pois a variável é incorporada ao aplicativo distribuído.

## 2. Provisionar o dispositivo

Execute os próximos comandos em outro terminal. As rotas de cadastro e calibração usam a credencial da pessoa. Ela não precisa ser gravada no ESP32.

```powershell
$rooteraApi = 'http://127.0.0.1:8000'
$rooteraUserHeaders = @{ Authorization = 'Bearer rootera-local-demo' }
$rooteraGarden = Invoke-RestMethod -Uri "$rooteraApi/v1/garden" -Headers $rooteraUserHeaders
$rooteraPlantId = $rooteraGarden.plants[0].id
$rooteraDeviceBody = @{ plant_id = $rooteraPlantId; name = 'ESP32 - Aloe da sala' } | ConvertTo-Json
$rooteraDevice = Invoke-RestMethod -Method Post -Uri "$rooteraApi/v1/devices" -Headers $rooteraUserHeaders -ContentType 'application/json' -Body $rooteraDeviceBody
```

Contrato do pedido:

```http
POST /v1/devices
Authorization: Bearer <token-da-pessoa>
Content-Type: application/json
```

```json
{
  "plant_id": "plant-0",
  "name": "ESP32 - Aloe da sala"
}
```

A resposta `201` contém `id`, `plant_id` e `device_token`. Guarde o ID e o token no provisionamento do ESP32. O token é revelado somente nessa resposta: o banco armazena seu hash SHA-256, não o valor original. Cada dispositivo recebe sua própria credencial aleatória e é vinculado à planta do proprietário autenticado. Não registre o token em logs nem em código versionado. Se ele se perder, revogue esse dispositivo e cadastre outro; não há endpoint de recuperação ou rotação de token nesta versão.

O exemplo pressupõe uma planta existente. A conta local demo inicia com três. Para uma conta nova, crie uma planta com `POST /v1/plants` antes do provisionamento; o contrato completo está em `/docs`.

## 3. Salvar a calibração

Colete os pontos seco e molhado pelo procedimento adequado ao seu sensor e ao substrato. Os valores a seguir são exemplos de ADC, não uma calibração universal:

```powershell
$rooteraCalibrationBody = @{ dry = 3295; wet = 1422 } | ConvertTo-Json
$rooteraCalibration = Invoke-RestMethod -Method Post -Uri "$rooteraApi/v1/devices/$($rooteraDevice.id)/calibrations" -Headers $rooteraUserHeaders -ContentType 'application/json' -Body $rooteraCalibrationBody
```

```http
POST /v1/devices/<device_id>/calibrations
Authorization: Bearer <token-da-pessoa>
Content-Type: application/json
```

```json
{ "dry": 3295, "wet": 1422 }
```

A resposta contém `id`, `version`, `dry` e `wet`. Guarde `version` no dispositivo junto dos valores de calibração. Uma nova calibração cria uma nova versão; não sobrescreve a anterior. Leituras antigas continuam vinculadas à calibração usada quando foram enviadas, e o backend aceita uma versão anterior que ainda exista para esse dispositivo.

O contrato assume ADC inteiro de 12 bits, entre 0 e 4095, com `dry > wet`. Se seu firmware/hardware usa outra resolução ou se o valor aumenta com a umidade, adapte explicitamente o contrato e a normalização antes da integração. Não altere silenciosamente o significado de `raw_adc`.

A transformação aplicada no servidor é:

```text
percentual = limitar_entre_0_e_100((dry - raw_adc) / (dry - wet) * 100)
```

O resultado é arredondado a duas casas. Com `dry=3295`, `wet=1422` e `raw_adc=2021`, o resultado é `68.02`. Valores fora do intervalo entre os dois pontos de referência são limitados a 0–100%, mantendo-se o ADC bruto original. Este percentual não representa umidade do ar nem, sem validação adicional, teor volumétrico de água.

## 4. Enviar uma medição

A rota de ingestão usa exclusivamente o token daquele dispositivo:

```http
POST /v1/devices/<device_id>/readings
Authorization: Bearer <device_token>
Content-Type: application/json
```

```json
{
  "message_id": "boot-a731-reading-0042",
  "raw_adc": 2021,
  "calibration_version": 1,
  "observed_at": "2026-09-08T01:30:00Z",
  "signal_quality": 1.0
}
```

Substitua o horário do exemplo pelo horário real da coleta. `observed_at` exige fuso explícito (`Z` ou deslocamento como `-03:00`) e é convertido para UTC. Horários mais de cinco minutos no futuro são rejeitados. Medições antigas podem ser armazenadas para histórico, mas o Twin considera uma leitura antiga após seis horas e não deixa uma chegada atrasada substituir a ordem cronológica das evidências.

`signal_quality` vai de 0 a 1 e é opcional, com padrão 1. Nesta versão esse valor é informado pelo dispositivo; não há avaliação automática de qualidade de sinal no servidor. Leituras abaixo de 0,5 são salvas, porém excluídas da seleção de leitura utilizável pelo Twin. Não confunda o campo com RSSI ou com uma probabilidade de diagnóstico.

Um envio completo em PowerShell, continuando as variáveis anteriores:

```powershell
$rooteraDeviceHeaders = @{ Authorization = "Bearer $($rooteraDevice.device_token)" }
$rooteraReading = @{
  message_id = [guid]::NewGuid().ToString()
  raw_adc = 2021
  calibration_version = $rooteraCalibration.version
  observed_at = [DateTimeOffset]::UtcNow.ToString('o')
  signal_quality = 1.0
}
$rooteraReadingBody = $rooteraReading | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$rooteraApi/v1/devices/$($rooteraDevice.id)/readings" -Headers $rooteraDeviceHeaders -ContentType 'application/json' -Body $rooteraReadingBody
```

Se houver timeout ou queda de conexão, repita a última chamada com **o mesmo** `$rooteraReadingBody`. Não gere outro ID ou horário ao retransmitir a mesma coleta. Para uma coleta nova, gere um ID novo e seu horário correspondente.

A unicidade é `(device_id, message_id)`. Uma repetição idêntica devolve `duplicate: true`, sem duplicar a medição ou o evento. Reutilizar o ID com ADC, calibração, horário ou qualidade diferentes devolve `409`. A resposta de uma gravação nova inclui `id`, `duplicate: false`, `normalized_percent` e o Twin atualizado; uma resposta duplicada não inclui o Twin.

Para firmware com fila offline, preserve juntos o ID da mensagem, o horário observado, o ADC, a qualidade e a versão da calibração. Use relógio sincronizado e um ID que continue único entre reinicializações, por exemplo UUID ou identificador de inicialização mais contador persistente. O backend registra também `received_at`, separando coleta e recebimento.

## 5. Confirmar o armazenamento e revogar acesso

Estas consultas usam o token da pessoa:

```powershell
Invoke-RestMethod -Uri "$rooteraApi/v1/plants/$rooteraPlantId/sensor-observations" -Headers $rooteraUserHeaders
Invoke-RestMethod -Uri "$rooteraApi/v1/plants/$rooteraPlantId/twin" -Headers $rooteraUserHeaders
Invoke-RestMethod -Uri "$rooteraApi/v1/plants/$rooteraPlantId/events" -Headers $rooteraUserHeaders
```

O histórico inclui ADC, percentual, calibração, dispositivo, horário, qualidade e marcação `demo`. A origem medida é `SENSOR`. A API de `/user-observations` permanece independente; ela não deve receber leituras do ESP32.

Para revogar novas leituras:

```powershell
Invoke-RestMethod -Method Delete -Uri "$rooteraApi/v1/devices/$($rooteraDevice.id)" -Headers $rooteraUserHeaders
```

O histórico não é apagado. Novos envios desse dispositivo retornam `403`.

## 6. Cliente HTTP de referência

`esp32_http_example.py` usa apenas a biblioteca padrão de Python e demonstra uma única ingestão. Ele não é firmware ESP32 e não lê GPIO. Serve para validar o contrato antes de adaptar seu código existente.

Configure `ROOTERA_API_URL`, `ROOTERA_DEVICE_ID` e `ROOTERA_DEVICE_TOKEN` no ambiente do terminal. Use o token retornado no provisionamento. Execute de `outputs/rootera`:

```powershell
$env:ROOTERA_API_URL = $rooteraApi
$env:ROOTERA_DEVICE_ID = $rooteraDevice.id
$env:ROOTERA_DEVICE_TOKEN = $rooteraDevice.device_token
$rooteraMessageId = [guid]::NewGuid().ToString()
$rooteraObservedAt = [DateTimeOffset]::UtcNow.ToString('o')
python docs/esp32_http_example.py --raw-adc 2021 --calibration-version $rooteraCalibration.version --message-id $rooteraMessageId --observed-at $rooteraObservedAt
```

Mantenha essas mesmas variáveis ao repetir a chamada após falha de transporte. O exemplo não grava nem imprime credenciais.

## 7. Usar PostgreSQL externo

O driver `psycopg` já está em `requirements.txt`. Configure o banco antes de iniciar o servidor:

```powershell
$env:DATABASE_URL = 'postgresql+psycopg://rootera:<senha-codificada-na-URL>@<host>:5432/rootera?sslmode=require'
$env:ROOTERA_DEMO = 'false'
$env:ROOTERA_USER_TOKENS = '{"<token-longo-e-aleatorio-da-pessoa>":"usuario-001"}'
$env:CORS_ORIGINS = 'https://<origem-do-cliente-web>'
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Substitua os marcadores pelas credenciais reais usando a gestão de segredos do ambiente. Caracteres especiais da senha precisam estar codificados na URL. Ajuste TLS conforme o provedor do PostgreSQL. `DATABASE_URL` aceita uma URL SQLAlchemy; não copie uma URL `postgres://` sem adequá-la ao driver `postgresql+psycopg://` utilizado aqui.

O servidor cria as tabelas iniciais com `create_all`. A mudança de URL não transfere os dados do SQLite para PostgreSQL e não executa migrações. Faça migrações versionadas e uma importação revisada se quiser levar dados existentes. Consulte `/health` para verificar a conexão. Esta entrega não inclui uma instância externa contratada nem credenciais de banco.

Com demo desabilitado, o servidor exige `ROOTERA_USER_TOKENS`; o token conhecido de demonstração deixa de ser adicionado e `/v1/demo/*` fica bloqueado. Não coloque `rootera-local-demo` no mapa de tokens da implantação real. O mapa é `token -> id do proprietário`, e um perfil inicial é criado para cada proprietário configurado.

## Limites atuais de implantação

- Tokens de usuário são estáticos. É necessário integrar identidade, sessões e autorização de contas antes da distribuição pública. Google/Apple OAuth não está conectado.
- O frontend usa uma credencial demonstrativa. Ela precisa ser substituída por autenticação individual; uma variável `EXPO_PUBLIC_*` não protege segredos.
- Cobranças, recibos de lojas e RevenueCat não estão conectados. A rota de plano é somente demo e deve continuar indisponível na implantação real.
- O fluxo visual de sensores demonstra a experiência. O provisionamento real documentado aqui é por API; Bluetooth, descoberta do ESP32, transferência segura das credenciais Wi-Fi e armazenamento seguro no firmware dependem da integração com seu hardware.
- A API não fornece MQTT, streaming, OTA ou fila de telemetria no firmware. O contrato preparado é HTTP POST autenticado. A aplicação precisa de HTTPS, gestão de segredos e limites de requisição antes de exposição pública.
- Os limites de ADC/calibração, os critérios de qualidade e os pesos do Twin precisam ser validados contra o sensor, o substrato e as espécies reais. O Twin é explicável e reconstruível, mas não é um modelo preditivo treinado.

## Respostas que o firmware deve tratar

| Resposta | Significado e ação |
| --- | --- |
| `201`, `duplicate: false` | Medição salva; pode retirar a mensagem da fila local |
| `201`, `duplicate: true` | Medição já estava salva; pode retirar a mensagem da fila |
| `401` | Token de dispositivo inválido ou ID incompatível; revisar provisionamento |
| `403` | Dispositivo revogado; parar novas tentativas automáticas |
| `409` | Calibração inexistente ou ID reaproveitado com dados diferentes; corrigir o conflito |
| `422` | Payload inválido, campo extra, ADC fora do limite ou horário inválido; corrigir os dados |
| Timeout / `5xx` | Resultado pode ser incerto; retransmitir o mesmo corpo com espera progressiva |
