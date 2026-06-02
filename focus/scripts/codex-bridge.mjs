#!/usr/bin/env node
/**
 * Codex bridge — exposes the Ollama-native API surface that the app's
 * lib/ollama.ts already speaks (`GET /api/tags`, `POST /api/chat`), but
 * answers each request by shelling out to the locally-installed `codex`
 * CLI (`codex exec`). This lets the StudyVerse app use your local Codex
 * (ChatGPT OAuth, no API key) as the AI engine with ZERO code changes —
 * just point EXPO_PUBLIC_OLLAMA_URL at this bridge.
 *
 * Run:  node scripts/codex-bridge.mjs
 * Then in .env:  EXPO_PUBLIC_OLLAMA_URL=http://localhost:11500
 *
 * Env overrides:
 *   CODEX_BRIDGE_PORT     (default 11500)
 *   CODEX_BRIDGE_MODEL    passed to `codex exec -m` (default: codex config)
 *   CODEX_BRIDGE_EFFORT   model_reasoning_effort: minimal|low|medium|high (default low)
 *   CODEX_BRIDGE_TIMEOUT  per-request ms (default 180000)
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.CODEX_BRIDGE_PORT ?? 11500);
const MODEL = process.env.CODEX_BRIDGE_MODEL ?? '';
const EFFORT = process.env.CODEX_BRIDGE_EFFORT ?? 'low';
const TIMEOUT = Number(process.env.CODEX_BRIDGE_TIMEOUT ?? 180000);

// Flatten an OpenAI/Ollama message array into a single prompt for codex.
function buildPrompt(messages = []) {
  const parts = [
    'You are a plain text-generation assistant serving an API request.',
    'Do NOT run shell commands, edit files, or use any tools.',
    'Respond ONLY with the answer the request asks for — no preamble, no explanation of what you are doing.',
    'If the request asks for JSON, output ONLY raw JSON with no markdown fences.',
    '',
    '=============================================',
    '',
  ];
  for (const m of messages) {
    const tag = m.role === 'system' ? 'INSTRUCTIONS' : m.role === 'assistant' ? 'ASSISTANT' : 'USER';
    parts.push(`### ${tag}\n${m.content ?? ''}\n`);
  }
  parts.push('### ASSISTANT\n(your answer below)');
  return parts.join('\n');
}

function runCodex(prompt) {
  return new Promise(async (resolve, reject) => {
    let tmpDir;
    try {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codex-bridge-'));
    } catch (e) {
      return reject(e);
    }
    const outFile = path.join(tmpDir, 'out.txt');

    const args = [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '-s', 'read-only',
      '-c', `model_reasoning_effort=${EFFORT}`,
      '-C', tmpDir,
      '-o', outFile,
    ];
    if (MODEL) args.push('-m', MODEL);

    const child = spawn('codex', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));

    const killer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`codex timed out after ${TIMEOUT}ms`));
    }, TIMEOUT);

    child.on('error', (err) => {
      clearTimeout(killer);
      reject(err);
    });

    child.on('close', async (code) => {
      clearTimeout(killer);
      try {
        const content = await readFile(outFile, 'utf8');
        await rm(tmpDir, { recursive: true, force: true });
        if (!content.trim() && code !== 0) {
          return reject(new Error(`codex exited ${code}: ${stderr.slice(-500)}`));
        }
        resolve(content.trim());
      } catch (e) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`codex produced no output (exit ${code}): ${stderr.slice(-500)}`));
      }
    });

    // Prompt via stdin → no arg-escaping issues.
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '';

  // Health check — lib/ollama.ts isOllamaRunning() hits GET /api/tags
  if (req.method === 'GET' && url.startsWith('/api/tags')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ models: [{ name: 'codex', model: 'codex' }] }));
  }

  // Chat — lib/ollama.ts ollamaChat() POSTs here, expects { message: { content } }
  if (req.method === 'POST' && url.startsWith('/api/chat')) {
    try {
      const body = JSON.parse(await readBody(req));
      const prompt = buildPrompt(body.messages);
      const started = Date.now();
      console.log(`[codex-bridge] → request (${(body.messages ?? []).length} msgs)`);
      const content = await runCodex(prompt);
      console.log(`[codex-bridge] ← done in ${Math.round((Date.now() - started) / 1000)}s (${content.length} chars)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          model: body.model ?? 'codex',
          message: { role: 'assistant', content },
          done: true,
        }),
      );
    } catch (err) {
      console.error('[codex-bridge] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[codex-bridge] listening on http://0.0.0.0:${PORT}`);
  console.log(`[codex-bridge] set EXPO_PUBLIC_OLLAMA_URL=http://localhost:${PORT} in focus/.env`);
  console.log(`[codex-bridge] model=${MODEL || '(codex default)'} effort=${EFFORT}`);
});
