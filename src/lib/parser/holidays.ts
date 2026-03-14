/**
 * Festivos colombianos + cálculo de días hábiles.
 * Ley 51 de 1983 (Ley Emiliani) + festivos fijos + relativos a Pascua.
 */

// ============================================================
// ALGORITMO DE PASCUA (Meeus/Jones/Butcher)
// ============================================================
function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/**
 * Ley Emiliani: si el festivo no cae en lunes, se mueve al próximo lunes.
 */
function emiliani(date: Date): Date {
  const dow = date.getDay() // 0=Dom, 1=Lun...
  if (dow === 1) return date
  const diff = dow === 0 ? 1 : 8 - dow
  return addDays(date, diff)
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
// FESTIVOS POR AÑO
// ============================================================
function buildHolidays(year: number): Set<string> {
  const h = new Set<string>()
  const add = (d: Date) => h.add(toKey(d))
  const addE = (d: Date) => h.add(toKey(emiliani(d))) // Ley Emiliani

  // Fijos (no se mueven)
  add(new Date(year, 0, 1))   // Año Nuevo
  add(new Date(year, 4, 1))   // Día del Trabajo
  add(new Date(year, 6, 20))  // Independencia
  add(new Date(year, 7, 7))   // Batalla de Boyacá
  add(new Date(year, 11, 8))  // Inmaculada Concepción
  add(new Date(year, 11, 25)) // Navidad

  // Ley Emiliani (se mueven al próximo lunes)
  addE(new Date(year, 0, 6))   // Reyes Magos
  addE(new Date(year, 2, 19))  // San José
  addE(new Date(year, 5, 29))  // San Pedro y San Pablo
  addE(new Date(year, 7, 15))  // Asunción de la Virgen
  addE(new Date(year, 9, 12))  // Día de la Raza
  addE(new Date(year, 10, 1))  // Todos los Santos
  addE(new Date(year, 10, 11)) // Independencia de Cartagena

  // Relativos a Pascua
  const e = easter(year)
  add(addDays(e, -3))          // Jueves Santo (fijo)
  add(addDays(e, -2))          // Viernes Santo (fijo)
  addE(addDays(e, 39))         // Ascensión del Señor (Emiliani)
  addE(addDays(e, 60))         // Corpus Christi (Emiliani)
  addE(addDays(e, 68))         // Sagrado Corazón de Jesús (Emiliani)

  return h
}

const cache = new Map<number, Set<string>>()

function getHolidays(year: number): Set<string> {
  if (!cache.has(year)) cache.set(year, buildHolidays(year))
  return cache.get(year)!
}

// ============================================================
// API PÚBLICA
// ============================================================
export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return false // fin de semana
  return !getHolidays(date.getFullYear()).has(toKey(date))
}

/**
 * Días hábiles colombianos entre hoy y fechaPactada.
 * Positivo → quedan días.  Negativo → ya venció.  0 → vence hoy.
 */
export function calcSemaforo(fechaPactada: Date, today = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const p = new Date(fechaPactada.getFullYear(), fechaPactada.getMonth(), fechaPactada.getDate())

  if (t.getTime() === p.getTime()) return 0

  const forward = p > t
  const [start, end] = forward ? [t, p] : [p, t]

  let count = 0
  const cur = new Date(start)
  cur.setDate(cur.getDate() + 1)
  while (cur <= end) {
    if (isBusinessDay(cur)) count++
    cur.setDate(cur.getDate() + 1)
  }

  return forward ? count : -count
}
