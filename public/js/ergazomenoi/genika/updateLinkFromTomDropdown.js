document.addEventListener('DOMContentLoaded', function () {
  const sel   = document.getElementById('programma_dypa');
  const gotoA = document.getElementById('gotoProgrammaDypa');
  const hid   = document.getElementById('link_programma_dypa_stathera');
  if (!sel || !gotoA) return;

  (function attach(){
    const ts = sel.tomselect || (window.__tomInstances && window.__tomInstances['#programma_dypa']);
    if (!ts) return setTimeout(attach, 50);

    const update = () => {
      let url = '';
      const val = ts.getValue();
      if (Array.isArray(val)) {
        if (val.length) url = (ts.options[val[0]] || {}).url_link || '';
      } else if (val) {
        url = (ts.options[val] || {}).url_link || '';
      }
      if (hid) hid.value = url || '';
      gotoA.href = url || '#';
      const dis = !url;
      gotoA.classList.toggle('disabled', dis);
      gotoA.setAttribute('aria-disabled', dis ? 'true' : 'false');
    };

    ts.on('load', update);
    ts.on('change', update);
    ts.on('item_add', update);
    ts.on('clear', update);
    update();
  })();
});
