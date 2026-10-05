/* ═══════════════════════════════════════════════════════════
   RE-POWER · app.js
   JavaScript vanilla, sin dependencias.

   ÍNDICE
   00 Configuración (¡edita aquí el WhatsApp!)
   01 Utilidades y ticker
   02 Preparación del DOM (links WhatsApp, titulares, stagger)
   03 Loader / spinner de carga
   04 Header, menú móvil, progreso y scroll-spy
   05 Reveal al scroll, contadores y parallax
   06 Hero: red de energía (canvas), HUD de batería y rotador
   07 Efectos de puntero: spotlight, magnéticos, cursor luminoso
   08 Proceso (scrollytelling)
   09 Autodiagnóstico, comparativa y formulario
   10 Botón flotante de WhatsApp y arranque
═══════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    /* ───────── 00 · CONFIGURACIÓN ─────────
       Cambia SOLO estos valores para actualizar todos los botones,
       el formulario y los textos de teléfono de la página. */
    const CONFIG = {
        phone: '520000000000',              // WhatsApp en formato internacional, sin "+" ni espacios (52 + 10 dígitos)
        phoneDisplay: '+52 000 000 0000',   // Cómo se muestra el número en pantalla
        defaultMsg: 'Hola Re-Power, quiero información sobre baterías para auto.'
    };

    /* ───────── 01 · UTILIDADES ───────── */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
    const lerp = (a, b, t) => a + (b - a) * t;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const root = document.documentElement;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const waUrl = (msg) => `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(msg || CONFIG.defaultMsg)}`;

    /* Un solo bucle de animación compartido por todos los efectos */
    const tasks = new Set();
    const onFrame = (fn) => { tasks.add(fn); return () => tasks.delete(fn); };
    (function loop(now) {
        tasks.forEach((fn) => fn(now));
        requestAnimationFrame(loop);
    })(performance.now());

    /* Handlers de scroll en un solo listener */
    const scrollHandlers = [];
    let scrollTick = false;
    const onScrollRaf = (fn) => scrollHandlers.push(fn);
    window.addEventListener('scroll', () => {
        if (scrollTick) return;
        scrollTick = true;
        requestAnimationFrame(() => { scrollHandlers.forEach((fn) => fn(window.scrollY)); scrollTick = false; });
    }, { passive: true });
    window.addEventListener('resize', () => scrollHandlers.forEach((fn) => fn(window.scrollY)), { passive: true });

    /* ───────── 02 · PREPARACIÓN DEL DOM ───────── */
    function setupWhatsAppLinks() {
        $$('[data-wa]').forEach((a) => {
            a.href = waUrl(a.dataset.waMsg);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
        $$('[data-phone-display]').forEach((el) => { el.textContent = CONFIG.phoneDisplay; });
    }

    /* Divide un titular en palabras para animarlas una a una */
    function splitWords(el) {
        const nodes = Array.from(el.childNodes);
        const frag = document.createDocumentFragment();
        let index = 0;
        const wrap = (node) => {
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.className = 'w__i';
            inner.style.setProperty('--i', index++);
            inner.appendChild(node); w.appendChild(inner);
            return w;
        };
        nodes.forEach((n, k) => {
            if (n.nodeType === Node.TEXT_NODE) {
                let text = n.textContent;
                if (k === 0) text = text.replace(/^\s+/, '');
                if (k === nodes.length - 1) text = text.replace(/\s+$/, '');
                text.split(/(\s+)/).forEach((tok) => {
                    if (!tok) return;
                    if (/^\s+$/.test(tok)) frag.appendChild(document.createTextNode(' '));
                    else frag.appendChild(wrap(document.createTextNode(tok)));
                });
            } else if (n.nodeType === Node.ELEMENT_NODE) {
                if (n.tagName === 'BR') frag.appendChild(n); else frag.appendChild(wrap(n));
            }
        });
        el.textContent = '';
        el.appendChild(frag);
        el.style.setProperty('--sd', (el.dataset.splitDelay || 0) + 's');
    }

    function prepareDom() {
        setupWhatsAppLinks();
        $$('[data-split]').forEach(splitWords);

        // Retraso escalonado para hijos con data-reveal dentro de [data-stagger]
        $$('[data-stagger]').forEach((parent) => {
            let n = 0;
            Array.from(parent.children).forEach((child) => {
                if (child.hasAttribute('data-reveal') && !child.style.getPropertyValue('--d')) {
                    child.style.setProperty('--d', (n * 0.09).toFixed(2) + 's');
                    n++;
                }
            });
        });

        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();
    }

    /* ───────── 03 · LOADER ───────── */
    function runLoader() {
        return new Promise((resolve) => {
            const loader = $('#loader');
            if (!loader) { resolve(); return; }

            const pctEl = $('#loader-pct');
            const labelEl = $('#loader-label');
            const cells = $$('#loader-cells i');
            const MIN_MS = reduceMotion ? 300 : 2000;
            const start = performance.now();
            let loaded = false;
            let progress = 0;
            let finished = false;

            const pageLoaded = new Promise((r) => {
                if (document.readyState === 'complete') r(); else window.addEventListener('load', r, { once: true });
            });
            const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(2500)]) : Promise.resolve();
            Promise.all([pageLoaded, fontsReady]).then(() => { loaded = true; });
            setTimeout(() => { loaded = true; }, 6000); // tope de seguridad

            const labels = [[0, 'Cargando energía'], [34, 'Regenerando celdas'], [68, 'Calibrando voltaje'], [100, '¡Listo para arrancar!']];

            function finish() {
                if (finished) return;
                finished = true;
                pctEl.textContent = '100%';
                cells.forEach((c) => c.classList.add('on'));
                labelEl.textContent = labels[3][1];
                setTimeout(() => {
                    loader.classList.add('is-done');
                    setTimeout(resolve, 420);                       // arranca el hero mientras el círculo se cierra
                    setTimeout(() => loader.remove(), 1500);
                }, 380);
            }

            function step(now) {
                const t = now - start;
                const ready = loaded && t >= MIN_MS;
                const target = ready ? 100 : Math.min(92, (t / MIN_MS) * 92);
                progress = lerp(progress, target, ready ? 0.18 : 0.08);
                const p = Math.min(100, Math.round(progress));
                pctEl.textContent = p + '%';
                const on = Math.floor(p / 10);
                cells.forEach((c, i) => c.classList.toggle('on', i < on));
                for (let i = labels.length - 2; i >= 0; i--) { if (p >= labels[i][0]) { labelEl.textContent = labels[i][1]; break; } }
                if (p >= 100) { finish(); return; }
                requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }

    /* ───────── 04 · HEADER, MENÚ, PROGRESO, SCROLL-SPY ───────── */
    function initHeader() {
        const header = $('#site-header');
        const bar = $('#scroll-progress');
        const burger = $('#burger');
        const menu = $('#mobile-menu');
        let lastY = window.scrollY;
        let menuOpen = false;

        onScrollRaf((y) => {
            header.classList.toggle('is-scrolled', y > 24);
            if (!menuOpen) {
                if (y > 420 && y > lastY + 4) header.classList.add('is-hidden');
                else if (y < lastY - 4 || y <= 420) header.classList.remove('is-hidden');
            }
            if (Math.abs(y - lastY) > 4) lastY = y;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
        });

        const setMenu = (open) => {
            menuOpen = open;
            menu.classList.toggle('is-open', open);
            menu.setAttribute('aria-hidden', String(!open));
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            document.body.style.overflow = open ? 'hidden' : '';
            document.body.classList.toggle('menu-open', open);
            if (open) header.classList.remove('is-hidden');
        };
        burger.addEventListener('click', () => setMenu(!menuOpen));
        $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
        window.matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false); });

        // Scroll-spy
        const links = $$('.main-nav a');
        const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        if ('IntersectionObserver' in window) {
            const spy = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    links.forEach((l) => l.removeAttribute('aria-current'));
                    const active = byId.get(entry.target.id);
                    if (active) active.setAttribute('aria-current', 'true');
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
        }
    }

    /* ───────── 05 · REVEAL, CONTADORES, PARALLAX ───────── */
    function initReveal() {
        const items = $$('[data-reveal]');
        if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        items.forEach((el) => io.observe(el));
    }

    function initCounters() {
        const els = $$('.count');
        const run = (el) => {
            const target = Number(el.dataset.count);
            if (!target) return;
            const prefix = el.dataset.prefix || '';
            const t0 = performance.now();
            const dur = 1800;
            const tick = (now) => {
                const p = Math.min((now - t0) / dur, 1);
                el.textContent = prefix + Math.round(target * (1 - Math.pow(1 - p, 4)));
                if (p < 1) requestAnimationFrame(tick);
            };
            if (reduceMotion) { el.textContent = prefix + target; return; }
            el.textContent = prefix + '0';
            requestAnimationFrame(tick);
        };
        if (!('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: 0.6 });
        els.forEach((el) => io.observe(el));
    }

    function initParallax() {
        if (reduceMotion) return;
        const items = $$('[data-parallax]').map((el) => ({ el, f: parseFloat(el.dataset.parallax) || 0.05, y: 0, vis: false }));
        if (!items.length || !('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { const it = items.find((i) => i.el === e.target); if (it) it.vis = e.isIntersecting; });
        }, { rootMargin: '20% 0px' });
        items.forEach((it) => io.observe(it.el));
        onFrame(() => {
            const vh = window.innerHeight;
            items.forEach((it) => {
                if (!it.vis) return;
                const r = it.el.getBoundingClientRect();
                const center = (r.top - it.y) + r.height / 2 - vh / 2;   // posición sin la traslación actual
                it.y = lerp(it.y, -center * it.f, 0.075);                // lerp = movimiento suave tipo "slow motion"
                it.el.style.transform = `translate3d(0, ${it.y.toFixed(2)}px, 0)`;
            });
        });
    }

    /* ───────── 06 · HERO ───────── */
    /* Red de energía: partículas, enlaces y pulsos viajando entre nodos */
    function initEnergyCanvas() {
        const canvas = $('#energy-canvas');
        if (!canvas) return;
        const hero = canvas.closest('.hero');
        const ctx = canvas.getContext('2d');
        const palette = [[163, 240, 75], [74, 222, 58], [20, 209, 176]];
        const mouse = { x: 0, y: 0, on: false };
        let W = 0, H = 0, link = 140, pts = [], pulses = [], visible = true, nextPulse = 0;
        const rand = (a, b) => a + Math.random() * (b - a);

        function build() {
            const r = hero.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = r.width; H = r.height;
            canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            link = W < 768 ? 105 : 150;
            const n = Math.round(clamp((W * H) / (W < 768 ? 12500 : 14500), 26, 105));
            pts = Array.from({ length: n }, () => ({
                x: rand(0, W), y: rand(0, H), vx: rand(-0.22, 0.22), vy: rand(-0.22, 0.22),
                r: rand(1, 2.5), c: palette[(Math.random() * 3) | 0], ph: rand(0, 6.28)
            }));
            pulses = [];
        }

        function draw(now, animate) {
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';

            if (animate) {
                for (const p of pts) {
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
                    if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
                    if (mouse.on) {   // los nodos se apartan suavemente del puntero
                        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
                        if (d2 < 22500 && d2 > 1) { const d = Math.sqrt(d2), f = ((150 - d) / 150) * 0.4; p.x += (dx / d) * f; p.y += (dy / d) * f; }
                    }
                }
            }

            // enlaces entre nodos cercanos
            const L2 = link * link;
            ctx.lineWidth = 1;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                for (let j = i + 1; j < pts.length; j++) {
                    const b = pts[j];
                    const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                    if (d2 < L2) {
                        const al = (1 - Math.sqrt(d2) / link) * 0.34;
                        ctx.strokeStyle = `rgba(${a.c[0]},${a.c[1]},${a.c[2]},${al.toFixed(3)})`;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
            }

            // enlaces con el puntero
            if (mouse.on) {
                for (const p of pts) {
                    const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 200) {
                        ctx.strokeStyle = `rgba(163,240,75,${((1 - d / 200) * 0.55).toFixed(3)})`;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                    }
                }
            }

            // nodos
            for (const p of pts) {
                const tw = animate ? 0.55 + 0.35 * Math.sin(now / 900 + p.ph) : 0.7;
                ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${tw.toFixed(3)})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
            }

            // pulsos de energía
            if (animate) {
                if (now > nextPulse && pulses.length < 9) {
                    nextPulse = now + rand(220, 620);
                    const a = pts[(Math.random() * pts.length) | 0];
                    const near = pts.filter((q) => { const dx = a.x - q.x, dy = a.y - q.y, d2 = dx * dx + dy * dy; return q !== a && d2 < L2 && d2 > 400; });
                    if (near.length) pulses.push({ a, b: near[(Math.random() * near.length) | 0], t: 0, s: rand(0.012, 0.026) });
                }
                for (let k = pulses.length - 1; k >= 0; k--) {
                    const p = pulses[k];
                    p.t += p.s;
                    if (p.t >= 1) { pulses.splice(k, 1); continue; }
                    const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
                    ctx.fillStyle = 'rgba(163,240,75,.2)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 6.2832); ctx.fill();
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        build();
        if (reduceMotion) {
            draw(0, false);
            window.addEventListener('resize', () => { build(); draw(0, false); });
            return;
        }

        let resizeTimer;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 180); }, { passive: true });
        if (finePointer) {
            hero.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; }, { passive: true });
            hero.addEventListener('pointerleave', () => { mouse.on = false; });
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(hero);
        }
        onFrame((now) => { if (visible && !document.hidden) draw(now, true); });
    }

    /* HUD: la batería se regenera en bucle (voltaje, % y estado sincronizados) */
    function initHud() {
        const stage = $('#hud-stage');
        const level = $('#hud-level');
        if (!stage || !level) return;
        const volt = $('#hud-volt'), pct = $('#hud-pct'), state = $('#hud-state');
        const TOP = 184, BOTTOM = 308;
        const CHARGE = 5200, HOLD = 2600, DROP = 1300, LOW = 0.12;
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const easeIn = (t) => t * t;
        let lastPct = -1, lastState = '';
        let rx = 0, ry = 0, trx = 0, tryy = 0;

        const setLevel = (v) => {
            level.setAttribute('transform', `translate(0 ${(BOTTOM - (BOTTOM - TOP) * v).toFixed(1)})`);
            const p = Math.round(v * 100);
            if (p !== lastPct) { lastPct = p; pct.textContent = p; volt.textContent = (11.4 + 1.2 * v).toFixed(1); }
        };
        const setState = (txt, cls) => {
            if (txt === lastState) return;
            lastState = txt; state.textContent = txt;
            state.classList.toggle('is-ok', cls === 'ok'); state.classList.toggle('is-low', cls === 'low');
        };

        if (reduceMotion) { setLevel(1); setState('Batería lista', 'ok'); return; }

        if (finePointer) {
            document.addEventListener('pointermove', (e) => {
                const r = stage.getBoundingClientRect();
                if (r.bottom < 0 || r.top > window.innerHeight) return;
                trx = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1) * -9;
                tryy = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1) * 11;
            }, { passive: true });
        }

        const t0 = performance.now();
        onFrame((now) => {
            const t = (now - t0) % (CHARGE + HOLD + DROP + 500);
            let v;
            if (t < CHARGE) { v = lerp(LOW, 1, ease(t / CHARGE)); setState('Regenerando', ''); }
            else if (t < CHARGE + HOLD) { v = 1; setState('Batería lista', 'ok'); }
            else if (t < CHARGE + HOLD + DROP) { v = lerp(1, LOW, easeIn((t - CHARGE - HOLD) / DROP)); setState('Batería débil', 'low'); }
            else { v = LOW; setState('Batería débil', 'low'); }
            setLevel(v);

            // inclinación 3D: puntero + balanceo suave constante
            rx = lerp(rx, trx + Math.sin(now / 2300) * 3.2, 0.06);
            ry = lerp(ry, tryy + Math.cos(now / 2900) * 4.2, 0.06);
            stage.style.setProperty('--rx', rx.toFixed(2) + 'deg');
            stage.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        });
    }

    function initRotator() {
        const items = $$('.rotator__item');
        if (items.length < 2) return;
        let i = 0;
        items.forEach((it, k) => it.setAttribute('aria-hidden', String(k !== 0)));
        if (reduceMotion) return;
        setInterval(() => {
            const cur = items[i];
            const next = items[(i + 1) % items.length];
            cur.classList.remove('is-active'); cur.classList.add('is-leaving'); cur.setAttribute('aria-hidden', 'true');
            next.classList.remove('is-leaving'); next.classList.add('is-active'); next.setAttribute('aria-hidden', 'false');
            i = (i + 1) % items.length;
            setTimeout(() => cur.classList.remove('is-leaving'), 900);
        }, 2900);
    }

    /* ───────── 07 · EFECTOS DE PUNTERO ───────── */
    function initPointerEffects() {
        if (!finePointer) return;

        // Spotlight que sigue al cursor dentro de cada tarjeta
        document.addEventListener('pointermove', (e) => {
            const el = e.target.closest && e.target.closest('.spotlight');
            if (!el) return;
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });

        if (reduceMotion) return;

        // Botones magnéticos
        $$('[data-magnetic]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--tx', (((e.clientX - (r.left + r.width / 2)) / r.width) * 14).toFixed(1) + 'px');
                el.style.setProperty('--ty', (((e.clientY - (r.top + r.height / 2)) / r.height) * 10).toFixed(1) + 'px');
            });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
        });

        // Luz ambiental que sigue al cursor
        const glow = $('#cursor-glow');
        if (glow) {
            let tx = window.innerWidth / 2, ty = window.innerHeight / 2, x = tx, y = ty;
            document.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; glow.classList.add('is-on'); }, { passive: true });
            document.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
            onFrame(() => {
                x = lerp(x, tx, 0.1); y = lerp(y, ty, 0.1);
                glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            });
        }
    }

    /* ───────── 08 · PROCESO (SCROLLYTELLING) ───────── */
    function initProcess() {
        const list = $('#steps');
        const pbat = $('#pbat');
        if (!list || !pbat) return;
        const steps = $$('.step', list);
        const volt = $('#pbat-volt'), pct = $('#pbat-pct');

        const update = () => {
            const vh = window.innerHeight;
            const r = list.getBoundingClientRect();
            const focus = vh * 0.55;
            const prog = clamp((focus - r.top) / r.height, 0, 1);
            list.style.setProperty('--prog', prog.toFixed(3));

            let active = -1;
            steps.forEach((s, i) => { if (s.getBoundingClientRect().top < focus) active = i; });
            steps.forEach((s, i) => { s.classList.toggle('is-active', i === active); s.classList.toggle('is-done', i < active); });

            const level = clamp(0.1 + 0.9 * ((active + 1) / steps.length), 0.1, 1);
            pbat.style.setProperty('--p', level.toFixed(3));
            volt.textContent = (11.4 + 1.2 * level).toFixed(1);
            pct.textContent = Math.round(level * 100);
        };
        onScrollRaf(update);
        update();
    }

    /* ───────── 09 · AUTODIAGNÓSTICO, COMPARATIVA, FORMULARIO ───────── */
    function initDiagnostic() {
        const form = $('#diag-form');
        if (!form) return;
        const needle = $('#gauge-needle'), gauge = $('#gauge'), pctEl = $('#gauge-pct');
        const verdict = $('#verdict'), title = $('#verdict-title'), text = $('#verdict-text');
        const cta = $('#diag-cta');
        const inputs = $$('input[name="s"]', form);

        const levels = [
            { max: 0, key: 'ok', title: 'Sin señales de alerta', text: 'No notas síntomas por ahora. Si tu batería ya tiene años, un diagnóstico en sitio te da tranquilidad.' },
            { max: 2, key: 'watch', title: 'Vigílala de cerca', text: 'Hay señales leves de desgaste. Conviene revisarla antes de que te deje tirado.' },
            { max: 5, key: 'warn', title: 'Probable desgaste', text: 'Varias señales apuntan a una batería cansada. Te recomendamos un diagnóstico en sitio pronto.' },
            { max: Infinity, key: 'bad', title: 'Muy probable que necesite cambio', text: 'Tu auto está pidiendo batería. Escríbenos y te la llevamos e instalamos sin costo extra.' }
        ];

        const update = () => {
            const checked = inputs.filter((i) => i.checked);
            const score = checked.reduce((sum, i) => sum + Number(i.dataset.w), 0);
            const health = clamp(1 - score / 8, 0.06, 1);
            const lvl = levels.find((l) => score <= l.max);

            needle.style.setProperty('--a', (-90 + 180 * health).toFixed(1) + 'deg');
            pctEl.textContent = Math.round(health * 100) + '%';
            gauge.dataset.level = lvl.key;
            verdict.dataset.level = lvl.key;
            title.textContent = lvl.title;
            text.textContent = lvl.text;

            const symptoms = checked.map((i) => i.value.toLowerCase());
            cta.dataset.waMsg = symptoms.length
                ? `Hola Re-Power, hice el autodiagnóstico en su sitio y mi auto presenta: ${symptoms.join(', ')}. Resultado orientativo: ${lvl.title.toLowerCase()}. ¿Pueden revisar mi batería?`
                : 'Hola Re-Power, quiero que revisen la batería de mi auto.';
            cta.href = waUrl(cta.dataset.waMsg);
        };
        form.addEventListener('change', update);
        update();
    }

    function initCompare() {
        const seg = $('#seg');
        if (!seg) return;
        const tabs = $$('.seg__btn', seg);
        const panels = $$('.compare__panel');
        const select = (i, focus) => {
            tabs.forEach((t, k) => { const on = k === i; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
            panels.forEach((p, k) => { p.hidden = k !== i; p.classList.toggle('is-active', k === i); });
            seg.style.setProperty('--i', i);
            if (focus) tabs[i].focus();
        };
        tabs.forEach((t, i) => {
            t.addEventListener('click', () => select(i));
            t.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select(i === 0 ? 1 : 0, true); }
            });
        });
    }

    function initFaq() {
        // Fallback para navegadores sin <details name="">: cierra los demás al abrir uno
        const items = $$('.faq__item');
        items.forEach((d) => d.addEventListener('toggle', () => {
            if (d.open) items.forEach((o) => { if (o !== d) o.open = false; });
        }));
    }

    function initForm() {
        const form = $('#quote-form');
        if (!form) return;
        const btn = $('#quote-submit');
        const label = $('#quote-submit-label');
        const original = label.textContent;

        const rules = {
            name: { el: $('#f-name'), err: $('#e-name'), test: (v) => v.trim().length >= 2, msg: 'Escribe tu nombre para saber cómo llamarte.' },
            car: { el: $('#f-car'), err: $('#e-car'), test: (v) => v.trim().length >= 2, msg: 'Dinos la marca y modelo de tu auto.' },
            need: { el: $('#f-need'), err: $('#e-need'), test: (v) => v !== '', msg: 'Elige qué necesitas para ayudarte mejor.' },
            phone: { el: $('#f-phone'), err: $('#e-phone'), test: (v) => v.trim() === '' || v.replace(/\D/g, '').length >= 8, msg: 'Revisa tu teléfono (mínimo 8 dígitos).' }
        };

        const setError = (rule, on) => {
            const field = rule.el.closest('.field');
            field.classList.toggle('has-error', on);
            rule.el.setAttribute('aria-invalid', String(on));
            rule.err.textContent = on ? rule.msg : '';
        };
        Object.values(rules).forEach((rule) => {
            rule.el.addEventListener('input', () => { if (rule.test(rule.el.value)) setError(rule, false); });
            rule.el.addEventListener('change', () => { if (rule.test(rule.el.value)) setError(rule, false); });
            rule.el.setAttribute('aria-describedby', rule.err.id);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let firstInvalid = null;
            Object.values(rules).forEach((rule) => {
                const ok = rule.test(rule.el.value);
                setError(rule, !ok);
                if (!ok && !firstInvalid) firstInvalid = rule.el;
            });
            if (firstInvalid) { firstInvalid.focus(); return; }

            const v = (id) => $(id).value.trim();
            const lines = [
                'Hola Re-Power, quiero cotizar una batería. 👋',
                '',
                `• Nombre: ${v('#f-name')}`,
                v('#f-phone') ? `• Teléfono: ${v('#f-phone')}` : null,
                `• Auto: ${v('#f-car')}${v('#f-year') ? ' (' + v('#f-year') + ')' : ''}`,
                `• Necesito: ${$('#f-need').value}`,
                v('#f-msg') ? `• Comentarios: ${v('#f-msg')}` : null
            ].filter((l) => l !== null);

            const url = waUrl(lines.join('\n'));
            label.textContent = 'Abriendo WhatsApp…';
            btn.classList.add('is-sent');
            btn.disabled = true;
            const w = window.open(url, '_blank', 'noopener');
            if (!w) window.location.href = url;     // por si el navegador bloquea la ventana emergente
            setTimeout(() => { label.textContent = original; btn.classList.remove('is-sent'); btn.disabled = false; form.reset(); }, 3200);
        });
    }

    /* ───────── 10 · BOTÓN FLOTANTE Y ARRANQUE ───────── */
    function initFloatingWhatsApp() {
        const fab = $('#wa-float');
        if (!fab) return;
        setTimeout(() => fab.classList.add('is-visible'), 600);
        const showTip = () => { fab.classList.add('show-tip'); setTimeout(() => fab.classList.remove('show-tip'), 5200); };
        setTimeout(showTip, 7000);
        setInterval(showTip, 42000);
    }

    function init() {
        prepareDom();
        initHeader();
        initReveal();
        initCounters();
        initParallax();
        initEnergyCanvas();
        initHud();
        initRotator();
        initPointerEffects();
        initProcess();
        initDiagnostic();
        initCompare();
        initFaq();
        initForm();

        runLoader().then(() => {
            root.classList.add('is-ready');     // dispara las animaciones de entrada del hero
            initFloatingWhatsApp();
        });
    }

    init();
})();
