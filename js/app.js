/* ============================================================
   minigame odd-even — flow ตาม Figma
   loading → เริ่มต้น → เลือกฝั่ง → รอประมวลผล → ออกผล → แทงซ้ำ
   ============================================================ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── ค่าคงที่ของเกม ── */
const PAYOUT      = 1.95;
const MIN_BET     = 10;
const TABLE_MAX   = 5000;
const RESULT_MS   = 4500;   // ค้าง you win / you lose 4–5 วิ
const TOAST_MS    = 1500;   // แจ้งเตือน 1.5 วิ
const LOAD_MS     = 2400;
const BET_SEC     = 30;     // เวลาเดิมพันต่อรอบ (วินาที)
/* ชิพมี 2 variant ตาม component: Default 40px (หรี่มาในตัว) · Active 50px (เต็มสี + วงแหวน) */
const chip = (key, value) => ({ key, value,
  def:`assets/chip/d-${key}.png`, act:`assets/chip/a-${key}.png`, img:`assets/chip/a-${key}.png` });
const CHIPS = [
  chip('5',5), chip('10',10), chip('20',20), chip('50',50), chip('100',100),
  chip('500',500), chip('1k',1000), chip('2k',2000), chip('5k',5000),
];

/* ── state ── */
const state = {
  phase   : 'idle',      // idle | placed | rolling | revealed
  balance : 21525.56,
  chip    : CHIPS[3],    // ชิพที่เลือกอยู่ (ค่าเริ่มต้น 50 ตามดีไซน์)
  side    : null,        // 'even' | 'odd'
  amount  : 0,
  stack   : [],          // ชิพที่วางไว้ในรอบนี้ เรียงตามลำดับที่วาง
  lastBet : null,        // { side, amount } ของรอบก่อน — ใช้กับปุ่มแทงซ้ำ
  mineRow : null,        // การ์ดประวัติของรอบที่กำลังเล่น
  outcome : null,        // { res, win } ของรอบที่เพิ่งออกผล
  board   : [],
  mine    : [],
  winStreak: 0,          // ชนะติดต่อกันกี่ครั้ง — ครบ 3 ใช้เสียงพากย์ชุดพิเศษ
};

/* ── helpers ── */
const money = n => '฿ ' + n.toLocaleString('th-TH', { minimumFractionDigits:2, maximumFractionDigits:2 });
const rand  = n => Math.floor(Math.random() * n);
const hex   = n => [...Array(n)].map(() => '0123456789abcdef'[rand(16)]).join('');

/* ══════════ 1. หน้า loading ══════════ */
function runLoading() {
  const fill = $('#load-fill'), pct = $('#load-pct'), mascot = $('#load-mascot');
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min(1, (now - t0) / LOAD_MS);
    fill.style.width = (p * 100).toFixed(1) + '%';
    mascot.style.left = (p * 100).toFixed(1) + '%';
    pct.textContent  = Math.round(p * 100) + '%';
    if (p < 1) requestAnimationFrame(step);
    else { $('#loadbar').hidden = true; $('#btn-start').hidden = false; }
  })(t0);
}

$('#btn-start').addEventListener('click', () => {
  Sfx.start(); Sfx.play('confirm');
  $('#screen-loading').classList.remove('is-active');
  $('#screen-game').classList.add('is-active');
  newRound(true);
  centerChip(false);
});

/* ══════════ ชิพ ══════════ */
function buildChips() {
  const rail = $('#chip-rail');
  rail.innerHTML = '';
  CHIPS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    const on = c.key === state.chip.key;
    b.className = 'chip chip--value' + (on ? ' is-active' : '');
    b.dataset.key = c.key;
    b.innerHTML = `<img src="${on ? c.act : c.def}" alt="${c.key}">`;
    b.addEventListener('click', () => pickChip(c));
    rail.appendChild(b);
  });
  centerChip(false);
}

