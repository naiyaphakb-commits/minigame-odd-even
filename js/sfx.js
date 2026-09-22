/* ============================================================
   เสียงเกม — สังเคราะห์สดด้วย Web Audio API ไม่มีไฟล์เสียง
   · เสียงเอฟเฟกต์  : คลิก / วางชิพ / ไข่เด้ง / ไข่สั่น / ไข่แตก / ชนะ / แพ้
   · เสียงพื้นหลัง  : ลูปสนุก ๆ เบส + เมโลดี้ + ไฮแฮต
   ============================================================ */
(() => {
'use strict';

/* ── ใส่ไฟล์เสียงเองได้ที่นี่ ──────────────────────────────
   วางไฟล์ไว้ใน assets/audio/ แล้วใส่ชื่อตรงนี้ ระบบจะใช้ไฟล์แทนเสียงสังเคราะห์
   เว้นว่าง = ใช้เสียงสังเคราะห์เหมือนเดิม  ตัวอย่าง:
     bgm:   'assets/audio/bgm.mp3',
     crack: 'assets/audio/crack.mp3',
   ─────────────────────────────────────────────────────── */
const FILES = {
  bgm: '',
  chip: 'assets/audio/sfx/chip.wav', place: '', cancel: '', confirm: '',
  hop: '', crack: '', win: '', lose: '', error: '', tab: '',
  coin: '', coinEnd: '', chipFall: '',
};
const VOL = { bgm: .45, fx: 1, voice: .95 };   // ระดับเสียงของไฟล์ (0–1)

/* ── เสียงพากย์ ── ไฟล์ใน assets/audio/voice/
   จุดไหนมีหลายไฟล์ = สุ่มเล่นสลับกันไป ไม่ให้ซ้ำจำเจ */
const V = 'assets/audio/voice/';
const VOICE = {
  roundStart: [V+'round-start.wav', V+'round-start-2.wav'],
  hurry     : [V+'hurry.wav', V+'hurry-2.wav'],
  confirm   : [V+'confirm-1.wav', V+'confirm-2.wav', V+'confirm-3.wav',
               V+'confirm-4.wav', V+'confirm-5.wav', V+'confirm-6.wav'],
  placeEven : [V+'pick-even.wav'],                     // วางเดิมพันฝั่งคู่
  placeOdd  : [V+'pick-odd.wav'],                      // วางเดิมพันฝั่งคี่
  win       : [V+'win-1.wav', V+'win-2.wav', V+'win-3.wav',
               V+'win-4.wav', V+'win-5.wav', V+'win-6.wav'],
  winStreak : [V+'win-streak.wav', V+'win-streak-2.wav'],   // ชนะติดต่อกัน 3 ครั้ง
  lose      : [V+'lose-1.wav', V+'lose-2.wav', V+'lose-3.wav', V+'lose-4.wav',
               V+'lose-5.wav', V+'lose-6.wav', V+'lose-7.wav', V+'lose-8.wav',
               V+'lose-9.wav'],
  noBet     : [V+'no-bet.wav'],                        // หมดเวลาแบบไม่ได้แทง
  lowCredit : [V+'low-credit.wav'],                    // ยอดเงินไม่พอ
};
let voiceEl = null;

let ctx = null, master = null;
const on = { fx: true, bgm: true };
const buffers = {};                  // เก็บไฟล์ที่โหลดแล้ว
let bgmEl = null;

/* โหลดไฟล์เสียงล่วงหน้า — รองรับทั้ง path ปกติและ data URI (ไฟล์ standalone)
   data URI ถอดเองไม่ผ่าน fetch เพราะบางเบราว์เซอร์บล็อก fetch ตอนเปิดจาก file:// */
function dataToBuffer(url) {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}
async function loadFile(name, url) {
  try {
    let raw;
    if (String(url).startsWith('data:')) {
      raw = dataToBuffer(url);
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      raw = await res.arrayBuffer();
    }
    buffers[name] = await ac().decodeAudioData(raw);
  } catch (e) {
    console.warn(`[sfx] โหลดเสียง ${name} ไม่สำเร็จ — ใช้เสียงสังเคราะห์แทน`, e);
  }
}
function playFile(name) {
  const buf = buffers[name];
  if (!buf) return false;
  const c = ac(), src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf; g.gain.value = VOL.fx;
  src.connect(g).connect(master);
  src.start();
  return true;
}

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = .9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/* ── โน้ตหนึ่งตัว ── */
function note(freq, dur, {
  to = freq, type = 'triangle', gain = .18, at = 0, attack = .008,
  detune = 0, vibrato = 0, bus = null,
} = {}) {
  const c = ac(), t = (at || c.currentTime);
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);

  if (vibrato) {                       // สั่นเสียงให้รู้สึกมีชีวิต
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = vibrato; lg.gain.value = freq * .04;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + dur + .05);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(g).connect(bus || master);
  osc.start(t); osc.stop(t + dur + .03);
}

/* ── เสียงซ่า ── */
function noise(dur, { gain = .2, at = 0, hp = 600, lp = 8000, q = .8, bus = null } = {}) {
  const c = ac(), t = (at || c.currentTime);
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** .6;
  const src = c.createBufferSource(); src.buffer = buf;
  const hpf = c.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp; hpf.Q.value = q;
  const lpf = c.createBiquadFilter(); lpf.type = 'lowpass';  lpf.frequency.value = lp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(hpf).connect(lpf).connect(g).connect(bus || master);
  src.start(t); src.stop(t + dur);
}

/* ── เสียงตุ้บ (ใช้เป็นแรงกระแทก) ── */
function thump(freq, dur, gain = .5, at = 0) {
  const c = ac(), t = (at || c.currentTime);
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * .25, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t); osc.stop(t + dur + .02);
}

