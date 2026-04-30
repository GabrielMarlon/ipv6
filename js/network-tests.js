const $ = q => document.querySelector(q);

const setBadge = (el, kind, text) => {
  const b = el.querySelector('[data-badge]');
  b.className = 'badge ' + kind;
  b.textContent = text;
};

const setVal = (el, html, isReal) => {
  const v = el.querySelector('[data-value]');
  v.innerHTML = html;
  v.classList.toggle('has-value', !!isReal);
};

const setMeta = (el, html) => { el.querySelector('[data-meta]').innerHTML = html; };
const card = id => document.querySelector(`.test[data-id="${id}"]`);

const withTimeout = (p, ms = 8000) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
]);

async function testV4() {
  const el = card('ipv4');
  const t0 = performance.now();
  try {
    const r = await withTimeout(fetch('https://api4.ipify.org?format=json').then(r => r.json()));
    const ms = Math.round(performance.now() - t0);
    const ip = r.ip;
    let extra = '';
    try {
      const info = await withTimeout(fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json()), 5000);
      if (info && !info.error) {
        extra =
          `<div class="row"><span>ISP</span><span>${info.org || info.asn || '—'}</span></div>` +
          `<div class="row"><span>Local</span><span>${[info.city, info.country_name].filter(Boolean).join(', ') || '—'}</span></div>`;
      }
    } catch {}
    setVal(el, ip, true);
    setMeta(el, extra + `<div class="row"><span>Latência</span><span>${ms} ms</span></div>`);
    setBadge(el, 'ok', 'ok');
    return { ok: true, ip };
  } catch {
    setVal(el, 'sem conectividade IPv4', false);
    setMeta(el, '<div class="row"><span>Status</span><span>fetch falhou</span></div>');
    setBadge(el, 'fail', 'fail');
    return { ok: false };
  }
}

async function testV6() {
  const el = card('ipv6');
  const t0 = performance.now();
  try {
    const r = await withTimeout(fetch('https://api6.ipify.org?format=json').then(r => r.json()));
    const ms = Math.round(performance.now() - t0);
    const ip = r.ip;
    let extra = '';
    try {
      const info = await withTimeout(fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json()), 5000);
      if (info && !info.error) {
        extra =
          `<div class="row"><span>ISP</span><span>${info.org || info.asn || '—'}</span></div>` +
          `<div class="row"><span>Local</span><span>${[info.city, info.country_name].filter(Boolean).join(', ') || '—'}</span></div>`;
      }
    } catch {}
    setVal(el, ip, true);
    setMeta(el, extra + `<div class="row"><span>Latência</span><span>${ms} ms</span></div>`);
    setBadge(el, 'ok', 'ok');
    return { ok: true, ip };
  } catch {
    setVal(el, 'sem conectividade IPv6', false);
    setMeta(el, '<div class="row"><span>Status</span><span>seu provedor não fornece IPv6, ou está bloqueado no caminho</span></div>');
    setBadge(el, 'fail', 'unavailable');
    return { ok: false };
  }
}

async function testPreferred() {
  const el = card('preferred');
  try {
    const r = await withTimeout(fetch('https://api64.ipify.org?format=json').then(r => r.json()));
    const proto = r.ip.includes(':') ? 'IPv6' : 'IPv4';
    setVal(el, proto, true);
    setMeta(el,
      `<div class="row"><span>Resolvido para</span><span>${r.ip}</span></div>` +
      `<div class="row"><span>Significado</span><span>${proto === 'IPv6'
        ? 'seu sistema usa IPv6 quando ambos existem ✓'
        : 'seu sistema preferiu IPv4'}</span></div>`
    );
    setBadge(el, proto === 'IPv6' ? 'ok' : 'warn', proto.toLowerCase());
    return { ok: true, proto };
  } catch {
    setVal(el, '—', false);
    setBadge(el, 'fail', 'fail');
    return { ok: false };
  }
}

async function testDNS() {
  const el = card('dns');
  try {
    const res = await withTimeout(fetch('https://cloudflare-dns.com/dns-query?name=ipv6.google.com&type=AAAA', {
      headers: { 'Accept': 'application/dns-json' }
    }).then(r => r.json()));
    const aaaa = (res.Answer || []).filter(a => a.type === 28);
    const ok = aaaa.length > 0;
    setVal(el, ok ? 'AAAA resolvido' : 'sem registros AAAA', ok);
    setMeta(el,
      `<div class="row"><span>Query</span><span>ipv6.google.com (AAAA)</span></div>` +
      `<div class="row"><span>Resposta</span><span>${aaaa.map(a => a.data).join(', ') || 'nenhuma'}</span></div>` +
      `<div class="row"><span>Resolver</span><span>1.1.1.1 via DoH</span></div>`
    );
    setBadge(el, ok ? 'ok' : 'fail', ok ? 'ok' : 'no aaaa');
    return { ok };
  } catch {
    setVal(el, 'erro DoH', false);
    setBadge(el, 'fail', 'fail');
    return { ok: false };
  }
}

