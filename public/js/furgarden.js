/* FURGARDEN: shared behaviour. Load once per page with <script src="/js/furgarden.js" defer></script>
   - Nav dropdowns and the notifications tray: any .has-menu > button toggles .is-open on its parent
     (click to open, click elsewhere or press Esc to close, aria-expanded is kept in sync).
   - "Mark all read" button ([data-markread]) clears .unread rows and removes the #npip badge.
   - Live clock: any element with id="clock".
   Wire real data by rendering the markup server-side or replacing the sample notifications below. */
document.addEventListener('click', function (e) {
  var t = e.target, a = t.closest('a[href="#"]'); if (a) e.preventDefault();
  if (t.closest('[data-markread]')) {
    document.querySelectorAll('.note.unread').forEach(function (n) { n.classList.remove('unread'); });
    var tr = document.getElementById('tray'); if (!tr) return; tr.classList.add('all-read');
    var pip = document.getElementById('npip'); if (pip) pip.remove();
    tr.parentNode.firstElementChild.setAttribute('aria-label', 'Notifications, none new');
    return;
  }
  if (t.closest('.tray')) return;          // clicks inside the tray keep it open
  var mb = t.closest('.has-menu > button');
  document.querySelectorAll('.has-menu.is-open').forEach(function (m) { if (!mb || m !== mb.parentNode) { m.classList.remove('is-open'); m.firstElementChild.setAttribute('aria-expanded', 'false'); } });
  if (mb) { var o = mb.parentNode.classList.toggle('is-open'); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.has-menu.is-open').forEach(function (m) { m.classList.remove('is-open'); m.firstElementChild.setAttribute('aria-expanded', 'false'); }); });
(function () { var c = document.getElementById('clock'); if (!c) return; function tick() { var d = new Date(); c.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); } tick(); setInterval(tick, 30000); })();