/* ══════════ เสียงเอฟเฟกต์ ══════════ */
const N = { C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494,
            C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988, C6:1047, E6:1319, G6:1568 };

const SFX = {
  /* คลิกชิพ — เหมือนชิพกระทบกัน */
  chip() {
    noise(.05, { gain: .16, hp: 2500, lp: 12000 });
    note(1400, .06, { to: 900, type: 'triangle', gain: .12 });
  },
  /* วางเดิมพัน — ป๊อกใส ๆ แล้วเด้งขึ้น */
  place() {
    thump(180, .09, .35);
    note(N.E5, .1, { type: 'triangle', gain: .2 });
    note(N.B5, .12, { type: 'triangle', gain: .14, at: ac().currentTime + .06 });
    noise(.07, { gain: .1, hp: 3000 });
  },
  cancel() {
    note(N.G4, .1, { to: N.C4, type: 'triangle', gain: .17 });
    note(N.E4, .14, { to: 160, type: 'sine', gain: .12, at: ac().currentTime + .05 });
  },
  /* ยืนยัน — อาร์เพจจิโอสดใส */
  confirm() {
    const t = ac().currentTime;
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) =>
      note(f, .22, { type: 'triangle', gain: .2, at: t + i * .055, vibrato: 6 }));
    noise(.12, { gain: .08, hp: 4000, at: t + .16 });
  },
  /* ไข่เด้ง — บ๊อยง์การ์ตูน */
  hop() {
    const t = ac().currentTime;
    note(150, .13, { to: 520, type: 'triangle', gain: .16, vibrato: 18 });
    note(300, .08, { to: 900, type: 'sine', gain: .07, at: t + .01 });
  },
  /* ไข่แตก — ตุ้บหนัก + เปลือกกระจาย + ประกาย */
  crack() {
    const t = ac().currentTime;
    thump(140, .3, .7);                                  // แรงกระแทก
    noise(.09, { gain: .5, hp: 500, lp: 14000 });        // เปลือกแตก
    noise(.34, { gain: .3, hp: 2500, lp: 16000, at: t + .04 });  // เศษกระจาย
    note(1600, .16, { to: 300, type: 'square', gain: .12, at: t + .01 });
    [N.G5, N.C6, N.E6].forEach((f, i) =>                 // ประกายทอง
      note(f, .3, { type: 'triangle', gain: .13, at: t + .07 + i * .035 }));
  },
  /* ชนะ — แฟนแฟร์ + ประกายรัว */
  win() {
    const t = ac().currentTime;
    [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) =>
      note(f, .38, { type: 'triangle', gain: .2, at: t + i * .085, vibrato: 7 }));
    [0, .085, .17, .255].forEach(d => noise(.18, { gain: .07, hp: 6000, at: t + d + .05 }));
    thump(90, .35, .3, t);
    note(N.C6, .9, { type: 'sine', gain: .12, at: t + .5, vibrato: 5 });
  },
  /* แพ้ — ว้าว ๆ แบบการ์ตูน ไม่หดหู่ */
  lose() {
    const t = ac().currentTime;
    [[N.A4, .26], [N.G4, .26], [N.E4, .42]].forEach(([f, d], i) =>
      note(f, d, { to: f * .94, type: 'triangle', gain: .18, at: t + i * .16, vibrato: 9 }));
    thump(70, .4, .28, t + .32);
  },
  error() {
    const t = ac().currentTime;
    [0, .1].forEach(d => note(210, .14, { to: 160, type: 'square', gain: .13, at: t + d }));
  },
  tab() { note(880, .07, { to: 1200, type: 'sine', gain: .11 }); },
  /* เหรียญตกเข้ากระเป๋า — ติ๊งโลหะใส ไล่เสียงสูงขึ้นทีละใบ */
  coin(step = 0) {
    const t = ac().currentTime;
    const scale = [N.C5, N.E5, N.G5, N.A5, N.C6, N.E6];     // ไล่เพนทาโทนิกให้ฟังไหลขึ้น
    const f = scale[Math.min(step, scale.length - 1)] * (step >= scale.length ? 2 : 1);
    note(f, .18, { type: 'triangle', gain: .16 });
    note(f * 2.01, .12, { type: 'sine', gain: .07, at: t + .01 });   // ฮาร์มอนิกโลหะ
    noise(.05, { gain: .07, hp: 6000, lp: 15000 });                  // เสียงเหรียญกระทบ
  },
  /* ชิพหล่นตอนแพ้ — เสียงชิพกระทบทื่อ ๆ แล้วหล่นต่ำลง */
  chipFall() {
    const t = ac().currentTime;
    noise(.07, { gain: .1, hp: 1200, lp: 6000 });
    note(420, .16, { to: 190, type: 'triangle', gain: .1, at: t + .01 });
    thump(110, .12, .16, t);
  },
  /* เหรียญใบสุดท้าย — ปิดท้ายแบบเครื่องคิดเงิน */
  coinEnd() {
    const t = ac().currentTime;
    [N.G5, N.C6, N.E6].forEach((f, i) =>
      note(f, .5, { type: 'triangle', gain: .17, at: t + i * .05, vibrato: 6 }));
    noise(.22, { gain: .1, hp: 5000, at: t + .04 });
    thump(120, .18, .25, t);
  },
};

