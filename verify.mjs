import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 自分磨き30日の検証。node verify.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5473
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, keep) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  if (!keep) await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__jmReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *, .ovl:not([hidden]) *')) {
    if (el.closest('[hidden]') || el.classList.contains('float') || el.closest('#door') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
// 一画面に収まる: ボタン・ラベル・カードが画面の中
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button, main:not([hidden]) .lab, main:not([hidden]) canvas, .ovl:not([hidden]) button, .ovl:not([hidden]) .cell, #tmSupport, #stage, #epi')) {
    if (!el.offsetParent && el.id !== 'tmSupport') continue; if (el.closest('[hidden]')) continue
    const r = el.getBoundingClientRect(); if (!r.height) continue
    if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className || el.textContent.slice(0, 6)) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  return { H, over: over.slice(0, 6) }
})
const tapXY = async (p, a, touch) => { const xy = await p.evaluate(a => jm.itemXY(a), a); if (touch) await p.touchscreen.tap(xy.x, xy.y); else await p.mouse.click(xy.x, xy.y); return xy }
// bot の計画どおりに、本物のタップで30日を進める
async function playPlan(p, plan, { seed, touch, shots, cont } = {}) {
  if (seed == null) seed = await p.evaluate(pl => { for (let s = 1000; s < 3000; s++) { const S = Sim.create(D, s); if (pl === 'cat' ? S.threads.cat && !S.threads.granny : pl === 'granny' ? S.threads.granny && !S.threads.cat : !S.threads.cat && !S.threads.granny) return s } }, plan)
  await p.evaluate(s => { jm.setSeed(s); jm.fast(0.02) }, seed)
  const b = await p.$('#bStart:visible') ? '#bStart' : '#bAgain'
  if (!cont) { if (touch) await p.tap(b); else await p.click(b) }
  await p.waitForFunction(() => !document.querySelector('#vPlay').hidden)
  let taps = 0
  for (let i = 0; i < 80; i++) {
    const st = await p.evaluate(() => jm.state()); if (st.done) break
    if (st.choice) { const c = await p.evaluate(([pl, ev]) => Plans.choice(pl, ev), [plan, st.choice]); await tapXY(p, 'c' + c, touch) }
    else { const a = await p.evaluate(pl => Plans.P[pl](jm.raw()), plan); await tapXY(p, a, touch) }
    taps++
    await p.waitForFunction(() => !jm.busy() && (jm.state().done || !document.querySelector('#vPlay').hidden))
    if (shots && i === shots.at) await p.screenshot({ path: shots.path })
  }
  await p.waitForSelector('#bNext:not([hidden])', { timeout: 20000 })
  return { seed, taps, who: await p.evaluate(() => jm.state().who) }
}

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('画面に「AI」「画像生成」の字が無い（全文言・日英）', async () => {
  const r = await p.evaluate(() => { const all = JSON.stringify(D) + document.body.innerText; return [/画像生成/.test(all), /\bAI\b/.test(all)] })
  expect(!r[0] && !r[1], JSON.stringify(r))
})

// ---- 17人全員に、本物のタップでたどり着く
const plans = await p.evaluate(() => D.P.map(x => x.id))
const reach = {}
for (const plan of plans) {
  await t(`恋人「${plan}」に bot の遊び方で届く（実タップ）`, async () => {
    const r = await playPlan(p, plan, { shots: plan === 'takane' ? { at: 10, path: ROOT + '/shots/v-play10.png' } : null })
    reach[plan] = r.who
    expect(r.who === plan, JSON.stringify(r))
    await p.screenshot({ path: `${ROOT}/shots/v-reveal-${plan}.png` })
    await p.click('#bNext'); await p.waitForFunction(() => window.__jmCardDone)
    return { seed: r.seed, taps: r.taps }
  })
}
await t('図鑑が17人で埋まる', async () => { const n = await p.evaluate(() => jm.book().length); expect(n === 17, n); return n })
await t('ずっと寝ると一番下（抱き枕・tier 0）', async () => {
  const tiers = await p.evaluate(() => Object.fromEntries(D.P.map(x => [x.id, x.tier])))
  const min = Math.min(...Object.values(tiers)); expect(tiers.pillow === min && Object.values(tiers).filter(v => v === min).length === 1, JSON.stringify(tiers))
})
await t('結果の招待状が描けている（輝度の散らばり）', async () => {
  const v = await p.evaluate(() => { const c = document.querySelector('#card'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) })
  expect(v > 100, v); return v
})
await t('Xでポスト: 本文に恋人と称号・URL', async () => {
  await p.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u) } })
  await p.click('#bPost'); const u = await p.evaluate(() => window.__opened[0])
  expect(/x\.com\/intent\/post/.test(u) && /jibun-migaki/.test(decodeURIComponent(u)) && /%E7%A7%B0%E5%8F%B7/.test(u), u)
})
await t('画像を保存: png が落ちてくる', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bSave')]); expect(/\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename())
})
await t('支援リンク（プロテイン）が結果画面にある', async () => { const s = await p.textContent('#tmSupport'); expect(/プロテイン/.test(s), s) })
await t('音: 行動ごとに録音を鳴らす呼び出しがある・実際は無音', async () => {
  const r = await p.evaluate(() => ({ c: window.__sfxCalls, ok: window.__muteOk() }))
  expect(r.ok && r.c.gym > 0 && r.c.drum > 0 && r.c.tear > 0 && r.c.win > 0 && r.c.lose > 0, JSON.stringify(r)); return r.c
})
await p.close()

// ---- 仕組みの境界
const q = await open(browser)
await t('お金が足りないと押しても日が減らない', async () => {
  await q.evaluate(() => { jm.setSeed(77); jm.fast(0.02) }); await q.click('#bStart')
  await q.evaluate(() => { jm.raw().money = 500 })
  const d0 = await q.evaluate(() => jm.state().day); await tapXY(q, 'clothes'); await q.waitForTimeout(100)
  const r = await q.evaluate(() => ({ day: jm.state().day, b: document.querySelector('#bubble').textContent }))
  expect(r.day === d0 && /足りない/.test(r.b), JSON.stringify(r))
})
await t('筋トレ3日連続で病院（2日とぶ）', async () => {
  await q.evaluate(() => { const S = jm.raw(); S.money = 20000; S.hp = 100; S.events = []; S.forced = 0 })
  const d0 = await q.evaluate(() => jm.state().day)
  for (let i = 0; i < 3; i++) { await tapXY(q, 'gym'); await q.waitForFunction(() => !jm.busy()) }
  const r = await q.evaluate(() => ({ day: jm.state().day, inj: jm.state().injuries, b: document.querySelector('#bubble').textContent }))
  expect(r.inj === 1 && r.day === d0 + 5 && /病院/.test(r.b), JSON.stringify(r)); return r
})
await t('2日続けると「腕がプルプル」の予告が出る', async () => {
  await q.evaluate(() => { const S = jm.raw(); S.hp = 100; S.streak = 0 })
  await tapXY(q, 'gym'); await q.waitForFunction(() => !jm.busy()); await tapXY(q, 'gym'); await q.waitForFunction(() => !jm.busy())
  const b = await q.textContent('#bubble'); expect(/プルプル/.test(b), b)
})
await t('毎回違う: 種が違うとおすすめ・できごとが違う', async () => {
  const r = await q.evaluate(() => { const a = Sim.create(D, 11), b = Sim.create(D, 12); return [a.deals.join() !== b.deals.join(), a.events.join() !== b.events.join()] })
  expect(r[0] && r[1], r)
})
await t('同じ種・同じ操作なら同じ結果（運でなく選び方で決まる）', async () => {
  const r = await q.evaluate(() => { const run = s => { const S = Sim.create(D, s); while (!S.done) { if (S.choice) { Sim.choose(D, S, 1); continue } const o = Sim.act(D, S, Plans.P.futsuu(S)); if (!o.ok) Sim.act(D, S, 'sleep') } return Sim.judge(D, S) + S.int + S.str + S.look }; return [run(5), run(5)] })
  expect(r[0] === r[1], r)
})
await t('遊びの画面で同時に出る文字は2つまで（吹き出し・案内）', async () => {
  const n = await q.evaluate(() => ['#bubble', '#tip', '#memo'].filter(s => { const e = document.querySelector(s); return e && !e.hidden && e.textContent.trim() }).length)
  expect(n <= 2, n); return n
})
await q.close()

// ---- 英語
const e = await open(browser)
await t('英語に切り替えると日本語が消える（タイトル・部屋）', async () => {
  await e.click('#bLang'); await e.evaluate(() => { jm.setSeed(3); jm.fast(0.02) }); await e.click('#bStart')
  const t1 = await e.evaluate(() => document.querySelector('#vPlay').innerText)
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(t1), t1.slice(0, 80))
  await e.screenshot({ path: ROOT + '/shots/v-en-play.png' })
})
await t('英語で最後まで遊べて招待状も英語', async () => {
  await e.evaluate(() => jm.fast(0.02))
  for (let i = 0; i < 40; i++) { const st = await e.evaluate(() => jm.state()); if (st.done) break; if (st.choice) await tapXY(e, 'c1'); else await tapXY(e, st.hp < 30 ? 'sleep' : ['gym', 'study', 'job'][i % 3]); await e.waitForFunction(() => !jm.busy()) }
  await e.waitForSelector('#bNext:not([hidden])'); const rv = await e.evaluate(() => document.querySelector('#vReveal').innerText)
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(rv), rv)
  await e.click('#bNext'); await e.waitForFunction(() => window.__jmCardDone); await e.screenshot({ path: ROOT + '/shots/v-en-end.png' })
  expect(e.errs.length === 0, e.errs.join('|'))
})
await e.close()

// ---- 3サイズ × 全画面で一画面に収まる
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const s = await open(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const views = {}
  views.title = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await s.tap('#bHow'); views.how = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await s.tap('#howClose')
  await s.tap('#bBook'); views.book0 = await fit(s); await s.tap('#bookClose')
  await s.evaluate(() => { jm.setSeed(1); jm.fast(0.02) }); await s.tap('#bStart'); await s.waitForTimeout(150)
  views.play = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  // できごとの2択
  await s.evaluate(() => { const S = jm.raw(); S.events[S.day] = 'cat' }); await tapXY(s, 'sleep', true); await s.waitForSelector('#memo:not([hidden])')
  views.memo = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-memo.png` }); await tapXY(s, 'c0', true); await s.waitForFunction(() => !jm.busy())
  const r = await playPlan(s, 'imo', { touch: true, seed: 5, cont: true })
  await s.waitForTimeout(400); views.reveal = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-reveal.png` })
  await s.tap('#bNext'); await s.waitForFunction(() => window.__jmCardDone); await s.waitForTimeout(300)
  views.end = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  await s.tap('#bBook2'); views.book = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-book.png` })
  for (const [v, rr] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!rr.over.length, JSON.stringify(rr)) })
  await t(`${name}: はみ出し・エラーなし（${r.who}）`, async () => { const o = await overflow(s); expect(o.sw <= o.W && !o.bad.length && !s.errs.length, JSON.stringify(o) + s.errs.join('|')) })
  await t(`${name}: 部屋の9つの物が全部画面内で押せる大きさ`, async () => {
    await s.tap('#bookClose'); await s.tap('#bAgain'); await s.waitForTimeout(150)
    const r2 = await s.evaluate(() => Object.keys(D.ACT).map(a => { const x = jm.itemXY(a); return [a, Math.round(x.w), Math.round(x.h), x.y < innerHeight && x.y > 0] }))
    expect(r2.every(([, w, h, inn]) => w >= 44 && h >= 44 && inn), JSON.stringify(r2))
  })
  await s.close()
}
await browser.close()

// ---- WebKit（iPhone 相当）で指のタップの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップだけで30日→恋人（ずっと寝る→抱き枕）', async () => {
  const r = await playPlan(wp, 'pillow', { touch: true }); expect(r.who === 'pillow', JSON.stringify(r))
  await wp.screenshot({ path: ROOT + '/shots/v-webkit-reveal.png' })
  await wp.tap('#bNext'); await wp.waitForFunction(() => window.__jmCardDone); await wp.screenshot({ path: ROOT + '/shots/v-webkit-end.png' })
  return r
})
await t('WebKit: タップだけで「高嶺の花」', async () => { const r = await playPlan(wp, 'takane', { touch: true }); expect(r.who === 'takane', JSON.stringify(r)) })
await t('WebKit: 実際には無音（始めた後・音を鳴らした後）', async () => {
  const r = await wp.evaluate(() => ({ ok: window.__muteOk(), calls: Object.keys(window.__sfxCalls).length }))
  expect(r.ok && r.calls > 3, JSON.stringify(r)); return r
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
