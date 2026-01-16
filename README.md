# XPORY Governance Frontend

Este repositorio contem o Dashboard Estrategico do XPORY Governance Control Plane, permitindo visualizar instâncias Portainer, stacks, auditorias de versão, alertas e fluxos de atualização assistida.

## Tecnologias
- React + Vite
- TypeScript
- Axios
- JWT RS256 (consumido via gateway Nginx)
- Recharts / ECharts
- TanStack Query

## Funcionalidades
- Login e controle de acesso (RBAC)
- Painel geral de instâncias
- Lista de stacks e auditorias
- Deteccao de drift
- Diferenca de compose para atualização assistida
- Histórico e alertas
- Integração com Prometheus/Grafana

## Executar localmente

```bash
npm install
npm run dev
```

## Variaveis de ambiente
- VITE_API_URL
- VITE_AUTH_PUBLIC_KEY_URL

## Compilar para produção

```bash
npm run build
```

## Autor
XPORY Governance Program
