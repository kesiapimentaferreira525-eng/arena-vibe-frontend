let QUADRAS = [];
let RESERVAS = [];
const TEMPOS_ANTERIORES = new Map();
const ALERTAS_EMITIDOS = new Set();

function mostrarErro(msg) {
  const el = document.getElementById('erro');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function nomeQuadra(id) {
  const q = QUADRAS.find((x) => x.id === id);
  return q ? q.nome : `Quadra ${id}`;
}

function badgePagamento(status) {
  const mapa = { PAGO: 'pago', PENDENTE: 'pendente', ESTORNADO: 'cancelado' };
  return `<span class="badge ${mapa[status] || 'pendente'}">${status || 'PENDENTE'}</span>`;
}

function atualizarAlertaTempo() {
  const encerradas = QUADRAS.filter((q) =>
    q.status === 'OCUPADA' && !q.horaExtraAtiva && Number(q.segundosRestantes || 0) <= 0);
  const alerta = document.getElementById('alerta-tempo');
  alerta.hidden = !encerradas.length;
  alerta.textContent = encerradas.length
    ? `⚠️ Tempo encerrado: ${encerradas.map((q) => q.nome).join(', ')}. Encerre ou libere a quadra.`
    : '';

  QUADRAS.forEach((q) => {
    const atual = Number(q.segundosRestantes || 0);
    const anterior = TEMPOS_ANTERIORES.get(q.id);
    if (anterior > 0 && atual <= 0 && !ALERTAS_EMITIDOS.has(q.id)) {
      ALERTAS_EMITIDOS.add(q.id);
      window.alert(`⚠️ O tempo da ${q.nome} acabou.`);
    }
    if (atual > 0) ALERTAS_EMITIDOS.delete(q.id);
    TEMPOS_ANTERIORES.set(q.id, atual);
  });
}

// ---------------------------------------------------------------- quadras

function cardQuadra(q) {
  const r = q.reservaAtual;
  const extra = q.horaExtraAtiva || q.status === 'HORA_EXTRA';
  const encerrado = !extra && q.status === 'OCUPADA' && Number(q.segundosRestantes || 0) <= 0;
  const classe = extra ? 'hora-extra' : encerrado ? 'tempo-encerrado' : q.status === 'OCUPADA' ? 'ocupada' : 'livre';
  const rotulo = extra ? 'Hora extra' : encerrado ? 'Tempo encerrado' : q.status === 'OCUPADA' ? 'Em jogo' : 'Livre';
  const proximas = q.proximasReservas || [];

  const blocoProximas = proximas.length
    ? `<div class="status-info"><strong>Próximas reservas:</strong><br>${proximas.slice(0, 3)
        .map((p) => `${formatarDataHora(p.inicioReserva)} — ${p.clienteResponsavel}`).join('<br>')}</div>`
    : '';

  if (!r) {
    return `
      <div class="card livre">
        <h3>${q.nome}<span class="badge livre">Livre</span></h3>
        <div class="status-info"><strong>Valor da hora:</strong> ${formatarMoeda(q.valorHora)}</div>
        <div class="form-group"><label>Quem fez a reserva</label>
          <input type="text" id="cliente-${q.id}" placeholder="Nome do cliente responsável"></div>
        <div class="form-group"><label>Duração (minutos)</label>
          <input type="number" id="duracao-${q.id}" value="60" step="15" min="15"></div>
        <button class="btn-iniciar" onclick="iniciarReserva(${q.id})">Iniciar partida agora</button>
        ${blocoProximas}
      </div>`;
  }

  return `
    <div class="card ${classe}">
      <h3>${q.nome}<span class="badge ${classe}">${rotulo}</span></h3>
      <div class="cronometro ${extra ? 'extra' : ''}">
        ${extra ? '+ ' + formatarTempo(q.segundosUltrapassados) : encerrado ? 'TEMPO ENCERRADO' : formatarTempo(q.segundosRestantes)}
      </div>
      <div class="status-info">
        <strong>Reserva feita por:</strong> ${r.clienteResponsavel}<br>
        <strong>Início:</strong> ${formatarDataHora(r.inicioReserva)}<br>
        <strong>Término previsto:</strong> ${formatarHora(r.fimPrevistoReserva)}<br>
        <strong>Valor da locação:</strong> ${formatarMoeda(r.valorBase)}<br>
        <strong>Pagamento:</strong> ${badgePagamento(r.statusPagamento)}
      </div>
      ${r.minutosExcedentes > 0 ? `
        <div class="alerta-extra">
          Passou do horário agendado em <strong>${r.minutosExcedentes} min</strong><br>
          Taxa de hora extra: <strong>${formatarMoeda(r.taxaHoraExtra)}</strong><br>
          Total a cobrar: <strong>${formatarMoeda(r.valorTotal)}</strong>
        </div>` : ''}
      ${r.statusPagamento === 'PAGO' ? '' :
        `<button class="btn-pagar" onclick="registrarPagamento(${r.id})">Registrar pagamento (${formatarMoeda(r.valorTotal || r.valorBase)})</button>`}
      <button class="btn-liberar" onclick="liberarQuadra(${q.id})">Encerrar / liberar quadra</button>
      <button class="btn-cancelar" onclick="cancelarReserva(${r.id})">Cancelar reserva</button>
      ${blocoProximas}
    </div>`;
}

async function carregarQuadras() {
  QUADRAS = await Api.get(ENDPOINTS.painel());
  atualizarAlertaTempo();
  const container = document.getElementById('admin-container');
  const digitado = {};
  container.querySelectorAll('input').forEach((i) => { digitado[i.id] = i.value; });
  const focado = document.activeElement && document.activeElement.id;
  container.innerHTML = QUADRAS.map(cardQuadra).join('');
  container.querySelectorAll('input').forEach((i) => {
    if (digitado[i.id] !== undefined) i.value = digitado[i.id];
  });
  const alvo = focado && container.querySelector(`#${CSS.escape(focado)}`);
  if (alvo) alvo.focus();
  preencherSelectQuadras();
}

function preencherSelectQuadras() {
  ['ag-quadra', 'disp-quadra'].forEach((id) => {
    const sel = document.getElementById(id);
    const atual = sel.value;
    sel.innerHTML = QUADRAS.map((q) => `<option value="${q.id}">${q.nome}</option>`).join('');
    if (atual) sel.value = atual;
  });
}

// ---------------------------------------------------------------- ações

async function iniciarReserva(quadraId) {
  const clienteResponsavel = document.getElementById(`cliente-${quadraId}`).value.trim();
  if (!clienteResponsavel) return alert('Informe quem fez a reserva.');
  await executar(() => Api.post(ENDPOINTS.iniciar(quadraId), {
    clienteResponsavel,
    duracaoMinutos: parseInt(document.getElementById(`duracao-${quadraId}`).value, 10),
  }));
}

async function liberarQuadra(quadraId) {
  if (!confirm('Encerrar a partida e liberar a quadra?')) return;
  await executar(() => Api.post(ENDPOINTS.liberar(quadraId)));
}

async function cancelarReserva(reservaId) {
  if (!confirm('Confirmar o cancelamento desta reserva?')) return;
  await executar(() => Api.post(ENDPOINTS.cancelar(reservaId)));
}

async function registrarPagamento(reservaId) {
  if (!confirm('Confirmar o recebimento do pagamento desta reserva?')) return;
  await executar(() => Api.post(ENDPOINTS.pagamento(reservaId)));
}

async function criarAgendamento() {
  const quadraId = Number(document.getElementById('ag-quadra').value);
  const clienteResponsavel = document.getElementById('ag-cliente').value.trim();
  const inicio = document.getElementById('ag-inicio').value;
  if (!clienteResponsavel || !inicio) return alert('Informe o cliente e a data/hora de início.');
  await executar(async () => {
    await Api.post(ENDPOINTS.agendar(quadraId), {
      clienteResponsavel,
      inicioReserva: inicio.length === 16 ? `${inicio}:00` : inicio,
      duracaoMinutos: parseInt(document.getElementById('ag-duracao').value, 10),
    });
    document.getElementById('ag-cliente').value = '';
  });
}

async function executar(acao) {
  try {
    await acao();
    mostrarErro('');
  } catch (e) {
    mostrarErro(e.message);
    alert(`Não foi possível concluir a operação.\n${e.message}`);
  }
  atualizarTudo();
}

// ---------------------------------------------------------------- listas

async function carregarReservas() {
  RESERVAS = await Api.get(ENDPOINTS.reservas());
  renderFuturas();
  renderPagamentos();
  renderCancelamentos();
}

function renderFuturas() {
  const agora = new Date();
  const futuras = RESERVAS
    .filter((r) => r.status === 'AGENDADA' && paraData(r.inicioReserva) > agora)
    .sort((a, b) => paraData(a.inicioReserva) - paraData(b.inicioReserva));
  const el = document.getElementById('futuros-container');
  if (!futuras.length) { el.innerHTML = '<div class="vazio">Nenhum agendamento futuro.</div>'; return; }
  el.innerHTML = `
    <table>
      <thead><tr><th>Quadra</th><th>Quem reservou</th><th>Início</th><th>Fim previsto</th><th>Valor</th><th>Pagamento</th><th></th></tr></thead>
      <tbody>${futuras.map((r) => `
        <tr>
          <td>${r.quadraNome || nomeQuadra(r.quadraId)}</td>
          <td>${r.clienteResponsavel}</td>
          <td>${formatarDataHora(r.inicioReserva)}</td>
          <td>${formatarDataHora(r.fimPrevistoReserva)}</td>
          <td>${formatarMoeda(r.valorTotal || r.valorBase)}</td>
          <td>${badgePagamento(r.statusPagamento)}</td>
          <td class="acoes">
            ${r.statusPagamento === 'PAGO' ? '' : `<button class="btn-pagar" onclick="registrarPagamento(${r.id})">Pagar</button>`}
            <button class="btn-cancelar" onclick="cancelarReserva(${r.id})">Cancelar</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderPagamentos() {
  const pagas = RESERVAS.filter((r) => r.statusPagamento === 'PAGO');
  const pendentes = RESERVAS.filter((r) => r.statusPagamento === 'PENDENTE' && r.status !== 'CANCELADA');
  const total = pagas.reduce((s, r) => s + Number(r.valorTotal || r.valorBase || 0), 0);
  const aReceber = pendentes.reduce((s, r) => s + Number(r.valorTotal || r.valorBase || 0), 0);
  const linhas = [...pagas, ...pendentes].sort((a, b) => paraData(b.inicioReserva) - paraData(a.inicioReserva));
  const el = document.getElementById('pagamentos-container');
  if (!linhas.length) { el.innerHTML = '<div class="vazio">Nenhum pagamento registrado.</div>'; return; }
  el.innerHTML = `
    <div class="resumo">
      <div><span>Recebido</span><strong>${formatarMoeda(total)}</strong></div>
      <div><span>A receber</span><strong>${formatarMoeda(aReceber)}</strong></div>
    </div>
    <table>
      <thead><tr><th>Quadra</th><th>Cliente</th><th>Data</th><th>Locação</th><th>Hora extra</th><th>Total</th><th>Situação</th><th></th></tr></thead>
      <tbody>${linhas.map((r) => `
        <tr>
          <td>${r.quadraNome || nomeQuadra(r.quadraId)}</td>
          <td>${r.clienteResponsavel}</td>
          <td>${formatarDataHora(r.inicioReserva)}</td>
          <td>${formatarMoeda(r.valorBase)}</td>
          <td>${formatarMoeda(r.taxaHoraExtra)}${r.minutosExcedentes ? ` (${r.minutosExcedentes} min)` : ''}</td>
          <td><strong>${formatarMoeda(r.valorTotal || r.valorBase)}</strong></td>
          <td>${badgePagamento(r.statusPagamento)}</td>
          <td class="acoes">${r.statusPagamento === 'PAGO' ? '' : `<button class="btn-pagar" onclick="registrarPagamento(${r.id})">Registrar</button>`}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderCancelamentos() {
  const canceladas = RESERVAS.filter((r) => r.status === 'CANCELADA');
  const el = document.getElementById('cancelamentos-container');
  if (!canceladas.length) { el.innerHTML = '<div class="vazio">Nenhum cancelamento registrado.</div>'; return; }
  el.innerHTML = `
    <table>
      <thead><tr><th>Quadra</th><th>Quem reservou</th><th>Horário reservado</th><th>Cancelada em</th><th>Pagamento</th></tr></thead>
      <tbody>${canceladas.map((r) => `
        <tr>
          <td>${r.quadraNome || nomeQuadra(r.quadraId)}</td>
          <td>${r.clienteResponsavel}</td>
          <td>${formatarDataHora(r.inicioReserva)}</td>
          <td>${formatarDataHora(r.canceladaEm)}</td>
          <td>${badgePagamento(r.statusPagamento)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// ------------------------------------------------- datas disponíveis

async function carregarDisponibilidade() {
  const quadraId = document.getElementById('disp-quadra').value;
  const inicio = document.getElementById('disp-inicio').value;
  const fim = document.getElementById('disp-fim').value;
  if (!quadraId || !inicio || !fim) return;
  const dias = await Api.get(ENDPOINTS.disponibilidade(quadraId, inicio, fim));
  document.getElementById('datas-container').innerHTML = `
    <table>
      <thead><tr><th>Data</th><th>Situação</th><th>Reservas do dia</th><th></th></tr></thead>
      <tbody>${dias.map((d) => {
        const livre = d.disponivel !== undefined ? d.disponivel : d.livre;
        const reservasDia = d.reservas || [];
        return `
        <tr>
          <td>${formatarData(d.data)}</td>
          <td><span class="badge ${livre ? 'livre' : 'ocupada'}">${livre ? 'Dia livre' : 'Com reservas'}</span></td>
          <td>${reservasDia.length
            ? reservasDia.map((r) => `${formatarHora(r.inicioReserva)}-${formatarHora(r.fimPrevistoReserva)} ${r.clienteResponsavel}`).join('<br>')
            : 'Nenhuma reserva'}</td>
          <td class="acoes"><button class="btn-secundario" onclick="usarData('${typeof d.data === 'string' ? d.data : (d.data || []).join('-')}')">Agendar</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
}

function usarData(data) {
  const partes = data.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  document.getElementById('ag-inicio').value = `${partes[0]}-${pad(partes[1])}-${pad(partes[2])}T19:00`;
  document.getElementById('ag-quadra').value = document.getElementById('disp-quadra').value;
  document.getElementById('ag-cliente').focus();
}

// ---------------------------------------------------------------- ciclo

async function atualizarTudo() {
  try {
    await carregarQuadras();
    await carregarReservas();
    await carregarDisponibilidade();
    mostrarErro('');
  } catch (e) {
    mostrarErro(`Falha ao comunicar com o backend (${API_BASE}): ${e.message}`);
  }
}

(function iniciar() {
  const hoje = new Date();
  const em14dias = new Date(hoje.getTime() + 13 * 86400000);
  document.getElementById('disp-inicio').value = hoje.toISOString().slice(0, 10);
  document.getElementById('disp-fim').value = em14dias.toISOString().slice(0, 10);
  atualizarTudo();
  setInterval(() => carregarQuadras().catch(() => {}), 1000);
  setInterval(() => carregarReservas().catch(() => {}), 5000);
})();
