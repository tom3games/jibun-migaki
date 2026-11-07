import './mute-auto.mjs'
// 画面を撮る。node shot.mjs [幅] [高さ] [名前]
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname; mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5471, W = +process.argv[2] || 390, H = +process.argv[3] || 844, N = process.argv[4] || 'p'
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__jmReady); await p.waitForTimeout(600)
await p.screenshot({ path: `${ROOT}/shots/${N}-title.png` })
await p.evaluate(() => { jm.setSeed(1234); jm.fast(0.05) })
await p.tap('#bStart'); await p.waitForTimeout(300); await p.screenshot({ path: `${ROOT}/shots/${N}-play0.png` })
const plan = process.argv[5] || 'takane'
for (let i = 0; i < 60; i++) {
  const st = await p.evaluate(() => jm.state()); if (st.done) break; if (st.day === 30) await p.evaluate(() => jm.fast(1))
  if (st.choice) { const xy = await p.evaluate(c => jm.itemXY(c), 'c' + await p.evaluate(([pl, c]) => Plans.choice(pl, c), [plan, st.choice])); await p.mouse.click(xy.x, xy.y) }
  else { const a = await p.evaluate(pl => Plans.P[pl](jm.raw()), plan); const xy = await p.evaluate(a => jm.itemXY(a), a); await p.mouse.click(xy.x, xy.y) }
  await p.waitForFunction(() => !jm.busy(), null, { timeout: 20000 }); await p.waitForTimeout(30)
  if (i === 12) await p.screenshot({ path: `${ROOT}/shots/${N}-play12.png` })
}
await p.waitForTimeout(800); await p.screenshot({ path: `${ROOT}/shots/${N}-reveal.png` })
await p.waitForSelector('#bNext:not([hidden])'); await p.screenshot({ path: `${ROOT}/shots/${N}-reveal2.png` })
await p.tap('#bNext'); await p.waitForFunction(() => window.__jmCardDone); await p.waitForTimeout(300); await p.screenshot({ path: `${ROOT}/shots/${N}-end.png` })
await p.tap('#bBook2'); await p.waitForTimeout(300); await p.screenshot({ path: `${ROOT}/shots/${N}-book.png` })
console.log(JSON.stringify(await p.evaluate(() => jm.state())), errs, await p.evaluate(() => window.__muteOk && window.__muteOk()))
await b.close(); server.kill()
