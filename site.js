(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    /* ---------- Предзагрузка ---------- */
    var pre = document.getElementById('preloader');
    if (pre) {
      setTimeout(function () {
        pre.classList.add('fade-out');
        pre.setAttribute('aria-hidden', 'true');
      }, 600);
    }

    /* ---------- Мобильное меню ---------- */
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    function setNav(open) {
      if (!toggle || !nav) return;
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        setNav(!nav.classList.contains('open'));
      });
      nav.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.dropdown-content a, .btn-nav-item')) setNav(false);
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 1200) setNav(false);
      });
    }

    /* ---------- Выпадающее меню «Услуги» ---------- */
    var dd = document.querySelector('.dropdown-menu-container');
    var ddBtn = dd ? dd.querySelector('.btn-services-toggle') : null;
    function setDd(open) {
      if (!dd || !ddBtn) return;
      dd.classList.toggle('open', open);
      ddBtn.setAttribute('aria-expanded', String(open));
    }
    if (dd && ddBtn) {
      ddBtn.addEventListener('click', function () {
        setDd(!dd.classList.contains('open'));
      });
      document.addEventListener('click', function (e) {
        if (!dd.contains(e.target)) setDd(false);
      });
      dd.addEventListener('focusout', function (e) {
        if (e.relatedTarget && !dd.contains(e.relatedTarget)) setDd(false);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var menuWasOpen = nav && nav.classList.contains('open');
      setDd(false);
      setNav(false);
      if (menuWasOpen && toggle) toggle.focus();
    });

    /* ---------- Вопросы и ответы ---------- */
    document.querySelectorAll('.faq-compact-item').forEach(function (item, i) {
      var q = item.querySelector('.faq-compact-question');
      var a = item.querySelector('.faq-compact-answer');
      if (!q || !a) return;
      a.id = a.id || 'faq-answer-' + (i + 1);
      q.setAttribute('role', 'button');
      q.setAttribute('tabindex', '0');
      q.setAttribute('aria-expanded', 'false');
      q.setAttribute('aria-controls', a.id);
      function flip() {
        var on = item.classList.toggle('active');
        q.setAttribute('aria-expanded', String(on));
      }
      q.addEventListener('click', flip);
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip();
        }
      });
    });

    /* ---------- Формы заявок ---------- */
    var contactLine = (cfg.phone || '') + (cfg.email ? ' или напишите на ' + cfg.email : '');

    document.querySelectorAll('form.lead-form').forEach(function (form) {
      var status = form.querySelector('.form-status');
      var button = form.querySelector('button[type="submit"]');

      function show(text, kind) {
        if (!status) return;
        status.textContent = text;
        status.className = 'form-status ' + kind;
        status.hidden = false;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        function field(name) {
          var el = form.elements[name];
          return el ? String(el.value || '').trim() : '';
        }
        var data = {
          name: field('name'),
          phone: field('phone'),
          message: field('message'),
          website: field('website'), // ловушка для ботов: у людей пусто
          form: form.getAttribute('data-form') || '',
          page: location.pathname.split('/').pop() || 'index.html'
        };

        if (data.website) { // бот: делаем вид, что всё хорошо, ничего не отправляя
          show('Спасибо! Заявка отправлена, мы свяжемся с вами.', 'ok');
          form.reset();
          return;
        }

        var endpoint = String(cfg.formEndpoint || '').trim();
        if (!endpoint) {
          show('Приём заявок через сайт пока не подключён. Позвоните нам: ' + contactLine + '.', 'warn');
          return;
        }

        var label = button ? button.textContent : '';
        if (button) { button.disabled = true; button.textContent = 'Отправляем…'; }
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;

        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: ctrl ? ctrl.signal : undefined
        })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              if (!r.ok || !j.ok) throw new Error('send failed');
            });
          })
          .then(function () {
            show('Спасибо! Заявка отправлена, мы свяжемся с вами.', 'ok');
            form.reset();
          })
          .catch(function () {
            show('Не удалось отправить заявку. Позвоните нам: ' + contactLine + '.', 'error');
          })
          .then(function () {
            if (timer) clearTimeout(timer);
            if (button) { button.disabled = false; button.textContent = label; }
          });
      });
    });
  });
})();