/* เลื่อนชิพที่เลือกมาไว้กึ่งกลางราง (ตามดีไซน์ที่ชิพ active อยู่กลาง track) */
function centerChip(smooth = true) {
  const rail = $('#chip-rail'), act = $('.chip--value.is-active', rail);
  if (!act || !rail.clientWidth) return;
  rail.scrollTo({ left: act.offsetLeft - (rail.clientWidth - act.offsetWidth) / 2,
                  behavior: smooth ? 'smooth' : 'auto' });
}

function pickChip(c) {
  state.chip = c;
  Sfx.play('chip');
  $$('.chip--value').forEach(el => {
    const on = el.dataset.key === c.key;
    el.classList.toggle('is-active', on);
    const d = CHIPS.find(x => x.key === el.dataset.key);
    $('img', el).src = on ? d.act : d.def;
  });
  $$('.chip--side').forEach(el => el.classList.remove('is-active'));
  centerChip();
}

function pickSideChip(btn, chip) {
  state.chip = chip;
  Sfx.play('chip');
  $$('.chip--value').forEach(el => el.classList.remove('is-active'));
  $$('.chip--side').forEach(el => el.classList.toggle('is-active', el === btn));
}
$('#chip-allin').addEventListener('click', e =>
  pickSideChip(e.currentTarget, { key:'allin', value:Math.max(MIN_BET, Math.floor(state.balance)), img:'assets/chip/a-allin.png' }));
$('#chip-max').addEventListener('click', e =>
  pickSideChip(e.currentTarget, { key:'max', value:TABLE_MAX, img:'assets/chip/a-max.png' }));

$('.barchip__nav--prev').addEventListener('click', () => $('#chip-rail').scrollBy({ left:-96 }));
$('.barchip__nav--next').addEventListener('click', () => $('#chip-rail').scrollBy({ left: 96 }));

