// 遊び方ごとの分布。node sim.mjs  （ブラウザを開かない）
import { createRequire } from 'node:module'
globalThis.window = globalThis
const require = createRequire(import.meta.url)
await import('./data.js')
const Sim = require('./sim.js'), { P, choice } = require('./plans.js')
const D = globalThis.D
export function run(plan, seed, pick) {
  const S = Sim.create(D, seed)
  let guard = 0
  while (!S.done && guard++ < 200) {
    if (S.choice) { Sim.choose(D, S, choice(plan, S.choice)); continue }
    let a = pick ? pick(S) : P[plan](S)
    let o = Sim.act(D, S, a)
    if (!o.ok) o = Sim.act(D, S, 'sleep')
  }
  return { S, who: Sim.judge(D, S) }
}
// 猫・おばあちゃんは、その回にその客が来る種を選ぶ
export function seedFor(plan, base) {
  for (let s = base; s < base + 500; s++) { const S = Sim.create(D, s); if (plan === 'cat' && S.threads.cat && !S.threads.granny) return s; if (plan === 'granny' && S.threads.granny && !S.threads.cat) return s; if (plan !== 'cat' && plan !== 'granny' && !S.threads.cat && !S.threads.granny) return s }
  return base
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const out = {}
  for (const plan of Object.keys(P)) {
    const c = {}
    for (let i = 0; i < 12; i++) { const { who } = run(plan, seedFor(plan, 1000 + i * 37)); c[who] = (c[who] || 0) + 1 }
    out[plan] = c
    console.log(plan.padEnd(8), (c[plan] || 0) + '/12', JSON.stringify(c))
  }
  // 適当に押す人（ランダム）と、ほぼ寝る人
  const rnd = {}, keys = Object.keys(D.ACT)
  for (let i = 0; i < 300; i++) { let r = i * 7 + 1; const pick = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return keys[r % keys.length] }; const { who } = run('x', 5000 + i, pick); rnd[who] = (rnd[who] || 0) + 1 }
  console.log('random  ', JSON.stringify(rnd))
  const any = {}; for (let i = 0; i < 300; i++) { const { who } = run('x', 9000 + i, S => P.takane(S)); any[who] = (any[who] || 0) + 1 }
  console.log('takane(any seed)', JSON.stringify(any))
}
