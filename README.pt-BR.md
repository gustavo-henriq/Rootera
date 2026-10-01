# Rootera

**A planta muda. O Rootera aprende o padrão.**

O Rootera é um app de cuidado de plantas que aprende **uma planta específica**: o lugar onde ela vive, o vaso e quanto tempo a terra dela leva para secar. Ele não empurra um calendário de rega. Foi feito para a RevenueCat Shipaton 2026 (Next Gen Award), com Expo (React Native + TypeScript) e um backend em FastAPI.

Teste no navegador: [rootera.byguto.com](https://rootera.byguto.com) · Vídeo: [YouTube](https://www.youtube.com/watch?v=mT3kwDD25DU)

A documentação completa está em inglês, no [README.md](README.md). O raciocínio da calibração, com as fontes, está em [docs/calibracao-shipaton.md](docs/calibracao-shipaton.md).

## Em resumo
- **Checagem em três camadas:** superfície, meio e fundo, cada uma seca, úmida ou molhada. No fundo também dá para marcar "não alcancei". Cada espécie decide na sua profundidade.
- **Janela de secagem por planta:** o app começa com uma estimativa da espécie e do vaso. A partir do 2º ciclo fica específico, e a partir do 3º usa o padrão da própria planta.
- **Clima local (Open-Meteo, sem chave):** ajusta a janela entre 0,8× e 1,25×.
- **Fontes à vista:** toda sugestão mostra de onde veio. Nenhuma porcentagem inventada.
- **Laboratório Shipaton:** 91 dias de uma planta virtual, com clima real.
- **Rootera+ pela RevenueCat:** mensal, trimestral ou anual, no entitlement `rootera`. Quem confirma a assinatura é o servidor.

## Rodar localmente
Precisa de Node 20+ e Python 3.12.

```bash
npm ci
cp .env.example .env
```

Em outro terminal, suba a API:

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Na pasta do projeto, rode `npx expo start --lan` e leia o QR code com o Expo Go (SDK 57). O celular precisa estar no mesmo Wi-Fi que o computador. Com `EXPO_PUBLIC_API_URL=metro`, o servidor do Expo encaminha a API, então o celular só precisa do endereço dele.

## Licença
[MIT](LICENSE)