/* ══════════ แจ้งเตือน inline 1.5 วิ ══════════ */
let toastTimer;
function toast(msg) {
  const el = $('#inline-error');
  $('#inline-error-text').textContent = msg;
  el.classList.add('is-on');
  Sfx.play('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), TOAST_MS);
}

/* ══════════ 2–3. เลือกฝั่ง / วางชิพ ══════════ */
function placeBet(side) {
  if (state.phase === 'rolling' || state.phase === 'revealed') return;

  // 6. เปลี่ยนฝั่งต้องกดยกเลิกก่อนเสมอ
  if (state.side && state.side !== side) {
    toast('แทงได้ฝั่งเดียว · กดยกเลิกถ้าจะเปลี่ยนฝั่ง');
    return;
  }

  const add = Math.max(MIN_BET, state.chip.value);
  // 7. เครดิตไม่พอ
  if (add > state.balance - state.amount || state.balance < MIN_BET) {
    toast('ยอดเงินของคุณไม่พอ');
    Sfx.say('lowCredit');
    return;
  }

  const from = chipRect();            // ตำแหน่งชิพในรางก่อนวาด เพื่อให้ไหลจากจุดนี้
  Sfx.say(side === 'even' ? 'placeEven' : 'placeOdd');   // พากย์บอกฝั่งทุกครั้งที่วางชิพ
  state.side   = side;
  state.amount += add;
  state.stack.push(state.chip);
  state.phase  = 'placed';
  Sfx.play('place');
  render();
  flyIn(from);
}

$('#bet-even').addEventListener('click', () => placeBet('even'));
$('#bet-odd') .addEventListener('click', () => placeBet('odd'));

$('#btn-cancel').addEventListener('click', () => {
  flyOut();                           // ชิพไหลย้อนกลับเข้าราง ก่อนล้างกอง
  state.side = null; state.amount = 0; state.stack = []; state.phase = 'idle'; state.outcome = null;
  Sfx.play('cancel');
  render();
});

$('#btn-repeat').addEventListener('click', () => {
  if (!state.lastBet) return;
  if (state.lastBet.amount > state.balance) { toast('ยอดเงินของคุณไม่พอ'); return; }
  state.side   = state.lastBet.side;
  state.amount = state.lastBet.amount;
  state.stack  = state.lastBet.stack.slice();
  state.phase  = 'placed';
  Sfx.play('place');
  render();
  flyIn(chipRect());
});

/* ══════════ 4. ยืนยัน → รอประมวลผล → ออกผล ══════════ */
$('#btn-confirm').addEventListener('click', () => {
  if (state.phase !== 'placed') return;
  Sfx.play('confirm');
  Sfx.say('confirm');
  state.balance -= state.amount;
  state.lastBet  = { side: state.side, amount: state.amount, stack: state.stack.slice() };
  state.mineRow  = pushMine({ side: state.side, amount: state.amount, code: maskedSeed() });
  state.phase    = 'rolling';
  stopTimer();
  $('#timer').hidden = true;
  render();
  roll();
});

async function roll({ watch = false } = {}) {
  const { eggs, sum } = await EggReveal.playReveal($('#eggs'), EggReveal.drawEggs());
  const res  = sum % 2 === 0 ? 'even' : 'odd';
  const text = `${eggs.join(' + ')} = ${sum} · ${res === 'even' ? 'คู่' : 'คี่'}`;

  revealFairness(res);

  // รอบดูเฉย ๆ — ลงกระดานผลอย่างเดียว แล้วต่อรอบเดิมพันใหม่ให้เอง
  if (watch) {
    state.outcome = { res, win: false, text };
    pushBoard(res);
    render();
    setTimeout(newRound, RESULT_MS);
    return;
  }

  const win    = res === state.side;
  const payout = win ? state.amount * PAYOUT : 0;
  state.outcome = { res, win, text };
  if (win) { state.balance += payout; state.shown = state.balance - payout; }

  pushBoard(res);
  // ชนะ = ยอดที่ได้รับเต็ม (1.95 เท่า) · แพ้ = เงินเดิมพันที่เสียไป — ตามดีไซน์
  settleMine(state.mineRow, { res, sum, win,
    delta: win ? payout : -state.amount, code: fullSeed(res) });

  // popup you win / you lose ค้าง 1.5 วิ
  const pop = $('#stage-pop');
  $('#pop-art').src = win ? 'assets/img/stage-win.png' : 'assets/img/stage-lose.png';
  $('#pop-amount').querySelector('b').textContent =
    (win ? '+' : '-') + (win ? payout : state.amount).toLocaleString('th-TH', { minimumFractionDigits:2, maximumFractionDigits:2 });
  pop.classList.toggle('is-lose', !win);
  pop.classList.add('is-on');
  Sfx.play(win ? 'win' : 'lose');
  state.winStreak = win ? state.winStreak + 1 : 0;
  Sfx.say(win ? (state.winStreak >= 3 ? 'winStreak' : 'win') : 'lose');

  state.phase = 'revealed';
  render();

  setTimeout(() => {
    pop.classList.remove('is-on');
    if (win) flyCoins(payout);           // เหรียญไหลจาก popup เข้ายอดเงิน
    else     dropCoins();                // แพ้ — เหรียญร่วงจากยอดเงิน
  }, RESULT_MS);
}

/* ══════════ แพ้ — เหรียญร่วงจากยอดเงิน ══════════
   ยิงเหรียญออกจากไอคอนยอดเงินบน header ให้ร่วงลงข้างล่าง กระจายซ้ายขวา แล้วจางหาย */
const DROP_N = 8, DROP_MS = 760, DROP_GAP = 70;

function dropCoins() {
  const src = $('.balance__icon');
  if (!src) return;
  const r = src.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  for (let i = 0; i < DROP_N; i++) {
    const el = document.createElement('div');
    el.className = 'coin-fly';
    el.innerHTML = '<img src="assets/icon/baht.svg" alt="">';
    el.style.cssText += `left:${cx - 14}px;top:${cy - 14}px`;
    document.body.appendChild(el);

    const dx = (Math.random() - .5) * 120;                       // กระจายซ้ายขวา
    const spin = (Math.random() < .5 ? -1 : 1) * (200 + Math.random() * 160);
    const a = el.animate([
      { transform: 'translate(0,0) scale(.5) rotate(0deg)', opacity: 0 },
      { transform: `translate(${dx * .25}px,-14px) scale(1) rotate(${spin * .15}deg)`, opacity: 1, offset: .16 },
      { transform: `translate(${dx}px,150px) scale(.85) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: DROP_MS, delay: i * DROP_GAP, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'backwards' });
    a.finished.then(() => el.remove(), () => el.remove());

    if (window.Sfx) setTimeout(() => Sfx.play('chipFall'), i * DROP_GAP);
  }
}

/* ══════════ เหรียญรางวัลไหลเข้ายอดเงิน ══════════
   ยิงเหรียญจากกลาง popup you win ไล่ทีละใบไปรวมที่ไอคอนยอดเงินบน header
   ทุกใบที่ถึงปลายทาง ยอดเงินจะไต่ขึ้นตามสัดส่วน จนครบเท่ารางวัลพอดี */
const COIN_N = 12, COIN_MS = 620, COIN_GAP = 45;
let coinRun = 0;                       // กันเหรียญรอบก่อนที่ยังค้าง มาเขียนยอดของรอบใหม่

function flyCoins(payout) {
  const pop = $('#stage-pop'), dest = $('.balance__icon');
  if (!pop || !dest) { state.shown = null; render(); return; }
  const p = pop.getBoundingClientRect(), d = dest.getBoundingClientRect();
  const tx = d.left + d.width / 2, ty = d.top + d.height / 2;
  const base = state.balance - payout, run = ++coinRun;
  let landed = 0;

  for (let i = 0; i < COIN_N; i++) {
    const el = document.createElement('div');
    el.className = 'coin-fly';
    el.innerHTML = '<img src="assets/icon/baht.svg" alt="">';
    el.style.cssText += `left:${tx - 14}px;top:${ty - 14}px`;
    document.body.appendChild(el);

    // กระจายจุดเริ่มรอบกลาง popup ให้ไม่ซ้อนกันเป๊ะ
    const dx = p.left + p.width / 2 + (Math.random() - .5) * p.width * .45 - tx;
    const dy = p.top + p.height / 2 + (Math.random() - .5) * p.height * .3 - ty;
    const spin = Math.random() < .5 ? -1 : 1;

    const a = el.animate([
      { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${dx * .92}px,${dy * .92 - 10}px) scale(1) rotate(${90 * spin}deg)`,
        opacity: 1, offset: .14 },
      { transform: `translate(${dx * .4}px,${dy * .4 - 80}px) scale(.92) rotate(${280 * spin}deg)`,
        opacity: 1, offset: .62 },
      { transform: `translate(0,0) scale(.45) rotate(${480 * spin}deg)`, opacity: .15 },
    ], { duration: COIN_MS, delay: i * COIN_GAP, easing: 'cubic-bezier(.4,.1,.35,1)', fill: 'backwards' });

    const done = () => {
      el.remove();
      if (run !== coinRun) return;       // ข้ามรอบไปแล้ว ไม่ต้องแตะยอด
      landed++;
      state.shown = landed >= COIN_N ? null : base + payout * (landed / COIN_N);
      render();
      const bal = $('.balance');
      bal.classList.remove('is-tick'); void bal.offsetWidth; bal.classList.add('is-tick');
      // เสียงเหรียญเข้ากระเป๋า ไล่สูงขึ้นทีละใบ แล้วปิดท้ายตอนใบสุดท้าย
      if (window.Sfx) Sfx.play(landed >= COIN_N ? 'coinEnd' : 'coin', landed - 1);
    };
    a.finished.then(done, () => el.remove());
  }
}

/* ── รีเซ็ตไข่กลับเป็นใบที่ยังไม่แตก ── */
function resetEggs() {
  EggReveal.mountEggs($('#eggs'));
}

/* ══════════ 5. เริ่มรอบใหม่ → หน้าแทงซ้ำ ══════════ */
$('#btn-newround').addEventListener('click', () => newRound(false));

function newRound() {
  state.phase = 'idle'; state.side = null; state.amount = 0; state.stack = []; state.outcome = null;
  state.shown = null; coinRun++;
  resetEggs();
  $('#stage-pop').classList.remove('is-on');
  resetFairness();
  render();
  startTimer();
  Sfx.say('roundStart');
}

/* ══════════ นับถอยหลังเวลาเดิมพัน ══════════
   ให้ผู้เล่นเห็นว่าเหลือเวลาตัดสินใจอีกเท่าไหร่ (ดูเค้าไพ่ประกอบได้)
   หมดเวลา · วางเดิมพันไว้แล้ว → ยืนยันให้อัตโนมัติ
   หมดเวลา · ยังไม่วาง        → เตือนแล้วเริ่มนับใหม่ กระตุ้นให้ลงเดิมพัน */
let timerId = null, timeLeft = 0;

function startTimer() {
  stopTimer();
  timeLeft = BET_SEC;
  paintTimer();
  $('#timer').hidden = false;
  timerId = setInterval(() => {
    timeLeft -= 1;
    paintTimer();
    // เร่งช่วง 10 วิสุดท้าย เฉพาะตอนที่ยังไม่ได้วางเดิมพัน
    if (timeLeft === 10 && state.phase !== 'placed') Sfx.say('hurry');
    if (timeLeft <= 0) {
      stopTimer();
      if (state.phase === 'placed') $('#btn-confirm').click();
      else watchRound();
    }
  }, 1000);
}

function stopTimer() { clearInterval(timerId); timerId = null; }

/* รอบที่ผู้เล่นไม่ได้ลงเดิมพัน — เกมยังออกผลตามปกติและบันทึกลงกระดานผล
   ผู้เล่นจึงเห็นแนวโน้มต่อเนื่องไว้ใช้ตัดสินใจรอบถัดไป (ไม่ตัดเครดิต ไม่ขึ้นประวัติ) */
function watchRound() {
  toast('หมดเวลา · รอบนี้ไม่มีเดิมพัน ดูผลเพื่อจับแนวโน้ม');
  Sfx.say('noBet');
  state.phase = 'rolling';
  $('#timer').hidden = true;
  render();
  roll({ watch: true });
}

function paintTimer() {
  $('#timer-num').textContent = Math.max(0, timeLeft);
  $('#timer').classList.toggle('is-urgent', timeLeft <= 10);
}

/* ══════════ Provably fair panel ══════════
   รูปแบบโค้ดตามดีไซน์ — 23 ตัว + เครื่องหมายผล + 18 ตัว + 3 ตัวท้ายพิมพ์ใหญ่ รวม 47 ตัว
   เช่น 715648b66020cb945ab4611-O-b359ceed5d4b648501ZXC (พอดีบรรทัดเดียวในช่อง 318px) */
const SEED_LEN = 44, SEED_SPLIT = 23;
let seed = '';
const seedTail   = () => seed.slice(-3).toUpperCase();
const maskedSeed = () => '•'.repeat(33) + seedTail();
const fullSeed   = res => seed.slice(0, SEED_SPLIT) + RES_MARK[res] +
                          seed.slice(SEED_SPLIT, -3) + seedTail();
let announcedHash = '';

/* เครื่องหมายผลกลางโค้ด — ออกคู่ใส่ -O- · ออกคี่ใส่ -E- */
const RES_MARK = { even: '-O-', odd: '-E-' };

function resetFairness() {
  seed = hex(SEED_LEN);
  announcedHash = hex(SEED_LEN);    // ประกาศก่อนเดิมพัน เปลี่ยนไม่ได้อีกหลังจากนี้
  $('#fair-seed').textContent = '•'.repeat(44) + seedTail();
  $('#fair-hash').textContent = announcedHash;
  $('#fair-status').className = 'pill pill--wait';
  $('#fair-status-text').textContent = 'รอออกผล';
  $('#fair').classList.remove('is-done');
}
function revealFairness(res) {
  // เน้นเครื่องหมายผลด้วยสีฟ้า ให้เห็นชัดว่าโค้ดนี้ออกฝั่งไหน (คัดลอกยังได้ข้อความเต็ม)
  $('#fair-seed').innerHTML =
    `${seed.slice(0, SEED_SPLIT)}<span class="fair__mark">${RES_MARK[res]}</span>` +
    `${seed.slice(SEED_SPLIT, -3)}${seedTail()}`;
  $('#fair').classList.add('is-done');
  $('#fair-status').className = 'pill pill--done';
  $('#fair-status-text').textContent = 'ออกผลแล้ว';
}

$('#fair-toggle').addEventListener('click', e => {
  const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
  e.currentTarget.setAttribute('aria-expanded', String(!open));
  $('#fair-body').hidden = open;
  $('#fair').classList.toggle('is-open', !open);
  Sfx.play('tab');
});

$$('.fair__copy').forEach(btn => btn.addEventListener('click', async () => {
  const txt = $(btn.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(txt); } catch (e) {}
  btn.classList.add('is-done');
  Sfx.play('chip');
  setTimeout(() => btn.classList.remove('is-done'), 900);
}));

/* ══════════ 10. เค้าไพ่ + ประวัติ ══════════ */
function pushBoard(res, silent) {
  state.board.push(res);
  // รอบแรก — เปลี่ยนจากกล่องว่างเป็นตารางเค้าไพ่
  $('#board-empty').hidden = true;
  $('#panel-board').hidden = false;
  const grid = $('#board-grid');
  const prev = state.board[state.board.length - 2];
  let col = +(grid.dataset.col || 1), row = +(grid.dataset.row || 0);
  if (res === prev && row < 6) row += 1; else { if (row) col += 1; row = 1; }
  grid.dataset.col = col; grid.dataset.row = row;

  const i = document.createElement('i');
  i.dataset.r = res;
  i.style.gridColumn = col;
  i.style.gridRow = row;
  if (!silent) i.classList.add('is-new');
  grid.appendChild(i);
  $('#panel-board').scrollLeft = $('#panel-board').scrollWidth;
}

/* การ์ดประวัติ — component "History bet" · สร้างตอนยืนยันเดิมพัน (waiting)
   แล้วอัปเดตเป็น win / lose ตอนออกผล */
const pad2 = n => String(n).padStart(2, '0');

function pushMine({ side, amount, code }) {
  const now = new Date();
  const li = document.createElement('li');
  li.className = 'bethist is-new';
  li.dataset.state = 'waiting';
  li.innerHTML =
    '<div class="bethist__row">' +
      `<span class="bethist__time">${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}</span>` +
      '<span class="bethist__col">' +
        '<span class="bethist__k">แทง</span>' +
        `<span class="bethist__v" data-side="${side}">${side === 'even' ? 'คู่' : 'คี่'}</span>` +
      '</span>' +
      '<span class="bethist__col">' +
        '<span class="bethist__k bethist__k--muted">ออก</span>' +
        '<span class="bethist__v bethist__v--muted" data-slot="out">-</span>' +
      '</span>' +
      '<span class="bethist__col">' +
        '<span class="bethist__k">เดิมพัน</span>' +
        `<span class="bethist__v">${amount.toLocaleString('th-TH')}</span>` +
      '</span>' +
      '<span class="bethist__col bethist__col--amt">' +
        '<span class="bethist__k" data-slot="label">กำลังออกผล</span>' +
        '<span class="bethist__v" data-slot="amount">-</span>' +
      '</span>' +
    '</div>' +
    '<div class="bethist__seed">' +
      `<span class="bethist__date">${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}</span>` +
      '<span class="bethist__sep"></span>' +
      `<span class="bethist__code" data-slot="code">${code}</span>` +
    '</div>';
  $('#mine-list').prepend(li);
  $('#mine-empty').hidden = true;
  return li;
}

function settleMine(li, { res, sum, win, delta, code }) {
  if (!li) return;
  li.dataset.state = win ? 'win' : 'lose';
  const out = $('[data-slot="out"]', li);
  out.textContent = `${res === 'even' ? 'คู่' : 'คี่'} · ${sum}`;
  out.dataset.side = res;
  out.classList.remove('bethist__v--muted');
  $('.bethist__k--muted', li).classList.remove('bethist__k--muted');
  $('[data-slot="label"]', li).textContent = win ? 'ชนะ' : 'แพ้';
  $('[data-slot="amount"]', li).textContent =
    (win ? '+' : '−') + Math.abs(delta).toLocaleString('th-TH', { minimumFractionDigits:2, maximumFractionDigits:2 });
  $('[data-slot="code"]', li).textContent = code;
}

$$('.tabs__tab').forEach(t => t.addEventListener('click', () => {
  Sfx.play('tab');
  $$('.tabs__tab').forEach(x => x.classList.toggle('is-active', x === t));
  const board = t.dataset.tab === 'board';
  const empty = state.board.length === 0;          // ยังไม่มีผลรอบไหน → กระดานว่าง
  $('#board-empty').hidden = !board || !empty;
  $('#panel-board').hidden = !board || empty;
  $('#panel-mine').hidden  = board;
}));

/* ══════════ 8. ตั้งค่าเสียง ══════════ */
const dimSound = $('#dim-sound');
$('#btn-sound').addEventListener('click', () => { dimSound.hidden = false; Sfx.play('tab'); });
/* เบราว์เซอร์จำสถานะ checkbox ข้ามการรีเฟรชได้ ถ้าไม่รีเซ็ตให้ตรงกับค่าเริ่มต้น
   ผู้เล่นอาจเจอหน้าเงียบทั้งที่ยังไม่ได้ปิดเสียงเอง */
$('#sw-fx').checked = true;
$('#sw-bgm').checked = true;

$('#sw-fx').addEventListener('change',  e => Sfx.setFx(e.target.checked));
$('#sw-bgm').addEventListener('change', e => Sfx.setBgm(e.target.checked));
$('#btn-sound-close').addEventListener('click', () => { dimSound.hidden = true; });
dimSound.addEventListener('click', e => { if (e.target === dimSound) dimSound.hidden = true; });

/* ══════════ 9. กติกา ══════════ */
const dimRules = $('#dim-rules');
$('#btn-rules').addEventListener('click', () => { dimRules.hidden = false; Sfx.play('tab'); });
$('#btn-rules-ok').addEventListener('click', () => { dimRules.hidden = true; });
dimRules.addEventListener('click', e => { if (e.target === dimRules) dimRules.hidden = true; });

/* ══════════ render ══════════ */
function render() {
  // ยอดเงิน
  const shown = state.shown != null ? state.shown : state.balance;
  const [i, d] = shown.toLocaleString('th-TH', { minimumFractionDigits:2, maximumFractionDigits:2 }).split('.');
  $('#bal-int').textContent = i;
  $('#bal-dec').textContent = '.' + d;

  // สเตทของการ์ดเดิมพัน: active / bet win / bet lose / result
  const o = state.outcome;
  $$('.betcard').forEach(card => {
    const side   = card.dataset.side;
    const picked = state.side === side && state.amount > 0;
    card.classList.toggle('is-picked', picked);
    card.classList.toggle('is-win',    picked && !!o && o.win);
    card.classList.toggle('is-lose',   picked && !!o && !o.win);
    card.classList.toggle('is-result', !picked && !!o && o.res === side);
    const wrap = $('.betcard__chip', card);
    if (picked) drawStack(wrap);
    else if (wrap.dataset.sig) { wrap.innerHTML = ''; delete wrap.dataset.sig; }
  });

  // สรุปยอด
  $('#sum-bet').textContent = money(state.amount);
  $('#sum-win').textContent = money(state.amount * PAYOUT);

  // ข้อความบนเวที — idle: ชวนเลือก · วางแล้ว: ยอดเดิมพัน · ออกผล: ผลรวม (สีสว่าง)
  const hint = $('#hint');
  hint.classList.toggle('is-result', !!o);
  hint.textContent = o ? o.text
    : state.amount > 0
      ? `เดิมพัน${state.side === 'even' ? 'คู่' : 'คี่'} : ${money(state.amount).replace('฿ ', '')}`
    : 'เลือกจำนวนเงินแล้วเลือกฝั่ง';

  // ปุ่ม
  const p = state.phase;
  $('#btn-cancel') .disabled = p !== 'placed';
  $('#btn-repeat') .disabled = !(p === 'idle' && state.lastBet);
  $('#btn-confirm').disabled = p !== 'placed';
  $('#actions').hidden        = p === 'revealed';
  $('#btn-newround').hidden   = p !== 'revealed';
}

/* กองชิพบนการ์ด — แสดงได้สูงสุด MAX_STACK ใบ เกินนั้นบอกเป็นจำนวน */
const MAX_STACK = 5;
function drawStack(wrap) {
  const st = state.stack;
  const sig = st.map(c => c.key).join(',');
  if (wrap.dataset.sig === sig) return;      // ไม่มีอะไรเปลี่ยน ไม่ต้องวาดใหม่
  wrap.dataset.sig = sig;
  const shown = st.slice(-MAX_STACK);
  const extra = st.length - shown.length;
  wrap.innerHTML =
    (extra ? `<span class="betcard__chip-more">+${extra}</span>` : '') +
    shown.map((c, i) =>
      `<span class="betcard__chip-item${i === shown.length - 1 ? ' is-new' : ''}">` +
      `<img src="${c.img}" alt=""></span>`).join('');
}

/* ══════════ ชิพไหลเข้า-ไหลย้อนกลับ ══════════
   วางเดิมพัน = ชิพไหลจากรางขึ้นโค้งไปลงบนการ์ด · ยกเลิก = ไหลย้อนกลับเข้าราง
   ใช้ตัวโคลนลอยบน body ตัวจริงบนการ์ดซ่อนไว้จนกว่าจะไหลถึง */
const FLY_MS = 340;

/* กรอบของชิพที่เลือกอยู่ในราง (หรือปุ่ม ALL IN / MAX) */
function chipRect() {
  const el = $('.chip--value.is-active') || $('.chip--side.is-active');
  return el ? el.getBoundingClientRect() : null;
}

function flyChip(src, from, to, { ms = FLY_MS, spin = 1, delay = 0 } = {}) {
  const el = document.createElement('div');
  el.className = 'chip-fly';
  el.innerHTML = `<img src="${src}" alt="">`;
  el.style.cssText += `left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px`;
  document.body.appendChild(el);

  const dx = from.left - to.left, dy = from.top - to.top;
  const s0 = from.width / to.width;                        // ย่อ-ขยายให้เท่าขนาดปลายทาง
  const lift = Math.min(90, Math.hypot(dx, dy) * .3 + 24); // ความโค้งกลางทาง
  const a = el.animate([
    { transform: `translate(${dx}px,${dy}px) scale(${s0}) rotate(0deg)`, opacity: .85 },
    { transform: `translate(${dx * .45}px,${dy * .45 - lift}px) scale(${(s0 + 1) / 2}) rotate(${180 * spin}deg)`,
      opacity: 1, offset: .55 },
    { transform: `translate(0,0) scale(1) rotate(${360 * spin}deg)`, opacity: 1 },
  ], { duration: ms, delay, easing: 'cubic-bezier(.3,.75,.3,1)', fill: 'backwards' });
  return a.finished.then(() => el.remove(), () => el.remove());
}

/* ชิพใบล่าสุดไหลจากราง → การ์ด */
function flyIn(from) {
  if (!from) return;
  const card = $(state.side === 'even' ? '#bet-even' : '#bet-odd');
  const items = $$('.betcard__chip-item', card);
  const item = items[items.length - 1];
  if (!item) return;
  item.classList.remove('is-new');                 // ใช้การไหลแทนอนิเมชั่นหล่นเดิม
  item.classList.add('is-flying');
  flyChip(item.querySelector('img').src, from, item.getBoundingClientRect())
    .then(() => item.classList.remove('is-flying'));
}

/* ชิพทั้งกองไหลย้อนกลับเข้าราง (เรียกก่อนล้าง state) */
function flyOut() {
  const to = chipRect();
  const card = $(state.side === 'even' ? '#bet-even' : '#bet-odd');
  if (!to || !card) return;
  $$('.betcard__chip-item', card).reverse().forEach((item, i) => {
    const img = item.querySelector('img');
    if (!img) return;
    flyChip(img.src, item.getBoundingClientRect(), to, { spin: -1, delay: i * 70 });
  });
}

/* ══════════ boot ══════════ */
buildChips();
resetFairness();
render();
runLoading();

})();