/* ── ไข่สั่นรัว: เสียงสั่นต่อเนื่อง เร่งความแรงขึ้นเรื่อย ๆ ── */
let rumble = null;
function rumbleStart(dur = .45) {
  const c = ac(), t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(.05, t);
  g.gain.linearRampToValueAtTime(.42, t + dur);          // แรงขึ้นจนถึงจุดแตก
  g.connect(master);

  const saw = c.createOscillator(), lp = c.createBiquadFilter();
  saw.type = 'sawtooth'; saw.frequency.setValueAtTime(48, t);
  saw.frequency.linearRampToValueAtTime(96, t + dur);
  lp.type = 'lowpass'; lp.frequency.value = 900;
  saw.connect(lp).connect(g);

  // สั่นเป็นจังหวะรัว ๆ ให้รู้สึกไข่กระแทกรัง
  const trem = c.createOscillator(), tg = c.createGain();
  trem.type = 'square';
  trem.frequency.setValueAtTime(14, t);
  trem.frequency.linearRampToValueAtTime(30, t + dur);
  tg.gain.value = .5;
  trem.connect(tg).connect(g.gain);

  saw.start(t); trem.start(t);
  rumble = { g, saw, trem };
  // เศษหินกระทบเป็นระยะ
  for (let d = 0; d < dur; d += .055) noise(.05, { gain: .09 + d * .3, hp: 1800, at: t + d });
  rumbleStop.timer = setTimeout(() => rumbleStop(), dur * 1000 + 60);
}
function rumbleStop() {
  clearTimeout(rumbleStop.timer);
  if (!rumble) return;
  const c = ctx, t = c.currentTime;
  try {
    rumble.g.gain.cancelScheduledValues(t);
    rumble.g.gain.setValueAtTime(rumble.g.gain.value, t);
    rumble.g.gain.exponentialRampToValueAtTime(.0001, t + .06);
    rumble.saw.stop(t + .08); rumble.trem.stop(t + .08);
  } catch (e) {}
  rumble = null;
}

