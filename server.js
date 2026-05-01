#!/usr/bin/env node
// Servidor local para teste real de PMTUD com ping + flag DF
// Uso: node server.js
// Depois abra network-tests.html no navegador

const http = require('http');
const { exec } = require('child_process');

const PORT = 3000;
const BIND = '127.0.0.1';

// Envia um único ping com DF bit e retorna se teve resposta válida
function pingDF(payloadBytes, target) {
  return new Promise(resolve => {
    const size = Math.max(8, Math.min(65507, payloadBytes | 0));
    exec(
      `ping -M do -s ${size} -c 1 -W 2 ${target}`,
      { timeout: 5000 },
      (err, stdout, stderr) => {
        const out = stdout + stderr;
        const fragNeeded = /[Ff]rag needed|[Mm]essage too long|[Pp]acket too big/.test(out);
        const hasReply = /^\d+ bytes from/m.test(stdout);
        const success = hasReply && !fragNeeded;
        const rttMatch = stdout.match(/time=(\d+\.?\d*)/);
        resolve({ success, rtt: rttMatch ? parseFloat(rttMatch[1]) : null });
      }
    );
  });
}

// Busca binária para descobrir o MTU do caminho até o alvo
async function discoverPMTU(target) {
  // payload = tamanho dos dados; MTU = payload + 20 (IPv4) + 8 (ICMP) = payload + 28
  let lo = 64, hi = 1472, bestPayload = 0, bestRtt = null;
  const steps = [];

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const { success, rtt } = await pingDF(mid, target);
    steps.push({ payload: mid, mtu: mid + 28, success, rtt });
    if (success) {
      bestPayload = mid;
      bestRtt = rtt;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    mtu: bestPayload ? bestPayload + 28 : null,
    payload: bestPayload || null,
    rtt: bestRtt,
    steps,
    target,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'GET' && req.url === '/api/pmtud') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await discoverPMTU('8.8.8.8');
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, BIND, () => {
  console.log(`PMTUD server → http://${BIND}:${PORT}`);
  console.log('Abra network-tests.html no navegador para usar o teste real de MTU.');
});
