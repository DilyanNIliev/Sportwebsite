/*
  Автоматична тема по местното време на посетителя.

  Прагът за тъмна тема следва годишна косинусова крива, вместо фиксирана
  стъпка на месец. Така преходът повтаря поведението на реалния залез:
  бърза промяна около равноденствията (март, септември) и почти никаква
  около слънцестоенията (юни, декември).

    лятно слънцестоене (21 юни)     → тъмна след 20:00
    зимно слънцестоене (21 декември) → тъмна след 16:30

  Между тях стойността се движи плавно, около 35-40 минути на месец в
  най-стръмната част и под 10 минути в най-полегатата.
*/

export const DUSK_MID = 18.25;   // (20:00 + 16:30) / 2
export const DUSK_AMP = 1.75;    // (20:00 - 16:30) / 2
export const DAWN_MID = 7.0;     // (06:00 + 08:00) / 2
export const DAWN_AMP = 1.0;     // (08:00 - 06:00) / 2
const SOLSTICE_DAY = 172;        // 21 юни

/** Ден от годината, 1 - 366. */
export function dayOfYear(d) {
  const start = Date.UTC(d.getFullYear(), 0, 1);
  const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((now - start) / 86400000) + 1;
}

/** +1 в разгара на лятото, -1 в разгара на зимата. */
export function seasonWave(d) {
  return Math.cos((2 * Math.PI * (dayOfYear(d) - SOLSTICE_DAY)) / 365.25);
}

/** Часът, в който се включва тъмната тема (напр. 19.5 = 19:30). */
export function duskHour(d) {
  return DUSK_MID + DUSK_AMP * seasonWave(d);
}

/** Часът, в който се връща светлата тема. */
export function dawnHour(d) {
  return DAWN_MID - DAWN_AMP * seasonWave(d);
}

/** 'light' или 'dark' според местното време на посетителя. */
export function themeForDate(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= dawnHour(d) && h < duskHour(d) ? 'light' : 'dark';
}