/* ══════════ เสียงพื้นหลัง — ลูปงานวัด/เครื่องเล่น ══════════
   อุ่ม-ป๊ะ เบสสลับคอร์ด + เมโลดี้ออร์แกนสองชั้น + กลองเบา ๆ  4 ห้อง วนไป
   ════════════════════════════════════════════════════════ */
const BPM = 142, STEP = 60 / BPM / 2;          // เขบ็ต
const BAR = 8, BARS = 4, LEN = BAR * BARS;

/* คอร์ดประจำห้อง: C · F · G · C */
const ROOT  = [65.41, 87.31, 98.00, 65.41];    // C2 F2 G2 C2
const FIFTH = [98.00, 130.81, 146.83, 98.00];  // G2 C3 D3 G2
const STAB  = [[262, 330, 392], [349, 440, 523], [392, 494, 587], [262, 330, 392]];

/* เมโลดี้ 32 เขบ็ต (0 = พัก) */
const MEL = [
  659, 784, 659, 523,  587, 659, 784, 0,       // C
  698, 880, 698, 523,  587, 523, 440, 0,       // F
  587, 784, 988, 784,  698, 587, 494, 0,       // G
  523, 659, 784, 1047, 784, 659, 523, 0,       // C
];

let step = 0, nextAt = 0, bgmTimer = null, bgmBus = null;

function bgmBusNode() {
  if (!bgmBus) { bgmBus = ac().createGain(); bgmBus.gain.value = .42; bgmBus.connect(master); }
  return bgmBus;
}

/* คอร์ดสั้น ๆ แบบอุ่ม-ป๊ะ */
function stab(freqs, at, bus) {
  freqs.forEach(f => note(f, .11, { type: 'square', gain: .045, at, attack: .004, bus }));
}

function schedule() {
  const c = ac(), bus = bgmBusNode();
  while (nextAt < c.currentTime + .3) {
    const s   = step % LEN;
    const bar = Math.floor(s / BAR);
    const b   = s % BAR;                          // 0..7 ในหนึ่งห้อง
    const t   = nextAt + (b % 2 ? STEP * .14 : 0); // สวิงให้เด้ง

    // อุ่ม (เบส) จังหวะ 1 กับ 3 · ป๊ะ (คอร์ด) จังหวะ 2 กับ 4
    if (b === 0) note(ROOT[bar],  .17, { type: 'square', gain: .1, at: t, bus });
    if (b === 4) note(FIFTH[bar], .17, { type: 'square', gain: .09, at: t, bus });
    if (b === 2 || b === 6) stab(STAB[bar], t, bus);

    // เมโลดี้ออร์แกน — ซ้อนสองชั้นเพี้ยนเล็กน้อยให้ฟังหนาแบบเครื่องเล่น
    const m = MEL[s];
    if (m) {
      const long = b === 0 || b === 4;
      note(m, long ? .2 : .14, { type: 'square', gain: .085, at: t, bus, detune: -7 });
      note(m, long ? .2 : .14, { type: 'triangle', gain: .07, at: t, bus, detune: 9 });
    }

    // กลอง
    if (b === 0 || b === 4) thump(72, .13, .2, t);                       // คิก
    if (b === 2 || b === 6) noise(.09, { gain: .07, hp: 1600, lp: 7000, at: t, bus }); // สแนร์เบา
    if (b % 2 === 1) noise(.035, { gain: .04, hp: 8000, at: t, bus });   // ไฮแฮต
    if (s === LEN - 1) noise(.14, { gain: .08, hp: 3000, at: t, bus });  // ฉาบปิดท้ายลูป

    nextAt += STEP; step++;
  }
  bgmTimer = setTimeout(schedule, 60);
}
function startBgm() {
  if (!on.bgm) return;
  if (FILES.bgm) {                         // มีไฟล์เพลง — เล่นวนจากไฟล์
    if (!bgmEl) {
      bgmEl = new Audio(FILES.bgm);
      bgmEl.loop = true;
      bgmEl.volume = VOL.bgm;
    }
    bgmEl.play().catch(() => {});
    return;
  }
  if (bgmTimer) return;
  step = 0;
  nextAt = ac().currentTime + .1;
  schedule();
}
function stopBgm() {
  if (bgmEl) { bgmEl.pause(); bgmEl.currentTime = 0; }
  clearTimeout(bgmTimer); bgmTimer = null;
}

