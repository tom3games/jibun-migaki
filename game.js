// 自分磨き30日。部屋の物をタップして1日を使い、30日後にドアの向こうに恋人が来る
;(function () {
  window.__jsUp = true
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
  const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
  let lang = store.get('jm_lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
  const U = () => D.UI[lang], tx = o => (o ? (o[lang] ?? o.ja) : '')
  const touch = matchMedia('(pointer:coarse)').matches
  const V = 'v=2'
  let FAST = 1   // 検証で待ち時間を縮める倍率
  const wait = ms => new Promise(r => setTimeout(r, ms * FAST))
  const yen = n => (lang === 'ja' ? '' : '¥') + n.toLocaleString('ja-JP') + (lang === 'ja' ? '円' : '')

  // ---- 音（全部録音素材。出所は CREDITS.md）
  try { Snd.muted = store.get('jm_mute') === '1' } catch (e) {}
  Snd.def({
    clank: ['snd/clank1.mp3', 'snd/clank2.mp3', 'snd/clank3.mp3'], tear: ['snd/tear1.mp3', 'snd/tear2.mp3', 'snd/tear3.mp3'], book: ['snd/book1.mp3', 'snd/book2.mp3'],
    cloth: ['snd/cloth1.mp3', 'snd/cloth2.mp3'], coin: ['snd/coin1.mp3', 'snd/coin2.mp3'], clink: ['snd/clink1.mp3', 'snd/clink2.mp3'], meow: 'snd/meow.mp3',
    swish: ['snd/swish1.mp3', 'snd/swish2.mp3'], pop: ['snd/pop1.mp3', 'snd/pop2.mp3'], applause: 'snd/applause9.mp3', snore: 'snd/snore.mp3', drum: 'snd/drumroll.mp3',
    win: 'snd/win.mp3', win2: 'snd/win2.mp3', lose: 'snd/lose.mp3', gamej: 'snd/gamejingle.mp3', tap: 'snd/tap.mp3', stamp: 'snd/stamp.mp3',
  })
  const CUE = {
    gym: [['clank', { vol: 0.8 }], ['clank', { vol: 0.6, delay: 0.25 }]], study: [['book', { vol: 0.8 }]], skin: [['pop', { vol: 0.6 }], ['pop', { vol: 0.45, delay: 0.15 }]],
    salon: [['swish', { vol: 0.7 }], ['swish', { vol: 0.6, delay: 0.14 }], ['swish', { vol: 0.5, delay: 0.28 }]], clothes: [['cloth', { vol: 0.8 }], ['coin', { vol: 0.5, delay: 0.2 }]],
    job: [['coin', { vol: 0.8 }]], game: [['gamej', { vol: 0.45 }]], party: [['clink', { vol: 0.7 }], ['clink', { vol: 0.5, delay: 0.12 }]], sleep: [['snore', { vol: 0.5 }]],
    tear: [['tear', { vol: 0.6 }]], ev: [['pop', { vol: 0.5, rate: 0.8 }]], meow: [['meow', { vol: 0.8 }]], bad: [['clank', { vol: 0.7, rate: 0.7 }], ['stamp', { vol: 0.6, delay: 0.1 }]],
    tap: [['tap', { vol: 0.45, jitter: 0 }]], msg: [['pop', { vol: 0.35, rate: 1.2 }]], drum: [['drum', { vol: 0.85 }]], stamp: [['stamp', { vol: 1 }]],
    win: [['win', { vol: 0.8 }], ['applause', { vol: 0.45, delay: 0.3 }]], mid: [['win2', { vol: 0.8 }]], lose: [['lose', { vol: 0.8 }]],
  }
  window.__sfxCalls = {}
  const Sfx = n => { window.__sfxCalls[n] = (window.__sfxCalls[n] || 0) + 1; for (const [k, o] of CUE[n] || []) Snd.play(k, o) }
  const bed = on => { if (on) { Snd.loop('amb', 'snd/amb.mp3', 0.22); Snd.loop('bgm', 'snd/bgm.mp3', 0.16) } else { Snd.loop('bgm', null); Snd.loop('amb', 'snd/amb.mp3', 0.12) } }
  const muteIcon = () => { $('#icoWave').style.display = Snd.muted ? 'none' : '' }

  // ---- 状態
  let S = null, busy = false, seedNext = null, tutStep = 0, curMe = null
  const book = new Set((store.get('jm_book') || '').split(',').filter(Boolean))
  const PMAP = Object.fromEntries(D.P.map(p => [p.id, p]))

  function show(id) { for (const v of $$('main.view')) v.hidden = v.id !== id }

  // ---- 画面: 部屋
  function stage(v, cuts) { let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return i }
  function render() {
    const u = U()
    $('#hpLab').textContent = u.hp; $('#hpNum').textContent = S.hp
    $('#hpBar').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.ceil(S.hp / 10) ? '' : 'off'}"></i>`).join('')
    $('#hpNote').classList.toggle('low', S.hp < 30)
    $('#money').textContent = yen(S.money)
    $('#gInt').textContent = `${u.int} ${S.int}`; $('#gStr').textContent = `${u.str} ${S.str}`; $('#gLook').textContent = `${u.look} ${S.look}`
    $('#shelfImg').src = `img/shelf${stage(S.int, [38, 68, 105])}.webp?${V}`
    $('#rackImg').src = `img/rack${stage(S.str, [38, 68, 105])}.webp?${V}`
    // 鏡の自分は値の組み合わせ・ケガ・疲れ・最近の遊び方で16通り。変わった日は鏡が光って一言出る
    const me = Sim.mirror(D, S)
    if (me !== curMe) {
      $('#meImg').src = `img/${me}.webp?${V}`
      if (curMe) { const m = $('#mirror'), n = $('#meNote'); m.classList.remove('glow'); void m.offsetWidth; m.classList.add('glow'); n.textContent = tx(D.ME[me]); n.classList.remove('in'); void n.offsetWidth; n.classList.add('in'); window.__meChanges = (window.__meChanges || 0) + 1 }
      curMe = me
    }
    const dl = Sim.deal(D, S)
    for (const b of $$('.obj[data-a]')) {
      const a = b.dataset.a, A = D.ACT[a], x2 = dl && dl.act === a
      let c = A.money || 0; if (c < 0 && x2) c = Math.round(c / 2)
      const sub = c < 0 ? yen(-c) : c > 0 ? '+' + yen(c * (x2 ? 2 : 1)) : A.hp > 0 ? `${u.hp}+${A.hp}` : `${u.hp}${A.hp}`
      b.querySelector('.lab').innerHTML = `${tx(A)}<small>${sub}</small>`
      b.classList.toggle('deal', !!x2); if (x2) b.dataset.deal = tx(dl)
      b.querySelector('.lab').dataset.deal = x2 ? tx(dl) : ''
      b.classList.toggle('poor', c < 0 && S.money + c < 0)
      b.setAttribute('aria-label', tx(A))
    }
    calPage()
  }
  function calPage(fly) {
    const u = U(), left = D.DAYS - S.day + 1, dl = Sim.deal(D, S)
    const el = document.createElement('div'); el.className = 'cpage' + (left === 1 ? ' last' : '')
    el.innerHTML = `<small>${lang === 'ja' ? 'あと' : 'days left'}</small><strong>${left}</strong><em>${dl ? tx(dl) : ''}</em>`
    const cal = $('#cal'), old = cal.querySelector('.cpage:not(.fly)')
    if (old && fly) { old.classList.add('fly'); setTimeout(() => old.remove(), 600 * Math.max(FAST, 0.05) + 50); cal.insertBefore(el, old) }
    else { cal.innerHTML = ''; cal.appendChild(el) }
  }
  function say(t, cls = '') { const b = $('#bubble'); b.textContent = t; b.className = cls }
  function floats(el, d) {
    const r = (el.querySelector('img') || el).getBoundingClientRect(), u = U(); let k = 0
    for (const key of ['int', 'str', 'look', 'money', 'hp']) {
      const v = d[key]; if (!v) continue
      const f = document.createElement('div'); f.className = 'float' + (v < 0 ? ' neg' : '')
      f.textContent = (key === 'money' ? (v > 0 ? '+' : '-') + yen(Math.abs(v)) : `${u[key]}${v > 0 ? '+' : ''}${v}`)
      f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height * 0.35 - k * 24) + 'px'; k++
      document.body.appendChild(f); setTimeout(() => f.remove(), 1200)
    }
  }
  function tut() {
    const u = U(), h = $('#hand'), tip = $('#tip')
    if (tutStep >= 4 || store.get('jm_tut') === '1') { h.hidden = true; tip.hidden = true; return }
    const T = [[u.tut1, '#oRack'], [u.tut2, '#mirror'], [u.tut3, '#hpNote'], [u.tut4, '#cal']][tutStep]
    let t = T[0]; if (!touch) t = t.replace('タップ', 'クリック').replace('Tap', 'Click')
    tip.textContent = t; tip.hidden = false
    const r = $(T[1]).getBoundingClientRect(); h.hidden = false; h.style.left = (r.left + r.width / 2 - 8) + 'px'; h.style.top = (r.top + r.height * 0.45) + 'px'
  }

  // ---- 遊び
  function start() {
    Snd.init(); bed(true)
    const seed = seedNext ?? (Date.now() % 1e9); seedNext = null
    S = Sim.create(D, seed); busy = false; tutStep = 0; curMe = null; $('#meNote').classList.remove('in')
    show('vPlay'); render(); say(lang === 'ja' ? '今日から本気出す' : 'Today I start for real')
    $('#mirror').classList.remove('glow'); requestAnimationFrame(tut)
    window.TM && TM.start()
  }
  async function doAct(a, btn) {
    if (busy || !S || S.done || S.choice) return
    const u = U(), o = Sim.act(D, S, a)
    if (!o.ok) { if (o.why === 'money') { say(u.noMoney, 'bad'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump') } return }
    busy = true
    Sfx(a); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump')
    floats(btn, o.d)
    if (o.d.look > 0) { const m = $('#mirror'); m.classList.remove('glow'); void m.offsetWidth; m.classList.add('glow') }
    let line = D.LINES[a][lang][o.line], cls = ''
    const m = o.msgs
    if (m.includes('injury')) { line = u.injury; cls = 'bad'; Sfx('bad') }
    else if (m.includes('faint')) { line = u.faint; cls = 'bad'; Sfx('bad') }
    else if (m.includes('bang')) { line = u.bang; cls = 'bad' }
    else if (m.includes('weird')) { line = u.weird; cls = 'bad' }
    else if (m.includes('nap')) { line = u.nap; cls = 'bad' }
    else if (m.includes('shaky')) line = lang === 'ja' ? '腕がプルプルしてきた' : 'My arms are shaking'
    if (o.ev && !D.EVENTS[o.ev].c) { line = tx(D.EVENTS[o.ev]); cls = 'ev'; Sfx('ev') }
    say(line, cls)
    if (tutStep < 4) { tutStep++; if (tutStep >= 4) store.set('jm_tut', '1') }
    render()
    if (S.choice) { await wait(500); openMemo(); busy = false; return }
    await afterDay(o)
  }
  async function afterDay(o) {
    await wait(380)
    Sfx('tear'); calPage(true)
    for (let i = 0; i < (o.skipped || 0); i++) { await wait(450); Sfx('tear'); calPage(true) }
    render(); tut()
    if (S.done) { await wait(700); busy = false; return reveal() }
    busy = false
  }
  function openMemo() {
    const E = D.EVENTS[S.choice]
    $('#memoTxt').textContent = tx(E); $('#bC0').textContent = tx(E.c[0]); $('#bC1').textContent = tx(E.c[1])
    $('#memo').hidden = false
    if (S.choice === 'cat') Sfx('meow'); else Sfx('ev')
  }
  async function choose(i) {
    if (!S || !S.choice) return
    if (busy) return
    busy = true
    const ev = S.choice
    $('#memo').hidden = true
    const r = Sim.choose(D, S, i)
    if (r.broke) say(U().noMoney, 'bad')
    else { say(tx(r.res), 'ev'); floats($('#mirror'), r.d); if (ev === 'cat' && i === 0) Sfx('meow') }
    render()
    await afterDay(r)
  }

  // ---- 30日後
  async function reveal() {
    const u = U(), who = Sim.judge(D, S), p = PMAP[who]
    S.who = who; S.ttl = Sim.title(D, S)
    window.TM && TM.end(p.tier, p.tier >= 3)
    const isNew = !book.has(who); book.add(who); store.set('jm_book', [...book].join(','))
    show('vReveal'); bed(false); for (const f of $$('.float')) f.remove(); $('#hand').hidden = true
    const door = $('#door'), tag = $('#nameTag'), sayEl = $('#say')
    door.className = ''; tag.className = ''; sayEl.className = ''; $('#epi').textContent = ''; $('#bNext').hidden = true
    $('#portrait').src = `img/p_${who}.webp?${V}`
    $('#rvText').textContent = u.night; await wait(1500)
    $('#rvText').textContent = u.bell; Sfx('tap'); await wait(700)
    $('#rvText').textContent = u.door; Sfx('drum'); door.classList.add('shake'); await wait(3600)
    door.classList.remove('shake'); door.classList.add('open'); Sfx('swish')
    const fl = $('#flash'); fl.style.transition = 'none'; fl.style.opacity = 0.9; requestAnimationFrame(() => { fl.style.transition = 'opacity .6s'; fl.style.opacity = 0 })
    $('#rvText').textContent = u.who
    await wait(900)
    Sfx(p.tier >= 4 ? 'win' : p.tier >= 2 ? 'mid' : 'lose'); Sfx('stamp')
    tag.innerHTML = `${tx(p.name)}<small>${tx(p.tag)}${isNew ? (lang === 'ja' ? '・はじめて' : ' / NEW') : ''}</small>`; tag.classList.add('in')
    await wait(700); sayEl.textContent = tx(p.say); sayEl.classList.add('in')
    await wait(900); $('#epi').textContent = tx(p.epi)
    $('#bNext').textContent = u.next; $('#bNext').hidden = false
  }

  // ---- 結果: 招待状
  function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src }) }
  function wrapText(x, t, maxW) { const out = []; let cur = ''; for (const ch of (lang === 'ja' ? [...t] : t.split(/(?<= )/))) { if (x.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch.trimStart() } else cur += ch } if (cur) out.push(cur); return out }
  async function result() {
    show('vEnd'); window.__jmCardDone = false; const u = U(), p = PMAP[S.who]
    for (const b of ['#bAgain', '#bSave', '#bPost']) $(b).disabled = true
    const c = $('#card'), x = c.getContext('2d'), W = 1080, H = 1350
    x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, W, H)
    x.strokeStyle = '#b8955a'; x.lineWidth = 4; x.strokeRect(34, 34, W - 68, H - 68); x.lineWidth = 1.5; x.strokeRect(48, 48, W - 96, H - 96)
    const POP = '"RocknRoll One", sans-serif', HAND = '"Yusei Magic", sans-serif'
    try { await document.fonts.load(`40px ${POP}`); await document.fonts.load(`40px ${HAND}`) } catch (e) {}
    x.textAlign = 'center'; x.fillStyle = '#b8955a'; x.font = `34px ${HAND}`; x.fillText(lang === 'ja' ? 'Wedding Invitation' : 'You are invited', W / 2, 112)
    x.fillStyle = '#2a1d14'; x.font = `60px ${POP}`; x.fillText(u.invite, W / 2, 186)
    // 写真
    const img = await loadImg(`img/p_${S.who}.webp?${V}`)
    const pw = 470, ph = 600, px = (W - pw) / 2, py = 222
    x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 20; x.fillStyle = '#fff'; x.fillRect(px - 16, py - 16, pw + 32, ph + 32); x.restore()
    if (img) { const s = Math.max(pw / img.width, ph / img.height), sw = pw / s, sh = ph / s; x.drawImage(img, (img.width - sw) / 2, 0, sw, sh, px, py, pw, ph) }
    // 30日目の自分（鏡の絵）を左上に丸く
    const meI = await loadImg(`img/${Sim.mirror(D, S)}.webp?${V}`)
    if (meI) { const cx = px + 18, cy = py + 70, r = 92; x.save(); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 14; x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, r + 10, 0, 7); x.fill(); x.restore(); x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.drawImage(meI, cx - r, cy - r, r * 2, r * 2); x.restore() }
    // 名前
    x.fillStyle = '#2a1d14'; x.font = `54px ${POP}`
    x.fillText(`${u.groom} ${u.and} ${tx(p.name)}`, W / 2, py + ph + 92)
    x.fillStyle = '#d23a2a'; x.font = `34px ${HAND}`; x.fillText(`${tx(p.tag)}`, W / 2, py + ph + 140)
    // 3つの値
    const st = [[u.int, S.int], [u.str, S.str], [u.look, S.look]], y0 = py + ph + 206
    st.forEach(([k, v], i) => { const cx = W / 2 + (i - 1) * 250; x.fillStyle = '#7a6550'; x.font = `30px ${HAND}`; x.fillText(k, cx, y0); x.fillStyle = '#2a1d14'; x.font = `56px ${POP}`; x.fillText(v, cx, y0 + 60) })
    // 称号と結末
    x.fillStyle = '#7a6550'; x.font = `30px ${HAND}`; x.fillText(`${lang === 'ja' ? '称号' : 'Title'}: ${tx(D.TITLES[S.ttl])}`, W / 2, y0 + 122)
    x.fillStyle = '#2a1d14'; x.font = `38px ${HAND}`
    wrapText(x, tx(p.epi), 900).slice(0, 2).forEach((l, i) => x.fillText(l, W / 2, y0 + 184 + i * 48))
    x.fillStyle = '#b8955a'; x.font = `26px ${HAND}`; x.fillText(lang === 'ja' ? '自分磨き30日' : '30-Day Glow-Up', W / 2, H - 66)
    for (const b of ['#bAgain', '#bSave', '#bPost']) $(b).disabled = false
    aff()
    window.__jmCardDone = true
  }

  // ---- 図鑑
  function openBook(sel) {
    const u = U(), g = $('#grid')
    $('#bookH').textContent = u.zukan; $('#bookN').textContent = u.unlocked(book.size, D.P.length); $('#bookClose').textContent = u.back
    g.innerHTML = D.P.map(p => book.has(p.id) ? `<button class="cell" data-id="${p.id}"><img src="img/t_${p.id}.webp?${V}" alt=""><b>${tx(p.name)}</b></button>` : `<button class="cell lock" data-id="${p.id}">?</button>`).join('')
    $('#bookInfo').textContent = book.size ? u.tapChat : ''
    $('#book').hidden = false
    if (sel) info(sel)
  }
  function info(id) {
    const p = PMAP[id], u = U()
    for (const c of $$('.cell')) c.classList.toggle('sel', c.dataset.id === id)
    $('#bookInfo').textContent = book.has(id) ? `${tx(p.name)}（${tx(p.tag)}）${tx(p.epi)}` : `${u.locked}  ${u.hint}: ${tx(p.hint)}`
  }

  // ---- トーク（架空のアプリ「こいぶみ」）
  let chatRun = 0
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  function bubbleHTML(m, id, showAv) {
    const [who, k, ja, en] = m, u = U()
    if (who === 's') return `<div class="sys">${esc(lang === 'ja' ? ja : en)}</div>`
    let body
    if (k === 't') body = `<div class="bb">${esc(lang === 'ja' ? ja : en)}</div>`
    else if (k === 'ph') body = `<div class="ph"><img src="img/p_${id}.webp?${V}" alt=""></div>`
    else if (k === 'pic') body = `<div class="pic"><svg viewBox="0 0 100 100">${STAMPS[ja]}</svg></div>`
    else if (k === 'st') body = `<div class="st"><svg viewBox="0 0 100 100">${STAMPS[ja]}</svg></div>`
    else body = `<div class="bb vc"><svg viewBox="0 0 20 20" class="play"><path d="M5 3l12 7-12 7z"/></svg><span class="wave">${'<i></i>'.repeat(14)}</span><b>${esc(ja)}</b></div>`
    const meta = `<div class="meta">${who === 'y' ? `<span>${u.read}</span>` : ''}<span>${m.time}</span></div>`
    const av = who === 'p' ? `<img class="av" src="img/t_${id}.webp?${V}" alt=""${showAv ? '' : ' style="visibility:hidden"'}>` : ''
    return `<div class="m ${who}">${av}${body}${meta}</div>`
  }
  async function openChat(id) {
    const p = PMAP[id], u = U(), run = ++chatRun, log = $('#chLog')
    $('#chAv').src = `img/t_${id}.webp?${V}`; $('#chName').textContent = tx(p.name); $('#chTag').textContent = tx(p.tag); $('#chBack').lastChild.textContent = u.zukan
    $('#chInput').textContent = u.chatInput
    let t = '0:00'
    const list = CHATS[id].map(m => { if (m[4]) t = m[4]; const c = m.slice(); c.time = t; return c })
    log.innerHTML = `<div class="sys brand">${u.app}</div>`
    $('#chat').hidden = false; $('#chat').dataset.id = id; window.__chatDone = false
    let prev = null
    for (let i = 0; i < list.length; i++) {
      if (run !== chatRun) return
      const m = list[i]
      log.insertAdjacentHTML('beforeend', bubbleHTML(m, id, m[0] === 'p' && prev !== 'p')); prev = m[0]
      log.lastElementChild.classList.add('in')
      log.scrollTop = log.scrollHeight
      if (m[0] !== 's') Sfx('msg')
      if (!chatSkip) await wait(m[0] === 's' ? 380 : 520)
    }
    window.__chatDone = true
  }
  let chatSkip = false
  function closeChat() { chatRun++; chatSkip = false; $('#chat').hidden = true }

  // ---- 結果画面だけに出す PR ボタン（config.js の AFF_URL が空なら何も出さない）
  function aff() {
    const box = $('#affBox'), url = window.AFF_URL || '', u = U()
    if (!url) { box.hidden = true; $('#bAff').removeAttribute('href'); return }
    $('#bAff').href = url; $('#affTxt').textContent = u.affBtn; $('#affNote').textContent = u.affNote
    box.hidden = false
  }

  function applyLang() {
    const u = U(); document.documentElement.lang = lang
    document.title = lang === 'ja' ? '自分磨き30日（恋人は磨いた分だけ）' : '30-Day Glow-Up'
    $('#tTitle').innerHTML = lang === 'ja' ? '自分磨き<b>30</b>日' : '<b>30</b>-Day<br>Glow-Up'
    $('#tSub').textContent = u.sub; $('#bStart').textContent = u.start; $('#bHow').textContent = u.how; $('#bBook').textContent = u.zukan
    $('#bLang').textContent = lang === 'ja' ? 'EN' : 'JA'
    $('#bSave').textContent = u.save; $('#bPost').textContent = u.post; $('#bAgain').textContent = u.again; $('#bBook2').textContent = u.zukan
    $('#loadTxt').textContent = u.load
    $('#howH').textContent = u.how; $('#howClose').textContent = u.back
    $('#howBody').innerHTML = u.howBody.map(t => `<p>${t}</p>`).join('') + `<small>${u.credits}<br><a href="privacy.html" target="_blank" rel="noopener">${u.privacy}</a></small>`
    if (S && !$('#vPlay').hidden) { render(); tut() }
    if (S && S.who && !$('#vEnd').hidden) result()
    if (!$('#chat').hidden) { chatSkip = true; openChat($('#chat').dataset.id) }
  }

  // ---- 入力
  function on(sel, fn) { const el = $(sel); el.addEventListener('click', e => { fn(e) }) }
  for (const b of $$('.obj[data-a]')) b.addEventListener('click', () => doAct(b.dataset.a, b))
  on('#bStart', () => { Sfx('tap'); start() })
  on('#bAgain', () => { Sfx('tap'); start() })
  on('#bHow', () => { Snd.init(); $('#how').hidden = false })
  on('#howClose', () => { $('#how').hidden = true })
  on('#bBook', () => { Snd.init(); openBook() }); on('#bBook2', () => openBook(S && S.who)); on('#bookClose', () => { $('#book').hidden = true })
  $('#grid').addEventListener('click', e => { const c = e.target.closest('.cell'); if (!c) return; info(c.dataset.id); if (book.has(c.dataset.id)) { Sfx('tap'); chatSkip = false; openChat(c.dataset.id) } })
  on('#chBack', () => { Sfx('tap'); closeChat() })
  on('#chLog', () => { chatSkip = true })
  on('#bAff', () => { window.TM && TM.aff && TM.aff() })
  on('#bC0', () => choose(0)); on('#bC1', () => choose(1))
  on('#bNext', () => { Sfx('tap'); result() })
  on('#bLang', () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('jm_lang', lang); applyLang() })
  on('#bMute', () => { Snd.init(); Snd.setMute(!Snd.muted); store.set('jm_mute', Snd.muted ? '1' : '0'); muteIcon() })
  on('#bSave', () => { window.TM && TM.share('save'); $('#card').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'jibun-migaki.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000) }) })
  on('#bPost', () => {
    window.TM && TM.share('x'); const p = PMAP[S.who]
    const text = U().postText(tx(p.name) + (lang === 'ja' ? '（' + tx(p.tag) + '）' : ' (' + tx(p.tag) + ')'), tx(D.TITLES[S.ttl]))
    open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.github.io/jibun-migaki/'), '_blank')
  })
  document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#tmSupport')) window.TM && TM.support() })

  // ---- 検証用の窓口
  window.jm = {
    state: () => S && { day: S.day, done: S.done, int: S.int, str: S.str, look: S.look, money: S.money, hp: S.hp, choice: S.choice, who: S.who, n: S.n, sleeps: S.sleeps, injuries: S.injuries, cat: S.cat, granny: S.granny, streak: S.streak, threads: S.threads },
    raw: () => S, busy: () => busy, setSeed: n => { seedNext = n }, fast: f => { FAST = f },
    itemXY: a => { const el = a === 'c0' ? $('#bC0') : a === 'c1' ? $('#bC1') : $(`.obj[data-a="${a}"]`); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6, w: r.width, h: r.height } },
    setLang: l => { lang = l; applyLang() }, book: () => [...book], setBook: ids => { book.clear(); ids.forEach(i => book.add(i)) },
    cellXY: id => { const r = $(`.cell[data-id="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } },
    mirror: () => S && Sim.mirror(D, S), meSrc: () => $('#meImg').getAttribute('src'), aff,
  }

  // ---- 読み込み（最初の画面に要る絵を数えてバーを進める）
  const CORE = ['room', 'o_mirror', 'me0', 'o_pig', 'shelf0', 'rack0', 'o_skin', 'o_salon', 'o_clothes', 'o_apron', 'o_game', 'o_phone', 'o_bed']
  let got = 0
  const hideLoad = () => { const l = $('#loading'); if (l.dataset.gone) return; l.dataset.gone = 1; l.style.opacity = 0; setTimeout(() => { l.hidden = true }, 360) }
  applyLang(); muteIcon()
  Promise.all(CORE.map(n => loadImg(`img/${n}.webp?${V}`).then(() => { got++; $('#loadBar i').style.width = (got / CORE.length * 100) + '%' }))).then(() => {
    hideLoad(); window.__jmReady = true
    // 残りは裏で読む（段階の絵と恋人）
    const rest = ['shelf1', 'shelf2', 'shelf3', 'rack1', 'rack2', 'rack3'].concat(Sim.MIRRORS.filter(m => m !== 'me0'), D.P.map(p => 'p_' + p.id))
    rest.forEach((n, i) => setTimeout(() => loadImg(`img/${n}.webp?${V}`), 200 + i * 60))
  })
  setTimeout(() => { if (!window.__jmReady) { hideLoad(); window.__jmReady = true } }, 12000)
})()
