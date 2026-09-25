# Rootera

App de cuidado de plantas que aprende **uma planta específica**: a planta, o lugar onde ela vive e o cuidado que recebe. Expo (React Native + TypeScript) no app, FastAPI + SQLAlchemy (SQLite local, PostgreSQL em produção) no backend. Feito para o RevenueCat Shipaton 2026.

- Design system "Greenhouse Glass": [design-system/rootera/MASTER.md](design-system/rootera/MASTER.md). Referência viva na prévia web com `?gallery=1`.
- Plant Twin e regras de orientação: [backend/app/guidance.py](backend/app/guidance.py) e [backend/app/species.py](backend/app/species.py).

## Rodar localmente

Requer Node 20+ e Python 3.12 (ou [uv](https://docs.astral.sh/uv/)).

```powershell
# Na pasta rootera
npm ci
cd backend
uv venv .venv --python 3.12        # ou: python -m venv .venv
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Em outro terminal, na pasta `rootera`:

```powershell
npm run web      # prévia web em http://localhost:8081
npm start        # QR code para o Expo Go
```

A API fica em http://127.0.0.1:8000 (documentação em `/docs`). O banco local é `backend/rootera.db`; os testes usam bancos temporários e nunca tocam nele.

## Testar no iPhone (Expo Go)

1. Instale o **Expo Go** na App Store (compatível com o SDK 57).
2. Descubra o IP do computador na rede Wi-Fi (`ipconfig`, campo IPv4, por exemplo `192.168.0.12`).
3. Crie `.env` na pasta `rootera` com `EXPO_PUBLIC_API_URL=http://SEU-IP:8000`.
4. Suba a API aceitando conexões da rede local (só em rede confiável):
   `.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
5. Rode `npm start` e leia o QR code com a câmera do iPhone. iPhone e computador precisam estar na mesma rede.

Se o Windows perguntar, permita o Python e o Node no firewall para redes privadas.

## Prévia web: chaves de teste

| URL | Efeito |
|---|---|
| `?gallery=1` | Galeria do design system |
| `?scheme=dark` / `?scheme=light` | Força o tema |
| `?reduceMotion=1` | Força movimento reduzido |
| `?reduceTransparency=1` | Troca todo o vidro por superfícies sólidas |

## Integrações

Nada secreto vai para o app. Veja [.env.example](.env.example) (público) e [backend/.env.example](backend/.env.example) (só servidor).

**RevenueCat (assinatura Rootera+)**
1. Crie o projeto na RevenueCat e o app na loja (Google Play é o caminho mais rápido; iOS exige conta Apple Developer).
2. Crie os produtos (ex.: `rootera_plus_monthly`, `rootera_plus_annual`), o entitlement `plus` e uma Offering padrão com os pacotes mensal e anual.
3. App: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` (chaves públicas `appl_` / `goog_`). Sem loja, a chave do **Test Store** (`EXPO_PUBLIC_REVENUECAT_TEST_KEY`) funciona no Expo Go e na web.
4. Servidor: `REVENUECAT_SECRET_KEY` (secreta, `sk_`). O backend confirma a assinatura na RevenueCat (`POST /v1/billing/sync`); o app nunca decide sozinho quem é Plus. Webhook opcional em `/v1/billing/webhook` com `REVENUECAT_WEBHOOK_AUTH`.

Sem chave, o paywall roda em **modo prévia**, claramente identificado, e a ativação não cobra nada.

**Pl@ntNet (identificação por foto)**: `PLANTNET_API_KEY` no servidor ativa `POST /v1/identify`. Os resultados aparecem como "possible match" e só viram espécie depois que a pessoa confirma. Sem chave, a foto continua sendo a imagem da planta e a espécie é escolhida manualmente.

## Testes

```powershell
npm run typecheck
npm run test:model
cd backend; .venv/Scripts/python.exe -m pytest -q
```

## O que ainda é demonstração

- Acesso sem conta (token de prévia). Contas reais substituem `EXPO_PUBLIC_DEMO_TOKEN`.
- Notificações: preferências são salvas (tipos, tom e horário), mas a entrega push ainda não está conectada; os avisos aparecem dentro do app.
- Clima e sensores de solo não estão conectados e aparecem como "Not connected" na tela da planta.
- Fotos ficam no aparelho (não há armazenamento remoto).
