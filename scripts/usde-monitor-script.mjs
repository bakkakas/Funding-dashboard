import { evaluateUsdeMilestones } from '../js/usde-alerts.js';

// Build owner-managed scheduler code. No recipient IDs or delivery credentials
// belong in the public repository; routing is configured on the automation.
export function buildUsdeMonitorScript(jobId, collectorCommand, initialState) {
  return `${evaluateUsdeMilestones.toString()}
async function runMonitor() {
const jobId = ${JSON.stringify(jobId)};
const job = await automations({action: 'get', jobId});
let previous = trigger.state ?? ${JSON.stringify(initialState)};
// Reconcile the previous announcement before treating a threshold as delivered.
if (previous.pendingNotify) {
  if (job.state?.lastDelivered !== true) {
    json({notify: previous.pendingNotify, state: previous});
    return;
  }
  previous = {...previous};
  delete previous.pendingNotify;
}
// The final notice was delivered on the previous run. Remove this job without
// another price request, so no market monitoring continues after completion.
if (previous.completed) {
  await automations({action: 'remove', jobId});
  json({});
  return;
}
const response = await exec({command: ${JSON.stringify(collectorCommand)}, yieldMs: 20000});
if (response.exitCode !== undefined && response.exitCode !== 0) throw new Error('USDe collector failed: ' + String(response.aggregated ?? '').slice(0, 180));
const observation = JSON.parse(String(response.aggregated ?? '').trim());
const result = evaluateUsdeMilestones(observation, previous, Date.now());
if (result.notify) {
  if (result.state.completed) result.notify += '\\n15개 마일스톤 알림을 모두 완료했어. 추가 시총 감시는 종료돼.';
  result.state.pendingNotify = result.notify;
}
json(result);
}
await runMonitor();`;
}
