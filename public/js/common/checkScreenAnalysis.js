(function () {
  const MIN = 1280;
  const DISMISS_KEY = 'mw_warn_dismissed';
  const SNOOZE_KEY  = 'mw_warn_snooze_date';

  const url   = new URL(location.href);
  const FORCE = url.searchParams.has('mwForce') || sessionStorage.getItem('mw_force') === '1';
  const UNDO  = url.searchParams.has('mwUndoSnooze');

  const todayKey        = () => new Date().toISOString().slice(0,10);
  const isDismissed     = () => sessionStorage.getItem(DISMISS_KEY) === '1';
  const clearDismiss    = () => sessionStorage.removeItem(DISMISS_KEY);
  const isSnoozedToday  = () => localStorage.getItem(SNOOZE_KEY) === todayKey();

  let overlay, card, widthEl, statusBar;

  function currentWidth(){
    return Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  }

  // ---- helpers (status line στην κάρτα) ----
  function setStatus(text){
    if (!statusBar) return;
    statusBar.textContent = text;
    statusBar.style.opacity = '1';
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => { statusBar.style.opacity = '0'; }, 1800);
  }

  // ---------- UI (center modal, warning) ----------
  function ensureUI(){
    if (overlay) return overlay;

    // Backdrop
    overlay = document.createElement('div');
    overlay.id = 'mw-minwidth-overlay';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.35)',
      zIndex:'2147483000', display:'none'
    });

    // Card (warning theme)
    card = document.createElement('div');
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','true');
    card.setAttribute('aria-labelledby','mwMinWidthTitle');
    Object.assign(card.style, {
      position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
      width:'min(92vw, 560px)',
      background:'#FFF8E1',               // light amber
      color:'#5A3E00',                    // dark amber text
      border:'1px solid #FFD666',
      borderRadius:'14px',
      boxShadow:'0 16px 60px rgba(0,0,0,.25)',
      padding:'18px 20px 16px',
      fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    });

    const title = document.createElement('div');
    title.id = 'mwMinWidthTitle';
    title.textContent = 'Απαιτείται μεγαλύτερη ανάλυση για άνετη χρήση';
    Object.assign(title.style, {fontWeight:'700', fontSize:'16px', marginBottom:'8px'});

    const msg = document.createElement('div');
    msg.style.cssText = 'font-size:13.5px; line-height:1.5; margin-bottom:10px;';
    msg.innerHTML = `Η εφαρμογή λειτουργεί καλύτερα με ελάχιστη ανάλυση <b>${MIN}px</b>.<br>
      Τρέχουσα ανάλυση: <span id="mwCurWidth"
      style="display:inline-block;padding:0 6px;border-radius:8px;background:#FFF3C4;border:1px solid #FFE08A;">—</span>`;

    const tips = document.createElement('ul');
    tips.style.cssText = 'font-size:12.8px;margin:0 0 12px 18px;line-height:1.5;padding:0;';
    tips.innerHTML = `
      <li>Μεγάλωσε το παράθυρο του browser.</li>
      <li>Ή μείωσε προσωρινά το ζουμ (<kbd>Ctrl</kbd> <kbd>-</kbd> / <kbd>Cmd</kbd> <kbd>-</kbd>).</li>
      <li>Ή χρησιμοποίησε οθόνη/προσανατολισμό με μεγαλύτερη ανάλυση.</li>`;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;';

    function btn(label, variant){
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'font-size:12.5px;line-height:1.2;padding:9px 12px;border-radius:10px;cursor:pointer;border:1px solid;';
      if(variant==='primary'){
        b.style.background = '#B26A00'; b.style.color='#fff'; b.style.borderColor='#B26A00';
      }else if(variant==='ghost'){
        b.style.background = '#FFF'; b.style.color='#5A3E00'; b.style.borderColor='#FFE08A';
      }else{
        b.style.background = '#FFFDF5'; b.style.color='#5A3E00'; b.style.borderColor='#FFD666';
      }
      b.onmouseenter = ()=> b.style.filter='brightness(.98)';
      b.onmouseleave = ()=> b.style.filter='none';
      return b;
    }

    const bSnooze = btn('Μην εμφανιστεί ξανά σήμερα','ghost');
    const bUndo   = btn('Ακύρωση σίγασης','default');
    const bOk     = btn('ΟΚ, κατάλαβα','primary');

    // status bar (ορατή επιβεβαίωση ενεργειών)
    statusBar = document.createElement('div');
    statusBar.id = 'mwMinWidthStatus';
    statusBar.style.cssText = 'margin-top:6px;font-size:12.5px;color:#5A3E00;opacity:0;transition:opacity .2s';

    actions.append(bSnooze,bUndo,bOk);
    card.append(title,msg,tips,actions,statusBar);
    overlay.append(card);
    document.body.appendChild(overlay);

    // refs & handlers
    widthEl = card.querySelector('#mwCurWidth');

    bSnooze.addEventListener('click', () => {
      try { localStorage.setItem(SNOOZE_KEY, todayKey()); } catch(e){}
      setStatus('Θα παραμείνει σιωπηλό μέχρι το τέλος της ημέρας.');
      hide();
    });

    bUndo.addEventListener('click', () => {
      try { localStorage.removeItem(SNOOZE_KEY); } catch(e){}
      try { sessionStorage.removeItem(DISMISS_KEY); } catch(e){}
      setStatus('Η σίγαση ακυρώθηκε.');
      // ενημέρωσε το «Τρέχον πλάτος» και επανέλεγξε χωρίς να κλείσεις το modal
      widthEl.textContent = currentWidth() + 'px';
      check();
    });

    bOk.addEventListener('click', () => {
      try { sessionStorage.setItem(DISMISS_KEY,'1'); } catch(e){}
      hide();
    });

    // Click έξω από την κάρτα => session dismiss
    overlay.addEventListener('click', (e)=>{
      if(e.target === overlay){
        try { sessionStorage.setItem(DISMISS_KEY,'1'); } catch(e){}
        hide();
      }
    });

    // ESC => session dismiss
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' && overlay.style.display!=='none'){
        try { sessionStorage.setItem(DISMISS_KEY,'1'); } catch(e){}
        hide();
      }
    });

    // live ενημέρωση του «Τρέχον πλάτος» όσο είναι ορατό το modal
    window.addEventListener('resize', () => {
      if (overlay && overlay.style.display !== 'none' && widthEl){
        widthEl.textContent = currentWidth() + 'px';
      }
    });

    return overlay;
  }

  function show(){
    ensureUI();
    if (widthEl) widthEl.textContent = currentWidth() + 'px';
    overlay.style.display = 'block';
    const firstBtn = overlay.querySelector('button');
    if (firstBtn) firstBtn.focus({preventScroll:true});
  }

  function hide(){
    if(overlay) overlay.style.display = 'none';
  }

  // ---------- Κύριος έλεγχος ----------
  function check(){
    const w = currentWidth();

    if (UNDO){
      try { localStorage.removeItem(SNOOZE_KEY); } catch(e){}
      try { sessionStorage.removeItem(DISMISS_KEY); } catch(e){}
    }

    if (FORCE){
      try { sessionStorage.removeItem(DISMISS_KEY); } catch(e){}
      try { localStorage.removeItem(SNOOZE_KEY); } catch(e){}
      show(); return;
    }

    if (w >= MIN){ clearDismiss(); hide(); return; }
    if (isSnoozedToday() || isDismissed()){ hide(); return; }
    show();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check, {once:true});
  } else {
    check();
  }

  // resize debounce
  let raf = null;
  window.addEventListener('resize', ()=>{
    if(raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(check);
  });

  // Helpers για κονσόλα/QA
  window.mwForceOn    = ()=>{ sessionStorage.setItem('mw_force','1'); check(); };
  window.mwForceOff   = ()=>{ sessionStorage.removeItem('mw_force'); check(); };
  window.mwUndoSnooze = ()=>{ localStorage.removeItem(SNOOZE_KEY); sessionStorage.removeItem(DISMISS_KEY); check(); };
  window.mwResetWarn  = ()=>{ localStorage.removeItem(SNOOZE_KEY); sessionStorage.removeItem(DISMISS_KEY); check(); };
})();
