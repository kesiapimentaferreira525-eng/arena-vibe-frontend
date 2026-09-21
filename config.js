// Ajuste aqui se o backend rodar em outra porta/host ou se os caminhos do
// QuadraController forem diferentes.
const API_BASE = window.localStorage.getItem('arena_api_base') || 'http://localhost:8081';

const ENDPOINTS = {
  painel: () => '/api/painel',
  reservas: () => '/api/admin/reservas', 
  iniciar: (quadraId) => `/api/admin/quadras/${quadraId}/iniciar`,
  agendar: (quadraId) => `/api/admin/quadras/${quadraId}/reservas`,
  liberar: (quadraId) => `/api/admin/quadras/${quadraId}/liberar`,
  cancelar: (reservaId) => `/api/admin/reservas/${reservaId}/cancelar`,
  pagamento: (reservaId) => `/api/admin/reservas/${reservaId}/pagar`,
  disponibilidade: (quadraId, inicio, fim) =>
    `/api/admin/quadras/${quadraId}/disponibilidade?inicio=${inicio}&fim=${fim}`,
};

const Api = {
  async get(path) {
    const r = await fetch(`${API_BASE}${path}`);
    if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) {
      let detalhe = '';
      try { detalhe = (await r.text()).slice(0, 200); } catch (e) { /* ignora */ }
      throw new Error(`POST ${path} -> ${r.status} ${detalhe}`);
    }
    const texto = await r.text();
    return texto ? JSON.parse(texto) : null;
  },
};

function formatarTempo(segundos) {
  if (!segundos || segundos < 0) return '00:00:00';
  const hrs = Math.floor(segundos / 3600).toString().padStart(2, '0');
  const mins = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(segundos % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

// O backend usa LocalDateTime (sem fuso), entao a data chega como 2026-09-21T19:30:00.
function paraData(valor) {
  if (!valor) return null;
  if (Array.isArray(valor)) {
    const [ano, mes, dia, hora = 0, minuto = 0, segundo = 0] = valor;
    return new Date(ano, mes - 1, dia, hora, minuto, segundo);
  }
  return new Date(valor);
}

function formatarHora(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
}

function formatarDataHora(valor) {
  const d = paraData(valor);
  return d ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';
}

function formatarData(valor) {
  const d = paraData(typeof valor === 'string' && valor.length === 10 ? `${valor}T00:00:00` : valor);
  return d ? d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '--';
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
