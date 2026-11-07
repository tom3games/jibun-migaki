import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// jibun-migaki __NS__ を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/jibun-migaki/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__jmReady, null, { timeout: 15000 })
  // ---- 遊びの通し: 本物のタップで30日（bot の計画）→ 招待状まで ----
  const touch = !!opts.hasTouch
  const tapXY = async a => { const xy = await p.evaluate(k => jm.itemXY(k), a); if (touch) await p.touchscreen.tap(xy.x, xy.y); else await p.mouse.click(xy.x, xy.y) }
  const plan = await p.evaluate(() => D.P[0].id)
  await p.evaluate(() => jm.fast(0.02))
  if (touch) await p.tap('#bStart'); else await p.click('#bStart')
  await p.waitForFunction(() => !document.querySelector('#vPlay').hidden)
  for (let i = 0; i < 80; i++) {
    const st = await p.evaluate(() => jm.state()); if (st.done) break
    if (st.choice) { const c = await p.evaluate(([pl, ev]) => Plans.choice(pl, ev), [plan, st.choice]); await tapXY('c' + c) }
    else { const a = await p.evaluate(pl => Plans.P[pl](jm.raw()), plan); await tapXY(a) }
    await p.waitForFunction(() => !jm.busy() && (jm.state().done || !document.querySelector('#vPlay').hidden))
  }
  await p.waitForSelector('#bNext:not([hidden])', { timeout: 20000 })
  const who = await p.evaluate(() => jm.state().who), mute = await p.evaluate(() => window.__muteOk ? window.__muteOk() : null)
  out.push(`${name}: plan=${plan} who=${who} mute=${mute}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/jibun-migaki', 'https://github.com/tom3games/jibun-migaki/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
