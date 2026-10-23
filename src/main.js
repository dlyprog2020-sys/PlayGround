import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './style.css'
import { createBikeExperience } from './bike.js'

const palette = {
  graphite: { paint: '#25282e', accent: '#c8ff3d', rgb: '200, 255, 61', name: 'Graphite' },
  volt: { paint: '#a9d92c', accent: '#d6ff63', rgb: '214, 255, 99', name: 'Volt Lime' },
  cobalt: { paint: '#1f49b4', accent: '#82aaff', rgb: '130, 170, 255', name: 'Cobalt' },
  dune: { paint: '#b9a386', accent: '#f2c894', rgb: '242, 200, 148', name: 'Dune' },
  ember: { paint: '#ad3a30', accent: '#ff8a76', rgb: '255, 138, 118', name: 'Ember' },
}

const ranges = {
  eco: { value: 168, battery: 100, note: 'Maximum range. Gentle assistance for flat city miles.' },
  tour: { value: 120, battery: 72, note: 'Balanced assistance for everyday city riding.' },
  sport: { value: 86, battery: 52, note: 'Full power for headwinds, hills and the long way home.' },
}

const root = document.documentElement
const loader = document.getElementById('loader')
const sceneEl = document.getElementById('scene')

let currentPaint = 'graphite'

/* ---------------- 3D scene ---------------- */

const experience = createBikeExperience({
  container: sceneEl,
  paint: palette[currentPaint].paint,
  accent: palette[currentPaint].accent,
  onReady() {
    loader?.classList.add('is-hidden')
    window.__VOLTRA_READY__ = true
  },
})

/* ---------------- Paint ---------------- */

const paintButtons = Array.from(document.querySelectorAll('[data-paint]'))
const heroPaintName = document.getElementById('hero-paint-name')
const configPaintName = document.getElementById('config-paint-name')

function applyPaint(id) {
  const entry = palette[id]
  if (!entry) return
  currentPaint = id

  root.style.setProperty('--accent', entry.accent)
  root.style.setProperty('--accent-rgb', entry.rgb)
  heroPaintName.textContent = entry.name
  configPaintName.textContent = entry.name

  paintButtons.forEach((button) => {
    const active = button.dataset.paint === id
    button.classList.toggle('is-active', active)
    if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(active))
  })

  experience?.setPaint(entry.paint)
  experience?.setAccent(entry.accent)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#07080a')
}

paintButtons.forEach((button) => {
  button.addEventListener('click', () => applyPaint(button.dataset.paint))
})

document.getElementById('see-in-3d')?.addEventListener('click', () => {
  applyPaint(currentPaint)
})

/* ---------------- Range ---------------- */

const batteryEl = document.getElementById('battery')
if (batteryEl) {
  batteryEl.innerHTML = Array.from({ length: 24 }, () => '<i></i>').join('')
}
const batteryCells = batteryEl ? Array.from(batteryEl.children) : []
const rangeValue = document.getElementById('range-value')
const rangeBatteryLabel = document.getElementById('range-battery-label')
const modeNote = document.getElementById('mode-note')
const modeButtons = Array.from(document.querySelectorAll('.mode'))
let displayedRange = ranges.tour.value
let rangeFrame = 0

function setBatteryLevel(percent, immediate = false) {
  const onCount = Math.round((percent / 100) * batteryCells.length)
  batteryCells.forEach((cell, index) => {
    const on = index < onCount
    if (immediate) {
      cell.classList.toggle('is-on', on)
    } else {
      setTimeout(() => cell.classList.toggle('is-on', on), index * 12)
    }
  })
  batteryEl?.setAttribute('aria-label', `Battery illustration at ${percent}%`)
}

function animateRange(target) {
  cancelAnimationFrame(rangeFrame)
  const start = displayedRange
  const startTime = performance.now()
  const duration = 650

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    displayedRange = Math.round(start + (target - start) * eased)
    rangeValue.textContent = String(displayedRange)
    if (t < 1) rangeFrame = requestAnimationFrame(step)
  }

  rangeFrame = requestAnimationFrame(step)
}

function selectMode(mode) {
  const data = ranges[mode]
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  animateRange(data.value)
  rangeBatteryLabel.textContent = `${data.battery}% battery`
  modeNote.textContent = data.note
  setBatteryLevel(data.battery)
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => selectMode(button.dataset.mode))
})

setBatteryLevel(ranges.tour.battery, true)
if (rangeValue) rangeValue.textContent = String(ranges.tour.value)
rangeBatteryLabel.textContent = `${ranges.tour.battery}% battery`
modeNote.textContent = ranges.tour.note

/* ---------------- Header / scroll ---------------- */