async function testMTU() {
  const el = card('mtu');
  try {
    const t0 = performance.now();
    await (await fetch('https://speed.cloudflare.com/__down?bytes=131072', { cache: 'no-store' })).arrayBuffer();
    const ms128 = Math.round(performance.now() - t0);

    const t1 = performance.now();
    await (await fetch('https://speed.cloudflare.com/__down?bytes=1048576', { cache: 'no-store' })).arrayBuffer();
    const ms1m = Math.round(performance.now() - t1);

    const mbps = (1024 * 8) / (ms1m / 1000) / 1000;
    const slow = ms1m > 12000;
    const verdict = slow ? 'lento — possível problema de PMTUD' : 'transferência saudável';

    setVal(el, verdict, !slow);
    setMeta(el,
      `<div class="row"><span>128 KB</span><span>${ms128} ms</span></div>` +
      `<div class="row"><span>1 MB</span><span>${ms1m} ms · ${mbps.toFixed(2)} Mbps</span></div>` +
      `<div class="row"><span>Nota</span><span>teste real de PMTUD requer ping com flag DF; isto é uma aproximação via HTTPS</span></div>`
    );
    setBadge(el, slow ? 'warn' : 'ok', slow ? 'slow' : 'ok');
    return { ok: !slow, mbps };
  } catch {
    setVal(el, 'falha no download', false);
    setMeta(el, '<div class="row"><span>Erro</span><span>endpoint inacessível</span></div>');
    setBadge(el, 'fail', 'fail');
    return { ok: false };
  }
}

function calcScore(r) {
  let s = 0;
  if (r.v4) s += 3;
  if (r.v6) s += 5;
  if (r.preferred === 'IPv6') s += 2;
  return s;
}

function buildVerdict(r) {
  const tips = [];
  let summary;

  if (r.v4 && r.v6 && r.preferred === 'IPv6') {
    summary = 'Sua conexão é dual-stack pleno e seu sistema prefere IPv6 — você está pronto para a internet moderna.';
  } else if (r.v4 && r.v6 && r.preferred === 'IPv4') {
    summary = 'Você tem IPv4 e IPv6, mas seu sistema escolhe IPv4. Pode haver degradação no caminho IPv6.';
    tips.push('Verifique se o roteador anuncia rota IPv6 corretamente (RA / DHCPv6).');
    tips.push('Teste se ipv6.google.com carrega — se sim, o problema é seletivo.');
  } else if (r.v4 && !r.v6) {
    summary = 'Você está apenas em IPv4. Seu provedor não está fornecendo IPv6, ou ele está bloqueado/desabilitado em algum ponto.';
    tips.push('Pergunte ao seu provedor se IPv6 está disponível na sua região.');
    tips.push('Verifique a configuração IPv6 no roteador — pode estar desligada por padrão.');
  } else if (!r.v4 && r.v6) {
    summary = 'Você está em IPv6-only — raro e moderno. Apps que dependem de IPv4 só funcionam via NAT64/DNS64.';
  } else {
    summary = 'Não foi possível detectar conectividade. Verifique sua rede.';
  }

  if (!r.dns) tips.push('Seu resolver DNS pode não estar retornando registros AAAA. Considere 1.1.1.1 / 2606:4700:4700::1111.');
  return { summary, tips };
}

async function runAll() {
  const btn = $('#rerun');
  btn.disabled = true;
  btn.textContent = 'Executando…';

  ['ipv4','ipv6','preferred','dns','mtu'].forEach(id => {
    const el = card(id);
    setVal(el, '<span class="skeleton">measuring</span>', false);
    setBadge(el, '', 'checking');
  });

  $('#score').innerHTML = '–<span class="denom">/10</span>';
  $('#score').className = 'score';
  $('#verdict').textContent = 'Executando diagnósticos…';
  $('#summary').textContent = 'Aguardando resultados…';
  $('#tips').hidden = true;

  const [v4, v6, pref, dns] = await Promise.all([testV4(), testV6(), testPreferred(), testDNS()]);
  const mtu = await testMTU();

  const r = { v4: v4.ok, v6: v6.ok, preferred: pref.proto, dns: dns.ok, mtu: mtu.ok };
  const score = calcScore(r);

  $('#score').innerHTML = score + '<span class="denom">/10</span>';
  $('#score').className = 'score ' + (score >= 9 ? 'good' : score >= 5 ? 'partial' : 'bad');

  const { summary, tips } = buildVerdict(r);
  $('#summary').textContent = summary;

  if (tips.length) {
    $('#tips').hidden = false;
    $('#tips ul').innerHTML = tips.map(t => `<li>${t}</li>`).join('');
  }

  $('#verdict').innerHTML = score >= 9
    ? '<strong>Excelente.</strong> Conectividade dual-stack moderna.'
    : score >= 5
    ? '<strong>Parcial.</strong> Há espaço para melhorar.'
    : '<strong>Limitado.</strong> Conectividade restrita.';

  btn.disabled = false;
  btn.textContent = 'Re-executar testes';
}

$('#rerun').addEventListener('click', runAll);
runAll();
