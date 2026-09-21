# Arena Vibe Sports — Frontend (Telão + Painel Administrativo)

HTML5 + CSS3 + JavaScript puro, consumindo a API Spring Boot (porta 8080).

- `index.html` — telão público (atualiza a cada 1s, mostra também a próxima reserva).
- `admin.html` + `admin.js` — painel administrativo.
- `config.js` — URL do backend e caminhos dos endpoints (ajuste aqui se o `QuadraController` usar outros mapeamentos).
- `backend/` — arquivos Java para completar o backend:
  - `ReservaController.java` — expõe listar reservas, cancelar e registrar pagamento (métodos que já existem no `QuadraService`, mas não estão no `QuadraController`).
  - `PainelController.java` — só se você ainda não tiver um controller para `GET /api/painel`.
  - `CorsConfig.java` — libera o acesso do frontend ao `/api/**`.

## O que o painel administrativo mostra

| Recurso | Origem no backend |
| --- | --- |
| Quem fez a reserva (em andamento e futuras) | `QuadraResponseDTO.reservaAtual.clienteResponsavel`, `proximasReservas` |
| Cancelamento | `POST /api/admin/reservas/{id}/cancelar` + lista das reservas com `status = CANCELADA` (mostra `canceladaEm` e se o pagamento virou `ESTORNADO`) |
| Pagamento | `POST /api/admin/reservas/{id}/pagamento` + tabela com recebido / a receber por `statusPagamento` |
| Horas excedentes e taxa | `minutosExcedentes`, `taxaHoraExtra`, `valorTotal` (calculados no `QuadraService` com `app.reserva.multiplicador-hora-extra`) |
| Agendamentos futuros | reservas `AGENDADA` com início no futuro + formulário de novo agendamento |
| Datas disponíveis para locação | `GET /api/admin/quadras/{id}/disponibilidade?inicio=&fim=` (`DisponibilidadeDTO`) |

## Endpoints usados

```
GET  /api/painel                                  (ja existente / PainelController)
POST /api/admin/quadras/{id}/iniciar              { clienteResponsavel, duracaoMinutos }
POST /api/admin/quadras/{id}/reservas             { clienteResponsavel, inicioReserva, duracaoMinutos }
POST /api/admin/quadras/{id}/liberar
GET  /api/admin/quadras/{id}/disponibilidade?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
GET  /api/admin/reservas                          (novo - ReservaController)
POST /api/admin/reservas/{id}/cancelar            (novo - ReservaController)
POST /api/admin/reservas/{id}/pagamento           (novo - ReservaController)
```

`inicioReserva` é enviado como `LocalDateTime` sem fuso (`2026-09-22T19:00:00`).

Para expor o `canceladaEm` na tela de cancelamentos, inclua o campo no `ReservaResponseDTO`:

```java
private LocalDateTime canceladaEm; // + getter/setter, preenchido em converterParaReservaDTO
```

## Como rodar

1. Suba o backend Spring Boot na porta 8080.
2. Abra `index.html` e `admin.html` no navegador (ou sirva a pasta em qualquer servidor estático).
3. Backend em outra URL? No console do navegador:
   `localStorage.setItem('arena_api_base', 'http://192.168.0.10:8080')`
