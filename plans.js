// 恋人ごとの遊び方（検証用の bot）。sim.mjs と verify.mjs が使う。S を見て次の行動を返す
;(function (root) {
  const P = {}
  const afford = (S, c) => S.money >= c
  // 体力が減っていたら寝る。筋トレは2日続けたら休む
  const rest = (S, lim = 30) => S.hp < lim
  const gymOk = S => S.streak < 2 && S.hp >= 30
  // 目標に届いたあとは、ほかの判定に触れない範囲で日を流す
  const idle = S => S.n.sleep < 12 ? 'sleep' : S.n.game < 8 ? 'game' : S.n.skin < 6 && afford(S, 1500) ? 'skin' : 'sleep'
  function looks(S) { if (afford(S, 6000)) return 'salon'; if (afford(S, 1500)) return 'skin'; return 'job' }
  P.pillow = () => 'sleep'
  P.robot = S => rest(S, 20) ? 'sleep' : 'study'
  P.otaku = S => S.int >= 99 ? idle(S) : rest(S, 20) ? 'sleep' : 'study'
  P.protein = S => S.str >= 105 ? idle(S) : gymOk(S) ? 'gym' : S.hp < 60 ? 'sleep' : 'game'
  P.narcis = S => S.look >= 108 ? idle(S) : rest(S, 30) ? 'sleep' : (S.money < 6000 ? 'job' : looks(S))
  P.prof = S => S.int >= 99 && S.str >= 99 ? idle(S) : rest(S, 30) ? 'sleep' : (S.str < S.int && gymOk(S)) ? 'gym' : S.int < 99 ? 'study' : gymOk(S) ? 'gym' : 'sleep'
  P.inteli = S => { if (S.int >= 99 && S.look >= 99) return idle(S); if (rest(S, 30)) return 'sleep'; if (S.look < S.int || S.int >= 99) return S.money < 6000 ? 'job' : looks(S); return 'study' }
  P.gal = S => { if (S.str >= 99 && S.look >= 99) return idle(S); if (rest(S, 30)) return 'sleep'; if ((S.str < S.look || S.look >= 99) && gymOk(S)) return 'gym'; if (S.look < 99) return S.money < 6000 ? 'job' : looks(S); return 'sleep' }
  P.takane = S => {
    if (S.int >= 96 && S.str >= 96 && S.look >= 96) return idle(S)
    if (rest(S, 30)) return 'sleep'
    const need = [['int', S.int], ['str', S.str], ['look', S.look]].filter(x => x[1] < 96).sort((a, b) => a[1] - b[1])
    for (const [k] of need) {
      if (k === 'str' && gymOk(S)) return 'gym'
      if (k === 'int') return 'study'
      if (k === 'look') return S.money < 6000 ? 'job' : 'salon'
    }
    return 'study'
  }
  P.futsuu = S => {
    if (rest(S, 30)) return 'sleep'
    if (S.str < 54 && gymOk(S)) return 'gym'
    if (S.int < 54) return 'study'
    if (S.look < 54) return S.money < 6000 ? 'job' : 'salon'
    return idle(S)
  }
  P.imo = S => ['job', 'game', 'sleep', 'skin'][S.day % 4] === 'skin' && S.money < 1500 ? 'job' : ['job', 'game', 'sleep', 'skin'][S.day % 4]
  P.rich = S => rest(S, 30) ? 'sleep' : 'job'
  P.goukon = S => rest(S, 30) ? 'sleep' : S.money >= 5000 ? 'party' : 'job'
  P.cat = S => P.futsuu(S)
  P.granny = S => P.futsuu(S)
  P.nurse = () => 'gym'
  P.gamer = () => 'game'
  // できごとの2択（猫の bot は猫にエサ、おばあちゃんの bot は手伝う。ほかは断る）
  const CH = { cat: { cat: 0 }, granny: { granny: 0 } }
  function choice(plan, ev) { return (CH[plan] && CH[plan][ev] != null) ? CH[plan][ev] : 1 }
  const api = { P, choice }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.Plans = api
})(typeof window !== 'undefined' ? window : globalThis)
