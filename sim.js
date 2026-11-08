// 30日の仕組み（画面に依存しない）。ブラウザでは window.Sim、node では require/import で使う
;(function (root) {
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }
  let MAX = 150
  const clamp = v => Math.max(0, Math.min(MAX, v))

  function create(D, seed) {
    const r = rng(seed); MAX = D.MAX || 100
    const S = {
      seed, day: 1, done: false, int: D.START.int, str: D.START.str, look: D.START.look, money: D.START.money, hp: D.START.hp,
      n: {}, sleeps: 0, injuries: 0, lastInj: -99, cat: 0, granny: 0, streak: 0, forced: 0, forcedWhy: '', choice: null, log: [], deals: [], events: [],
    }
    for (const k in D.ACT) S.n[k] = 0
    // その日のおすすめ（4割）
    for (let d = 1; d <= D.DAYS; d++) S.deals[d] = r() < 0.4 ? Math.floor(r() * D.DEALS.length) : -1
    // できごと: 猫とおばあちゃんは半分の回で4回ずつ来る。それ以外の日は25%で何か起きる
    const free = []; for (let d = 2; d <= D.DAYS - 1; d++) free.push(d)
    const take = () => free.splice(Math.floor(r() * free.length), 1)[0]
    S.threads = { cat: r() < 0.5, granny: r() < 0.5 }
    for (const th of ['cat', 'granny']) if (S.threads[th]) for (let i = 0; i < 4; i++) S.events[take()] = th
    const POOL = [['lotto', 3], ['lotto1', 0.35], ['parents', 2], ['ramen', 2], ['buzz', 1.5], ['pimple', 1.5], ['cold', 1], ['quiz', 1.5], ['pot', 1.2]]
    const W = POOL.reduce((a, b) => a + b[1], 0)
    for (const d of free) if (r() < 0.25) { let x = r() * W; for (const [k, w] of POOL) { if ((x -= w) < 0) { S.events[d] = k; break } } }
    S.r = r
    return S
  }

  const deal = (D, S) => S.deals[S.day] >= 0 ? D.DEALS[S.deals[S.day]] : null

  // 1日を使う。返り値: { ok, msgs:[{k,args}], d:{int,str,look,money,hp}, ev }
  function act(D, S, a) {
    if (S.done || S.choice) return { ok: false, why: 'busy' }
    const A = D.ACT[a], dl = deal(D, S), x2 = dl && dl.act === a
    let cost = A.money || 0; if (cost < 0 && x2) cost = Math.round(cost / 2)
    if (S.money + cost < 0) return { ok: false, why: 'money' }
    const before = { int: S.int, str: S.str, look: S.look, money: S.money, hp: S.hp }
    const out = { ok: true, a, msgs: [], x2: !!x2, line: Math.floor(S.r() * 3) }
    S.n[a]++
    if (a !== 'gym') S.streak = 0
    if (a === 'gym') {
      S.streak++
      if (S.streak >= 3 || S.hp < 25) { S.injuries++; S.lastInj = S.day; S.str += 5; S.hp = Math.max(S.hp - 25, 0); S.streak = 0; S.forced = 2; S.forcedWhy = 'injury'; out.msgs.push('injury') }
      else { S.str += A.str * (x2 ? 2 : 1); S.hp += A.hp; if (S.streak === 2) out.msgs.push('shaky') }
    } else if (a === 'study') {
      if (S.hp < 15) { S.int += 5; out.msgs.push('nap') } else { S.int += A.int * (x2 ? 2 : 1); S.hp += A.hp }
    } else if (a === 'salon') {
      S.money += cost; if (S.r() < 0.15) { S.look -= 6; out.msgs.push('bang') } else S.look += A.look
    } else if (a === 'clothes') {
      S.money += cost; if (S.r() < 0.2) { S.look += 3; out.msgs.push('weird') } else S.look += A.look
    } else if (a === 'job') { S.money += A.money * (x2 ? 2 : 1); S.hp += A.hp }
    else if (a === 'skin') { S.money += cost; S.look += A.look * (x2 ? 2 : 1); S.hp += A.hp }
    else if (a === 'game') { S.hp += A.hp; S.look += A.look }
    else if (a === 'party') { S.money += cost; S.look += A.look; S.hp += A.hp }
    else if (a === 'sleep') { S.hp += A.hp; S.sleeps++ }
    if (S.hp <= 0 && !S.forced) { S.forced = 1; S.forcedWhy = 'faint'; out.msgs.push('faint') }
    fix(S)
    // できごと（入院・倒れた日は起きない）
    const ev = S.events[S.day]
    if (ev && !S.forced) {
      const E = D.EVENTS[ev]
      const ok = !E.need || (E.need === 'look60' ? S.look >= 60 : S.int >= 60)
      if (ok) { out.ev = ev; if (E.c) S.choice = ev; else applyFx(S, E) }
    }
    out.d = diff(before, S)
    S.log.push(a)
    if (!S.choice) next(D, S, out)
    return out
  }
  function choose(D, S, i) {
    if (!S.choice) return null
    const E = D.EVENTS[S.choice], c = E.c[i], before = { int: S.int, str: S.str, look: S.look, money: S.money, hp: S.hp }
    if ((c.money || 0) < 0 && S.money + c.money < 0) { S.choice = null; const o = { broke: true }; next(D, S, o); return o }
    applyFx(S, c); S.choice = null
    const o = { d: diff(before, S), res: c.res }
    next(D, S, o); return o
  }
  function applyFx(S, E) {
    for (const k of ['int', 'str', 'look', 'hp', 'money']) if (E[k]) S[k] += E[k]
    if (E.cat) S.cat += E.cat; if (E.granny) S.granny += E.granny
    fix(S)
  }
  function fix(S) { S.int = clamp(S.int); S.str = clamp(S.str); S.look = clamp(S.look); S.hp = Math.max(0, Math.min(100, S.hp)); S.money = Math.max(0, S.money) }
  const diff = (b, S) => ({ int: S.int - b.int, str: S.str - b.str, look: S.look - b.look, money: S.money - b.money, hp: S.hp - b.hp })
  // 日を進める。入院・寝込みの日は自動で過ぎる
  function next(D, S, out) {
    S.day++
    out.skipped = 0
    while (S.forced > 0 && S.day <= D.DAYS) { S.forced--; S.hp = Math.min(100, S.hp + 30); S.day++; out.skipped++ }
    S.forced = 0; fix(S)
    if (S.day > D.DAYS) { S.done = true; S.day = D.DAYS }
  }

  // 恋人を決める
  function judge(D, S) {
    const H = D.H, L = D.L, I = S.int >= H, St = S.str >= H, Lk = S.look >= H
    if (S.sleeps >= 20) return 'pillow'
    // 猫とトメさんは隠しの恋人。出来事4回を全部選び、しかも磨きが「高嶺の花」に届かなかった時だけ（2026-11-09 本人「トメさんばっかり出てくる」）
    const hiddenOk = !(I && St && Lk)
    if (hiddenOk && S.cat >= 4) return 'cat'
    if (hiddenOk && S.granny >= 4) return 'granny'
    if (S.injuries >= 2) return 'nurse'
    if (S.n.game >= 10) return 'gamer'
    if (S.int >= 128 && S.str < L && S.look < L) return 'robot'
    if (S.n.party >= 6) return 'goukon'
    if (S.money >= 60000 && S.n.job >= 8) return 'rich'
    if (I && St && Lk) return 'takane'
    if (I && St) return 'prof'
    if (I && Lk) return 'inteli'
    if (St && Lk) return 'gal'
    if (I) return 'otaku'
    if (St) return 'protein'
    if (Lk) return 'narcis'
    if (Math.min(S.int, S.str, S.look) >= L) return 'futsuu'
    return 'imo'
  }
  function title(D, S) {
    let best = 'sleep', m = -1
    for (const k in S.n) if (S.n[k] > m) { m = S.n[k]; best = k }
    return best
  }
  // 鏡に映る自分（絵の名前 = img/<名前>.webp）。ケガ・疲れ・最近の遊び方が先、つぎに組み合わせ、最後に一番伸びた値の段階
  function mirror(D, S) {
    if (S.lastInj >= 0 && S.day - S.lastInj <= 5) return 'me_injury'
    if (S.hp < 15) return 'me_tired'
    const I = S.int, St = S.str, Lk = S.look, C = 75, top = Math.max(I, St, Lk)
    if (I >= 90 && St >= 90 && Lk >= 90) return 'me_allhigh'
    const last = S.log.slice(-6), cnt = a => last.filter(x => x === a).length
    if (cnt('game') >= 3 && top < 70) return 'me_gamer'
    if (S.n.party >= 3 && cnt('party') >= 2 && top < 90) return 'me_party'
    if (I >= C && St >= C) return 'me_smartbuff'
    if (I >= C && Lk >= C) return 'me_smartstyle'
    if (St >= C && Lk >= C) return 'me_buffstyle'
    // [段階, 値, 絵]。筋力と見た目の2段目は、知力の3段目と2段目の間に置く
    const c = [
      I >= 110 ? [3, I, 'me_smart3'] : I >= 70 ? [2, I, 'me_smart2'] : I >= 35 ? [1, I, 'me_smart1'] : [0, I, 'me0'],
      St >= 90 ? [2.5, St, 'me_buff2'] : St >= 40 ? [1, St, 'me_buff1'] : [0, St, 'me0'],
      Lk >= 90 ? [2.5, Lk, 'me2'] : Lk >= 40 ? [1, Lk, 'me1'] : [0, Lk, 'me0'],
    ].sort((a, b) => b[0] - a[0] || b[1] - a[1])
    return c[0][2]
  }
  const MIRRORS = ['me0', 'me1', 'me2', 'me_smart1', 'me_smart2', 'me_smart3', 'me_buff1', 'me_buff2', 'me_smartbuff', 'me_smartstyle', 'me_buffstyle', 'me_allhigh', 'me_tired', 'me_injury', 'me_gamer', 'me_party']
  const api = { create, act, choose, judge, title, deal, mirror, MIRRORS }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.Sim = api
})(typeof window !== 'undefined' ? window : globalThis)