const header = document.getElementById('site-header')
const progress = document.getElementById('scroll-progress')

function onScroll() {
  const scrollTop = window.scrollY
  header?.classList.toggle('is-scrolled', scrollTop > 30)

  const max = document.documentElement.scrollHeight - window.innerHeight
  const ratio = max > 0 ? Math.min(1, scrollTop / max) : 0
  if (progress) progress.style.transform = `scaleX(${ratio})`
}

window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

/* ---------------- Mobile menu ---------------- */

const menuToggle = document.getElementById('menu-toggle')
const mobileMenu = document.getElementById('mobile-menu')

function setMenu(open) {
  document.body.classList.toggle('menu-open', open)
  menuToggle?.setAttribute('aria-expanded', String(open))
  menuToggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  mobileMenu?.setAttribute('aria-hidden', String(!open))
}

menuToggle?.addEventListener('click', () => {
  setMenu(!document.body.classList.contains('menu-open'))
})

mobileMenu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false))
})

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
    setMenu(false)
  }
})

/* ---------------- Hotspots ---------------- */

const hotspotEls = Array.from(document.querySelectorAll('.hotspot'))

function closeHotspots(except) {
  hotspotEls.forEach((hotspot) => {
    if (hotspot !== except) hotspot.setAttribute('aria-expanded', 'false')
  })
}

hotspotEls.forEach((hotspot) => {
  hotspot.addEventListener('click', (event) => {
    event.stopPropagation()
    const open = hotspot.getAttribute('aria-expanded') !== 'true'
    closeHotspots(hotspot)
    hotspot.setAttribute('aria-expanded', String(open))
  })
})

document.addEventListener('click', (event) => {
  if (!event.target.closest('.hotspot')) closeHotspots()
})

/* ---------------- Reveal ---------------- */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in')
        revealObserver.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
)

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element))

/* ---------------- Dialog ---------------- */

const dialog = document.getElementById('book-dialog')
const bookForm = document.getElementById('book-form')
const formSuccess = document.getElementById('form-success')
const dialogTitle = document.getElementById('book-title')
const dialogCopy = document.getElementById('dialog-copy')
const dialogEyebrow = document.getElementById('dialog-eyebrow')
const bookSubmit = document.getElementById('book-submit')
const dateField = document.getElementById('date')

if (dateField) {
  const today = new Date()
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  dateField.min = iso
}

function setDialogMode(mode) {
  const reserve = mode === 'reserve'
  dialogTitle.textContent = reserve ? 'Make it yours.' : 'Bring your commute.'
  dialogEyebrow.textContent = reserve ? 'Reserve' : 'Test ride'
  dialogCopy.textContent = reserve
    ? 'Reserve your AURORA E-1 today. No payment now — we will confirm your build slot by email.'
    : '48 hours, one charger, zero excuses. Tell us where to meet you.'
  bookSubmit.textContent = reserve ? 'Request reservation' : 'Send request'
}

document.querySelectorAll('[data-book]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault()
    setMenu(false)
    setDialogMode(trigger.dataset.book)
    if (typeof dialog?.showModal === 'function') {
      dialog.showModal()
      document.body.classList.add('modal-open')
    }
  })
})

function closeDialog() {
  dialog?.close()
}

document.getElementById('dialog-close')?.addEventListener('click', closeDialog)
document.getElementById('success-close')?.addEventListener('click', closeDialog)

dialog?.addEventListener('click', (event) => {
  if (event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  if (!inside) closeDialog()
})

dialog?.addEventListener('close', () => {
  document.body.classList.remove('modal-open')
  setTimeout(() => {
    bookForm?.reset()
    if (bookForm) bookForm.hidden = false
    if (formSuccess) formSuccess.hidden = true
  }, 200)
})

bookForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  if (!bookForm.checkValidity()) {
    bookForm.reportValidity()
    return
  }
  bookForm.hidden = true
  if (formSuccess) formSuccess.hidden = false
})

/* ---------------- Newsletter ---------------- */

const newsletter = document.getElementById('newsletter')
const newsletterStatus = document.getElementById('newsletter-status')

newsletter?.addEventListener('submit', (event) => {
  event.preventDefault()
  const input = newsletter.querySelector('input')
  if (!input?.checkValidity()) {
    input?.reportValidity()
    return
  }
  newsletterStatus.textContent = "You're in. Look out for ride notes on Thursdays."
  newsletter.reset()
})

/* ---------------- Misc ---------------- */

const year = new Date().getFullYear()
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(year)
})

if (experience) {
  document.addEventListener('visibilitychange', () => {
    experience.setPaused(document.hidden)
  })
}
