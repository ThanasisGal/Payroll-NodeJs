(function(){
  function pad4(v){
    const d = String(v ?? '').replace(/\D/g,'');
    if (!d) return '';
    const n = parseInt(d,10);
    return Number.isFinite(n) ? String(n).padStart(4,'0')
                              : d.slice(-4).padStart(4,'0');
  }

  function attachTomInlineSummary(tom, el, opts){
    if (!tom || !el) return;
    // μόνο για πολλαπλά
    if (tom.settings.maxItems === 1) return;

    const ctrl = tom.control;
    if (!ctrl) return;

    const peek =
      Number(opts?.peek ?? el.dataset.summaryPeek ?? el.dataset.inlinePeek ?? 1);

    function render(){
      const vals = tom.items || [];
      if (!vals.length){
        ctrl.removeAttribute('data-inline-summary');
        ctrl.classList.remove('ts-has-inline-summary');
        return;
      }

      const labels = vals.map(v=>{
        const o = tom.options?.[v] || {};
        const k = (o.kodikos != null) ? pad4(o.kodikos) : pad4(v);
        // Προτεραιότητα: label/text → "0001 - περιγραφή" → "0001"
        return (o.label || o.text || (o.perigrafh ? `${k} - ${o.perigrafh}` : k));
      });

      const shown = Math.max(0, peek);
      const head  = labels.slice(0, shown).join(', ');
      const more  = labels.length - shown;
      const text  = (head && more > 0) ? `${head} +${more}` : head || `Επιλεγμένα: ${vals.length}`;

      ctrl.dataset.inlineSummary = text;
      ctrl.classList.add('ts-has-inline-summary');
    }

    ['item_add','item_remove','change','clear','load','update'].forEach(ev =>
      tom.on(ev, render)
    );

    const mo = new MutationObserver(render);
    mo.observe(ctrl, { childList: true, subtree: true });

    setTimeout(render, 0);
  }

  // Κάν’ το global για να το καλείς όπου θες
  window.attachTomInlineSummary = attachTomInlineSummary;

  // Auto-attach για συγκεκριμένα ids (πρόσθεσε/βγάλε όποια θες)
  document.addEventListener('DOMContentLoaded', ()=>{
    ['kathgoria_symbashs','eidikothta_symbashs'].forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;

      const go = ()=> window.attachTomInlineSummary(el.tomselect, el, { peek: 1 });
      if (el.tomselect) go();
      else {
        const t = setInterval(()=>{
          if (el.tomselect){ clearInterval(t); go(); }
        }, 50);
        setTimeout(()=>clearInterval(t), 5000);
      }
    });
  });
})();
