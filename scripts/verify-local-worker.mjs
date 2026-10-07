// Bounded, isolated end-to-end check. No cloud credentials or treasury access.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { CodingHarness } from '../dist/agent/harnesses/coding-harness.js';
import { createInferenceClient } from '../dist/conway/inference.js';
import { createConwayClient } from '../dist/conway/client.js';
import { parseContentToolCall } from '../dist/inference/router.js';
import { AgentWorkspace } from '../dist/orchestration/workspace.js';

const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.automaton/automaton.json'), 'utf8').replace(/^\uFEFF/, ''));
if (config.runtimeMode !== 'local' || config.localIsolation !== 'vm') throw new Error('This check requires local VM mode');
const id = `verify-${Date.now()}`;
const root = `${config.localVm.workspaceRoot}/${id}`;
const conway = createConwayClient({ apiUrl: '', apiKey: '', sandboxId: '', localIsolation: 'vm', localVm: { ...config.localVm, workspaceRoot: root } });
const inference = createInferenceClient({ apiUrl: '', apiKey: '', defaultModel: config.inferenceModel, maxTokens: 1024, ollamaBaseUrl: 'http://localhost:11434', getModelProvider: () => 'ollama' });
const model = process.env.LOCAL_VERIFY_MODEL || config.localWorkerModel || config.inferenceModel;
const db = new Database(':memory:');
const harness = new CodingHarness();
const task = { id, goalId: id, title: 'Create and test a quote calculator', description: `In ${root}, create quote.mjs exporting quote(hours, rate) that returns hours * rate. Create quote.test.mjs using node:assert/strict to verify quote(2,25) is 50 and quote(0,25) is 0. Run node quote.test.mjs using exec. Call task_done only after the test passes. Use relative filenames. No dependencies.`, status: 'assigned', agentRole: 'developer', dependencies: [], metadata: { timeoutMs: 600000 } };
const context = { workspaceRoot: root, allowedEditRoot: root, workspace: new AgentWorkspace(id), identity: {}, config, db, conway, inference: { chat: async (params) => {
  const response = await inference.chat(params.messages, { model: params.tier === 'cheap' ? config.inferenceModel : model, tools: params.tools, maxTokens: 1024, signal: params.signal, temperature: 0 });
  return { content: response.message.content, toolCalls: response.toolCalls?.length ? response.toolCalls : parseContentToolCall(response.message.content || '', params.tools) };
}}, budget: { maxTurns: 10, maxCostCents: 1, timeoutMs: 600000, turnsUsed: 0, costUsedCents: 0, startedAt: 0 }, wisdom: { conventions: [], successes: [], failures: [], gotchas: [] }, abortSignal: new AbortController().signal, goalId: id };
try {
  console.log(`Testing ${model} in ${root}`);
  await harness.initialize(task, context);
  const result = await harness.execute();
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
  else {
    const verified = await conway.exec('node quote.test.mjs', 10000);
    console.log('Independent verification:', JSON.stringify(verified));
    if (verified.exitCode !== 0) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }


