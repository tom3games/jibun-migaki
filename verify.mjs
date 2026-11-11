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
  for (const el of document.querySelectorAll('main:not([hidden]) *, .ovl:not([hidden]) *, #chat:not([hidden]) *')) {
    if (el.closest('[hidden]') || el.classList.contains('float') || el.closest('#door') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
// 一画面に収まる: ボタン・ラベル・カードが画面の中
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button, main:not([hidden]) .lab, main:not([hidden]) canvas, .ovl:not([hidden]) button, .ovl:not([hidden]) .cell, #tmSupport, #stage, #epi, #chat:not([hidden]) button, #chat:not([hidden]) .chFoot, #affBox:not([hidden]) a, #affBox:not([hidden]) small')) {
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
  const r = await p.evaluate(() => { const all = JSON.stringify(D) + JSON.stringify(CHATS) + document.body.innerText; return [/画像生成/.test(all), /\bAI\b/.test(all)] })
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
// ---- 図鑑のトーク: 17人全員を本物のタップで開いて、8件以上・戻る
const AFF = await p.evaluate(() => window.AFF_URL)
await t('結果画面に PR ボタン（PR の字・注記・rel=sponsored・新しいタブ・指定のURL）', async () => {
  const r = await p.evaluate(() => { const a = document.querySelector('#bAff'), b = document.querySelector('#affBox'), cs = getComputedStyle(a.querySelector('.pr')), ct = getComputedStyle(a.querySelector('#affTxt')); const rr = a.getBoundingClientRect(); return { vis: !b.hidden && rr.height > 0 && rr.bottom <= innerHeight, href: a.href, rel: a.rel, target: a.target, pr: a.querySelector('.pr').textContent, prSize: parseFloat(cs.fontSize), txtSize: parseFloat(ct.fontSize), txt: a.textContent, note: document.querySelector('#affNote').textContent } })
  expect(r.vis && r.href === AFF && /sponsored/.test(r.rel) && /noopener/.test(r.rel) && r.target === '_blank' && r.pr === 'PR' && r.prSize >= 12 && r.prSize >= r.txtSize - 2 && /占ってみる/.test(r.txt) && /17歳以上/.test(r.note) && !/当たる|必ず|今だけ/.test(r.txt + r.note), JSON.stringify(r))
  await p.waitForTimeout(700); await p.screenshot({ path: ROOT + '/shots/v-end-pr.png' })
  return { href: r.href.slice(0, 40) + '...', prSize: r.prSize, txtSize: r.txtSize }
})
await t('PR ボタンを押すと aff_click を記録（遷移は止めて確かめる）', async () => {
  await p.evaluate(() => document.querySelector('#bAff').addEventListener('click', e => e.preventDefault(), { once: true }))
  const xy = await p.evaluate(() => { const r = document.querySelector('#bAff').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await p.mouse.click(xy.x, xy.y)
  const n = await p.evaluate(() => window.__tmLog.filter(e => e.name === 'aff_click').length); expect(n === 1, n)
})
await p.click('#bBook2'); await p.waitForSelector('#book:not([hidden])')
const chatShots = ['imo', 'pillow', 'robot', 'granny']
for (const id of plans) {
  await t(`トーク「${id}」: タップで開く・8件以上・戻る`, async () => {
    const xy = await p.evaluate(i => jm.cellXY(i), id); await p.mouse.click(xy.x, xy.y)
    await p.waitForSelector('#chat:not([hidden])'); await p.waitForFunction(() => window.__chatDone, null, { timeout: 15000 })
    const r = await p.evaluate(() => ({ n: document.querySelectorAll('#chLog .m').length, y: document.querySelectorAll('#chLog .m.y').length, p: document.querySelectorAll('#chLog .m.p').length, read: document.querySelectorAll('#chLog .m.y .meta').length, img: [...document.querySelectorAll('#chLog img')].every(i => i.complete && i.naturalWidth > 0), aff: !!document.querySelector('#chat a[rel*=sponsored]'), name: document.querySelector('#chName').textContent }))
    if (chatShots.includes(id)) { await p.waitForTimeout(400); await p.evaluate(() => { document.querySelector('#chLog').scrollTop = 0 }); await p.screenshot({ path: `${ROOT}/shots/v-chat-${id}.png` }); await p.evaluate(() => { const l = document.querySelector('#chLog'); l.scrollTop = l.scrollHeight }); await p.screenshot({ path: `${ROOT}/shots/v-chat-${id}-end.png` }) }
    expect(r.n >= 8 && r.y >= 1 && r.p >= 1 && r.read === r.y && r.img && !r.aff, JSON.stringify(r))
    const b = await p.evaluate(() => { const r = document.querySelector('#chBack').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }); await p.mouse.click(b.x, b.y)
    const back = await p.evaluate(() => document.querySelector('#chat').hidden && !document.querySelector('#book').hidden); expect(back, 'back failed')
    return r.n
  })
}
await t('トークの中だけスクロールし、ページはスクロールしない', async () => {
  const xy = await p.evaluate(() => jm.cellXY('granny')); await p.mouse.click(xy.x, xy.y); await p.waitForFunction(() => window.__chatDone)
  const r = await p.evaluate(() => { const l = document.querySelector('#chLog'); return { page: document.documentElement.scrollHeight <= innerHeight, ov: getComputedStyle(l).overflowY } })
  await p.click('#chBack'); expect(r.page && r.ov === 'auto', JSON.stringify(r))
})
await p.click('#bookClose')
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

// ---- AFF_URL が空なら PR は何も出さない（config.js を空に差し替え）
{
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
  await ctx.route('**/config.js*', r => r.fulfill({ contentType: 'text/javascript', body: "window.AFF_URL = ''" }))
  const z = await ctx.newPage(); z.errs = []; z.on('pageerror', e => z.errs.push(e.message))
  await z.goto(URL0); await z.waitForFunction(() => window.__jmReady)
  await t('AFF_URL が空: 結果画面に PR ボタンも注記も出ない', async () => {
    await playPlan(z, 'pillow'); await z.click('#bNext'); await z.waitForFunction(() => window.__jmCardDone)
    const r = await z.evaluate(() => ({ hidden: document.querySelector('#affBox').hidden, href: document.querySelector('#bAff').getAttribute('href'), vis: [...document.querySelectorAll('a[rel*=sponsored]')].filter(a => a.getBoundingClientRect().height > 0).length, text: document.body.innerText.includes('17歳以上') }))
    expect(r.hidden && !r.href && r.vis === 0 && !r.text && !z.errs.length, JSON.stringify(r) + z.errs.join('|'))
  })
  await t('AFF_URL を入れると出る（ページ内で差し込み）', async () => {
    const r = await z.evaluate(() => { window.AFF_URL = 'https://example.com/x'; jm.aff(); const a = document.querySelector('#bAff'); return { vis: !document.querySelector('#affBox').hidden, href: a.href, rel: a.rel } })
    expect(r.vis && r.href === 'https://example.com/x' && /sponsored/.test(r.rel), JSON.stringify(r))
  })
  await ctx.close()
}
await t('PR はタイトル・遊び・図鑑・トークには出ない', async () => {
  const z = await open(browser)
  const vis = () => z.evaluate(() => [...document.querySelectorAll('a[rel*=sponsored], #affBox')].filter(a => a.checkVisibility()).length)
  const r = [await vis()]; await z.click('#bBook'); r.push(await vis()); await z.click('#bookClose')
  await z.evaluate(() => { jm.setSeed(2); jm.fast(0.02) }); await z.click('#bStart'); r.push(await vis())
  await z.close(); expect(r.every(v => v === 0), JSON.stringify(r))
})

// ---- 値の上限150・鏡の自分
await t('知力・筋力・見た目は150まで伸びて止まる', async () => {
  const z = await open(browser)
  await z.evaluate(() => { jm.setSeed(9); jm.fast(0.02) }); await z.click('#bStart')
  await z.evaluate(() => { const S = jm.raw(); S.int = 140; S.hp = 100; S.events = []; S.deals = S.deals.map(() => -1) })
  await tapXY(z, 'study'); await z.waitForFunction(() => !jm.busy())
  const a = await z.evaluate(() => ({ int: jm.state().int, tag: document.querySelector('#gInt').textContent }))
  await z.evaluate(() => { const S = jm.raw(); S.int = 150; S.hp = 100 }); await tapXY(z, 'study'); await z.waitForFunction(() => !jm.busy())
  const b = await z.evaluate(() => jm.state().int)
  const c = await z.evaluate(() => { const M = {}; for (const pl of Object.keys(Plans.P)) for (let i = 0; i < 4; i++) { const S = Sim.create(D, 300 + i); while (!S.done) { if (S.choice) { Sim.choose(D, S, Plans.choice(pl, S.choice)); continue } if (!Sim.act(D, S, Plans.P[pl](S)).ok) Sim.act(D, S, 'sleep') } for (const k of ['int', 'str', 'look']) M[k] = Math.max(M[k] || 0, S[k]) } return M })
  await z.close()
  expect(a.int === 150 && /150/.test(a.tag) && b === 150 && c.int === 150 && c.str <= 150 && c.look <= 150 && c.int > 100, JSON.stringify({ a, b, c })); return c
})
await t('鏡の自分16通りが、どれも bot の遊び方で出る', async () => {
  const p0 = await open(browser); const r = await p0.evaluate(() => { const seen = {}; for (const pl of Object.keys(Plans.P)) for (let i = 0; i < 6; i++) { const S = Sim.create(D, 1000 + i * 37); while (!S.done) { if (S.choice) { Sim.choose(D, S, Plans.choice(pl, S.choice)); continue } if (!Sim.act(D, S, Plans.P[pl](S)).ok) Sim.act(D, S, 'sleep'); const m = Sim.mirror(D, S); seen[m] = seen[m] || pl } } return { miss: Sim.MIRRORS.filter(m => !seen[m]), n: Sim.MIRRORS.length, seen } })
  await p0.close(); expect(r.n === 16 && !r.miss.length, JSON.stringify(r)); return r.seen
})
await t('鏡の自分が本物のタップの遊びで変わっていく（勉強ばかり→メガネ→分厚い→博士）', async () => {
  const z = await open(browser)
  await z.evaluate(() => { jm.setSeed(1001); jm.fast(0.02) }); await z.click('#bStart')
  const seq = []
  for (let i = 0; i < 40; i++) {
    const st = await z.evaluate(() => jm.state()); if (st.done) break
    if (st.choice) await tapXY(z, 'c1'); else await tapXY(z, await z.evaluate(() => Plans.P.robot(jm.raw())))
    await z.waitForFunction(() => !jm.busy() && (jm.state().done || !document.querySelector('#vPlay').hidden))
    const src = await z.evaluate(() => jm.meSrc()); const nm = src.replace(/^img\/|\.webp.*$/g, '')
    if (seq.at(-1) !== nm) { seq.push(nm); if (['me_smart1', 'me_smart2', 'me_smart3'].includes(nm)) { await z.waitForTimeout(200); await z.locator('#mirror').screenshot({ path: `${ROOT}/shots/v-mirror-${nm}.png` }) } }
  }
  const ch = await z.evaluate(() => window.__meChanges); await z.close()
  expect(seq.includes('me_smart1') && seq.includes('me_smart2') && seq.includes('me_smart3') && ch >= 3, JSON.stringify({ seq, ch })); return seq.join('>')
})
await t('鏡の絵16枚が全部読める・部屋の鏡に出る', async () => {
  const z = await open(browser)
  await z.evaluate(() => { jm.setSeed(9); jm.fast(0.02) }); await z.click('#bStart')
  const SET = { me0: {}, me1: { look: 50 }, me2: { look: 100 }, me_smart1: { int: 40 }, me_smart2: { int: 80 }, me_smart3: { int: 120 }, me_buff1: { str: 50 }, me_buff2: { str: 100 }, me_smartbuff: { int: 80, str: 80 }, me_smartstyle: { int: 80, look: 80 }, me_buffstyle: { str: 80, look: 80 }, me_allhigh: { int: 100, str: 100, look: 100 }, me_tired: { hp: 5 }, me_injury: { lastInj: 1 }, me_gamer: { log: ['game', 'game', 'game'] }, me_party: { log: ['party', 'party'], n: 3 } }
  const bad = []
  for (const [nm, st] of Object.entries(SET)) {
    const got = await z.evaluate(st => { const S = jm.raw(); Object.assign(S, { int: 15, str: 15, look: 15, hp: 80, lastInj: -99, log: [] }); S.n.party = 0; const { n, ...rest } = st; Object.assign(S, rest); if (n) S.n.party = n; return Sim.mirror(D, S) }, st)
    const ok = await z.evaluate(async nm => { const i = new Image(); i.src = `img/${nm}.webp?v=2`; try { await i.decode(); return i.naturalWidth >= 200 } catch (e) { return false } }, nm)
    if (got !== nm || !ok) bad.push(nm + ':' + got + ':' + ok)
  }
  await z.close(); expect(!bad.length, bad.join(','))
})

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
await t('英語: PR ボタンとトークも英語', async () => {
  const pr = await e.evaluate(() => document.querySelector('#affBox').innerText)
  const who = await e.evaluate(() => jm.state().who)
  await e.click('#bBook2'); const xy = await e.evaluate(i => jm.cellXY(i), who); await e.mouse.click(xy.x, xy.y); await e.waitForFunction(() => window.__chatDone)
  const ch = await e.evaluate(() => document.querySelector('#chat').innerText); await e.screenshot({ path: ROOT + '/shots/v-en-chat.png' })
  expect(/PR/.test(pr) && /reading/.test(pr) && /17\+/.test(pr) && !/[ぁ-んァ-ヶ一-龠]/.test(pr + ch) && /Read/.test(ch), pr + ' || ' + ch.slice(0, 120))
  await e.click('#chBack'); await e.click('#bookClose')
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
  { const xy = await s.evaluate(() => jm.cellXY('imo')); await s.touchscreen.tap(xy.x, xy.y); await s.waitForFunction(() => window.__chatDone, null, { timeout: 15000 })
    views.chat = await fit(s); await s.screenshot({ path: `${ROOT}/shots/fit-${name}-chat.png` })
    const o = await overflow(s); if (o.sw > o.W || o.bad.length) views.chat.over.push('xover:' + JSON.stringify(o))
    const b = await s.evaluate(() => { const r = document.querySelector('#chBack').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }); await s.touchscreen.tap(b.x, b.y); await s.waitForSelector('#chat', { state: 'hidden' }) }
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
await awayTest(wp, { fb: 'snd/bgm.mp3' })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await awayNavTest(wp)
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

// ---- ページを離れたら音を止める（WebKit。裏に回る→戻る（bfcache の pageshow）で鳴らない、触ると戻る（resume を呼ぶ）。音は出さない。mute.mjs が resume を数えるだけにしているので state は見ない）
async function awayTest(pg, o = {}) {
  await t('WebKit: 裏に回ると BGM と環境音が止まり suspend。戻っても触るまで鳴らない（bfcache の pageshow でも）', async () => {
    const r = await pg.evaluate(async (fb) => {
      const sl = ms => new Promise(r => setTimeout(r, ms))
      if (!Snd.ctx) Snd.init()
      await sl(900); let fbUsed = false
      if (!Snd.playing().length && fb) { fbUsed = true; Snd.loop('__bed', fb, 0.2); for (let i = 0; i < 40 && !Snd.playing().length; i++) await sl(100) }
      const before = Snd.playing().length
      const c = Snd.ctx; let sus = 0; const os = c.suspend.bind(c); c.suspend = () => { sus++; return os() }
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))
      const hid = { away: Snd.away, playing: Snd.playing().length, sus, gain: Snd.master.gain.value }
      const nm = Object.keys(Snd.files)[0], src = nm ? Snd.play(nm) : null; Snd.loop('__q', fb || Object.values(Snd.files)[0][0], 0.2)   // 裏にいる間の音は鳴らさない
      await sl(400); const quiet = Snd.playing().length
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
      await sl(400); const back = { away: Snd.away, playing: Snd.playing().length, gain: Snd.master.gain.value }
      Snd.loop('__q', null)
      return { before, fbUsed, hid, src: !!src, quiet, back, calls0: window.__soundCalls || 0 }
    }, o.fb || null)
    const xy = o.tap ? await pg.evaluate(o.tap) : await pg.evaluate(() => ({ x: 8, y: innerHeight * 0.5 }))
    await pg.touchscreen.tap(xy.x, xy.y); await pg.waitForTimeout(800)
    const after = await pg.evaluate(() => ({ away: Snd.away, playing: Snd.playing().length, wake: Snd.life.wake, calls: window.__soundCalls || 0, mute: window.__muteOk() }))
    if (r.fbUsed) await pg.evaluate(() => Snd.loop('__bed', null))
    expect(r.before >= 1 && r.hid.away && r.hid.playing === 0 && r.hid.sus === 1 && r.hid.gain === 0 && !r.src && r.quiet === 0 && r.back.away && r.back.playing === 0 && r.back.gain === 0 && !after.away && after.playing >= r.before && after.wake === 1 && after.calls > r.calls0 && after.mute, JSON.stringify({ r, after }))
    return { before: r.before, after: after.playing, fb: r.fbUsed }
  })
}
async function awayNavTest(pg, o = {}) {
  await t('WebKit: 別のページへ移る（pagehide）と止まり、戻るで戻っても鳴っていない', async () => {
    await pg.evaluate(() => { if (!Snd.ctx) Snd.init(); addEventListener('pagehide', () => { try { sessionStorage.setItem('__awayHide', JSON.stringify({ away: Snd.away, playing: Snd.playing().length, hide: Snd.life.hide })) } catch (e) {} }) })
    const e0 = pg.errs.length
    await pg.goto(o.to || URL0 + 'privacy.html'); await pg.waitForTimeout(300)
    await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForFunction(() => document.readyState === 'complete' && typeof Snd === 'object', null, { timeout: 15000 }); await pg.waitForTimeout(1000)
    const back = await pg.evaluate(() => ({ playing: Snd.playing().length, ctx: !!Snd.ctx, away: Snd.away, h: JSON.parse(sessionStorage.getItem('__awayHide') || '{}') }))
    expect(back.h.away && back.h.playing === 0 && back.playing === 0 && pg.errs.length === e0, JSON.stringify(back) + pg.errs.slice(e0).join('|')); return back
  })
}
