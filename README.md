# Rootera

App React Native + TypeScript com Expo, API Python/FastAPI e Plant Twin persistente. A interface v2 prioriza observações, contexto e cuidado sem sensores. Veja [o escopo da refatoração](docs/REFACTOR-V2.md).

## Rodar localmente

Requer Node compatível com Expo SDK 57 e Python 3.12+.

```powershell
# Na pasta rootera
npm ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
# Terminal 1
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Terminal 2, na pasta rootera
npm run web
```

No macOS/Linux, use `python3` e `backend/.venv/bin/python`. A API fica em http://127.0.0.1:8000 e a documentação interativa em `/docs`. A prévia web usa http://localhost:8081. Não é necessário criar uma conta para a demonstração local.

## iOS e Android

```sh
npm start
npm run android
npm run ios
```

O projeto usa componentes nativos, React Navigation, safe areas, câmera/galeria do Expo e animações com native driver. iOS simulator requer macOS/Xcode; Android emulator requer Android Studio. Para um aparelho físico, configure `EXPO_PUBLIC_API_URL=http://IP-DO-COMPUTADOR:8000` em `.env` e inicie a API com `--host 0.0.0.0` somente numa rede de desenvolvimento confiável. O valor padrão no emulador Android é `10.0.2.2:8000`; web/iOS simulator usam `127.0.0.1:8000`. O preview pelo Expo Go precisa de uma versão compatível com SDK 57; use development build quando necessário.

## O que funciona

- Onboarding conversacional antes do login: experiência e quantidade de plantas.
- Cadastro por etapas com nome, tempo com o usuário, estágio, ambiente, vaso e substrato.
- Home, Plants, Activity e Profile; detalhes com próxima ação, justificativa, aprendizagem e histórico.
- Check-ins qualitativos do solo e da aparência; registro de rega com detalhes opcionais.
- Perfil do cuidador, contexto e eventos persistidos; orientação guiada ou concisa.
- Plant Twin com camada sensorless explicável, intervalos observados entre rega e primeiro relato de solo seco, sem promessa de precisão ou prazo fixo.
- Backend de sensores preservado para uso futuro; fora do onboarding e da navegação do MVP.
- SQLite local e configuração para PostgreSQL externo. Novos jardins começam vazios; os dados existentes são preservados.

## Limites explícitos

Login Google/Apple, identificação por IA, cobrança RevenueCat, push notifications e provisionamento BLE ainda precisam dos serviços/credenciais externos. Nenhuma cobrança real é feita. A interface de sensores foi retirada do MVP; o caminho HTTP do ESP32 continua disponível na API para integração futura. Fotos não são enviadas para storage externo: o perfil mantém uma referência local, que não é portável entre aparelhos. Catálogo inicial: Aloe Vera, Peace Lily e Monstera.

O Twin v1 é um mecanismo determinístico de regras, **não um modelo treinado**. Não transforma relatos de rega em percentuais de umidade. Pesos de confiança e limiares são hipóteses iniciais documentadas; precisam de validação com dados reais. Medições demo não alteram o Twin real. Leia [a arquitetura](docs/ARCHITECTURE.md) e [a integração ESP32](docs/ESP32.md).

## Banco e segurança

Copie `backend/.env.example` para configurar o ambiente. O backend lê variáveis do processo; inicie com `uvicorn --env-file .env` apenas se instalar `python-dotenv`, ou exporte as variáveis no terminal. `DATABASE_URL=postgresql+psycopg://...` habilita PostgreSQL. O schema inicial é criado no primeiro boot; alterações futuras exigem migrations revisadas. Nenhum banco remoto foi conectado sem credenciais.

O token `rootera-local-demo` é público e serve somente ao modo de desenvolvimento. Para ambiente externo, desative `ROOTERA_DEMO`, configure credenciais individuais em `ROOTERA_USER_TOKENS`, use HTTPS e CORS restrito. A interface de identidade ainda deve ser integrada ao seu provedor OAuth/JWT antes de publicação. Não coloque tokens de produção em variáveis `EXPO_PUBLIC_*`. As credenciais de dispositivos são aleatórias, retornadas uma vez, persistidas apenas como hash e revogáveis.

## Verificação

```sh
npm run typecheck
npm run build
# Na pasta backend
python -m pytest tests -q
```

A exportação valida bundles JS para iOS, Android e web; não equivale a testar um binário nativo em aparelhos. Veja `design-qa.md` e `VALIDATION.md` para os resultados desta entrega.

## Referências técnicas

- [Expo / criação de projetos](https://docs.expo.dev/more/create-expo/)
- [SQLAlchemy / transações](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html)
- [FastAPI / segurança](https://fastapi.tiangolo.com/reference/security/)

As três imagens fornecidas e as conversas “Arquitetura do Rootera” e “Paleta e logo Rootera” orientam a interface. O logo e algumas ilustrações foram recuperados das referências; vaso e folhagem animados foram preparados como camadas separadas. Mantive o texto do produto em inglês conforme os mockups; documentação em português.
