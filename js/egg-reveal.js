/* ============================================================
   อนิเมชั่นไข่ออกผล — ใช้ร่วมกันทั้งหน้าเกมและหน้า preview
   เด้ง ดึ้ง ๆ → สั่นรัว → แตกออกมาพร้อมเลข
   ============================================================ */
(() => {
'use strict';

/* จังหวะรวม 5.5 วิ (ปรับได้ที่นี่ที่เดียว) */
const T = {
  hop     : 4200,   // ช่วงเด้ง
  shiver  : 400,    // ช่วงสั่นรัวก่อนแตก
  stagger : 120,    // ระยะห่างการแตกของแต่ละใบ
  settle  : 640,    // หลังใบสุดท้ายแตก ก่อนจบ
};
const TOTAL = T.hop + T.shiver + T.stagger * 2 + T.settle;   // = 5480ms

/* สุ่มไข่ 3 ใบ ใบละ 0–9 แล้วนำมาบวกกันเป็นผลรวม (0–27) */
function drawEggs() {
  return [rand(10), rand(10), rand(10)];
}
const rand = n => Math.floor(Math.random() * n);

/* สร้างมาร์กอัปไข่ 3 ใบลงใน container */
function mountEggs(host) {
  host.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'egg';
    el.innerHTML =
      '<div class="egg__shadow"></div>' +
      '<img class="egg__img" src="assets/egg/closed.png" alt="">' +
      '<div class="egg__flash"></div>';
    host.appendChild(el);
  }
  return [...host.children];
}

/* เล่นอนิเมชั่น คืน Promise พร้อมผลลัพธ์ */
function playReveal(host, eggs = drawEggs()) {
  const cells = [...host.children].length ? [...host.children] : mountEggs(host);
  const timers = [];
  const wait = (ms, fn) => timers.push(setTimeout(fn, ms));

  // รีเซ็ต
  cells.forEach(c => {
    c.classList.remove('is-cracked');
    c.querySelector('.egg__img').src = 'assets/egg/closed.png';
  });
  host.classList.remove('is-shiver');
  void host.offsetWidth;
  host.classList.add('is-hop');

  // เด้งเร็วขึ้นเรื่อย ๆ ระหว่างช่วง hop
  const steps = [[0, 620], [1400, 540], [2600, 460], [3500, 380]];
  steps.forEach(([at, ms]) => wait(at, () => host.style.setProperty('--hop', ms + 'ms')));

  // เสียงเด้งตามจังหวะไข่
  let t = 0, gap = 620;
  while (t < T.hop) {
    const at = t;
    wait(at, () => window.Sfx && Sfx.play('hop'));
    gap = at < 1400 ? 620 : at < 2600 ? 540 : at < 3500 ? 460 : 380;
    t += gap;
  }

  // สั่นรัว
  wait(T.hop, () => {
    host.classList.remove('is-hop'); host.classList.add('is-shiver');
    if (window.Sfx) Sfx.rumble(true);          // สั่นรัวแรงขึ้นจนถึงจุดแตก
  });

  // แตกทีละใบ
  cells.forEach((c, i) => wait(T.hop + T.shiver + i * T.stagger, () => {
    if (i === 0) { host.classList.remove('is-shiver'); if (window.Sfx) Sfx.rumble(false); }
    c.querySelector('.egg__img').src = `assets/egg/${eggs[i]}.png`;
    c.classList.add('is-cracked');
    if (window.Sfx) Sfx.play('crack');
  }));

  return new Promise(res => wait(TOTAL, () => res({
    eggs, sum: eggs.reduce((a, b) => a + b, 0),
  })));
}

window.EggReveal = { mountEggs, playReveal, drawEggs, TOTAL, T };
})();