/* เลือกประโยคแบบ "จับสลากในถุง" — สุ่มลำดับใหม่ทุกครั้งที่ครบรอบ
   จึงได้ยินครบทุกประโยคก่อนวนซ้ำ และไม่มีประโยคเดิมติดกันสองครั้ง */
const bags = {};
function pick(name, list) {
  if (list.length === 1) return list[0];
  let bag = bags[name];
  if (!bag || !bag.length) {
    bag = list.slice();
    for (let i = bag.length - 1; i > 0; i--) {          // สลับลำดับ
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // กันไม่ให้ใบแรกของถุงใหม่ ซ้ำกับใบสุดท้ายที่เพิ่งเล่นไป
    if (bag[0] === lastSaid[name] && bag.length > 1) [bag[0], bag[1]] = [bag[1], bag[0]];
    bags[name] = bag;
  }
  const item = bag.pop();
  lastSaid[name] = item;
  return item;
}
const lastSaid = {};

/* เล่นเสียงพากย์ — ตัดเสียงพากย์เดิมที่ยังค้างอยู่ก่อนเสมอ จะได้ไม่พูดทับกัน */
function say(name) {
  const list = VOICE[name];
  if (!list || !list.length) return;
  stopVoice();
  voiceEl = new Audio(pick(name, list));
  voiceEl.volume = VOL.voice;
  voiceEl.play().catch(() => {});
}
function stopVoice() {
  if (voiceEl) { voiceEl.pause(); voiceEl.currentTime = 0; voiceEl = null; }
}

/* บางเบราว์เซอร์ (โดยเฉพาะตอนเปิดไฟล์ตรง ๆ) พัก AudioContext ไว้
   ปลุกซ้ำทุกครั้งที่ผู้ใช้แตะ/คลิก จะได้ไม่เงียบไปทั้งเกม */
['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => {
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }, { passive: true }));

window.Sfx = {
  /* เสียงพากย์ — ใช้สวิตช์เดียวกับเสียงเอฟเฟกต์ */
  say(name) { if (!on.fx) return; try { say(name); } catch (e) {} },
  play(name, arg) {
    if (!on.fx) return;
    try { if (playFile(name)) return; } catch (e) {}
    if (SFX[name]) { try { SFX[name](arg); } catch (e) {} }
  },
  rumble(v)  { if (!on.fx) return; try { v ? rumbleStart() : rumbleStop(); } catch (e) {} },
  setFx(v)   { on.fx = v; if (!v) { rumbleStop(); stopVoice(); } else this.play('tab'); },
  setBgm(v)  { on.bgm = v; v ? startBgm() : stopBgm(); },
  start() {
    try {
      ac();
      Object.entries(FILES).forEach(([k, url]) => { if (url && k !== 'bgm') loadFile(k, url); });
      startBgm();
    } catch (e) {}
  },
};
})();
