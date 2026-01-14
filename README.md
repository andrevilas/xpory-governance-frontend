# XPORY Governance Frontend

Este repositorio contem o Dashboard Estrategico do XPORY Governance Control Plane, permitindo visualizar instancias Portainer, stacks, auditorias de versao, alertas e fluxos de atualizacao assistida.

## Tecnologias
- React + Vite
- TypeScript
- Axios
- JWT RS256 (consumido via gateway Nginx)
- Recharts / ECharts
- TanStack Query

## Funcionalidades
- Login e controle de acesso (RBAC)
- Painel geral de instancias
- Lista de stacks e auditorias
- Deteccao de drift
- Diferenca de compose para atualizacao assistida
- Historico e alertas
- Integracao com Prometheus/Grafana

## Executar localmente

```bash
npm install
npm run dev
```

## Variaveis de ambiente
- VITE_API_URL
- VITE_AUTH_PUBLIC_KEY_URL

## Compilar para producao

```bash
npm run build
```

## Autor
XPORY Governance Program
