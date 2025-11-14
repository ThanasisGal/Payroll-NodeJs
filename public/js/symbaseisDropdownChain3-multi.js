// /static/js/symbaseisDropdownChain3-multi.js  (ESM)
import { initTomDropdown } from '/static/js/dropdown-item.js';

(() => {
	if (window.__symbaseisDropdownChain3MultiInit) return;
	window.__symbaseisDropdownChain3MultiInit = true;

	/* ───────────────────────── Helpers ───────────────────────── */
	function $(id){ return document.getElementById(id); }
	function ts(id){ var el = $(id); return el && el.tomselect ? el.tomselect : null; }

	function to4(v){
		var d = String(v == null ? '' : v).replace(/\D/g,'');
		if (!d) return '';
		var n = parseInt(d,10);
		return isFinite(n) ? String(n).padStart(4,'0') : d.slice(-4).padStart(4,'0');
	}

	function getVals(id){
		var el = $(id); if (!el) return [];
		if (el.tomselect){
		var v = el.tomselect.getValue();
		return Array.isArray(v) ? v : (v ? [v] : []);
		}
		if (el.multiple) return Array.prototype.map.call(el.selectedOptions || [], function(o){ return o.value; });
		return el.value ? [el.value] : [];
	}

	function setHiddenFirst(hidId, vals){
		var h = $(hidId);
		if (h) h.value = Array.isArray(vals) ? (vals[0] || '') : (vals || '');
	}

	function setHiddenJSON(hidId, obj){
		var h = $(hidId); if (!h) return;
		var next = JSON.stringify(obj || []);
		h.value = next;
		try{ h.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
	}

	/* ─────────────── Trash των Ειδικοτήτων ─────────────── */
	function clickEidTrashOrClear(){
		var btn =
		document.querySelector('.row-trash-btn-eidikothta_symbashs') ||
		document.querySelector('.ts-eid-trash-external') ||
		document.querySelector('.ts-inline-trash-eidikothta_symbashs');

		if (btn){ btn.click(); return; }

		var eidSel = $('#eidikothta_symbashs');
		var eidTS  = eidSel && eidSel.tomselect ? eidSel.tomselect : null;
		if (eidTS){
		try{ eidTS.clear(true); }catch(_){}
		try{ eidTS.clearOptions(); }catch(_){}
		try{ eidTS.refreshOptions(false); }catch(_){}
		}else if (eidSel){
		eidSel.value = '';
		while (eidSel.options && eidSel.options.length) eidSel.remove(0);
		}

		var hid1 = $('#eidikothta_symbashs_stathera'); if (hid1) hid1.value = '';
		var hid2 = $('#eidikothta_symbashs_table');    if (hid2) hid2.value = '[]';
		try{ hid1 && hid1.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
		try{ hid2 && hid2.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
	}

	/* ───────────────────── Change handlers ───────────────────── */
	function onSymChange(){
		var symVals = getVals('symbash').map(to4);
		setHiddenFirst('symbash_stathera', symVals);

		var tsKat = ts('kathgoria_symbashs');
		if (tsKat){
		try{ tsKat.clear(true); }catch(_){}
		try{ tsKat.clearOptions(); }catch(_){}
		try{ tsKat.refreshOptions(false); }catch(_){}
		}
		setHiddenJSON('kathgoria_symbashs_table', []);
		setHiddenFirst('kathgoria_symbashs_stathera', '');

		clickEidTrashOrClear();
	}

	function onKatChange(){
		var sym4    = (getVals('symbash').map(to4)[0] || '');
		var katVals = getVals('kathgoria_symbashs').map(to4);
		var katTS   = ts('kathgoria_symbashs');

		var katTable = katVals.map(function(k){
		var opt = katTS && katTS.options ? (katTS.options[k] || {}) : {};
		var aa  = String(opt.afora_thn_symbash_kathgoria || (sym4 + k)).trim();
		return { aa: aa, kodikos: k };
		}).filter(function(x){ return !!x.kodikos; });

		setHiddenFirst('kathgoria_symbashs_stathera', katVals);
		setHiddenJSON('kathgoria_symbashs_table', katTable);

		// αδειάζουμε τις ειδικότητες· ο χρήστης θα ανοίξει ξανά το TS αν θέλει
		clickEidTrashOrClear();
	}

	function onEidChange(){
		var eidVals = getVals('eidikothta_symbashs').map(to4);
		var eidTS   = ts('eidikothta_symbashs');
	
		// Βρες το option είτε με key = value είτε — fallback — με ταυτοποίηση στο aa/id
		function findOptByAA(e4){
		if (eidTS && eidTS.options) {
			// direct hit (keyed by value)
			var direct = eidTS.options[e4];
			if (direct) return direct;
			// fallback: scan by aa/id που να ισοδυναμεί στο to4
			for (var k in eidTS.options){
			var o = eidTS.options[k];
			var aaLike = String(o && (o.aa != null ? o.aa : (o.id != null ? o.id : ''))).trim();
			if (to4(aaLike) === e4) return o;
			}
		}
		return {};
		}
	
		var eidTable = eidVals.map(function(e4){
		var opt = findOptByAA(e4) || {};
		
		// ΠΑΝΤΑ 4-ψηφιοποίηση
		var aa  = to4(opt.aa != null ? opt.aa : (opt.id != null ? opt.id : e4));
		var kod = to4(opt.kodikos != null ? opt.kodikos : (opt.value_kodikos != null ? opt.value_kodikos : e4 /* τελικό fallback */));
		
		return {
			kodikos: kod,                        // <-- ΤΩΡΑ από opt.kodikos (αν υπάρχει)
			aa: aa,                              // το aa παραμένει το aa
			afora_thn_symbash_kathgoria: String(
			opt.afora_thn_symbash_kathgoria != null ? opt.afora_thn_symbash_kathgoria : ''
			).trim()
		};
		}).filter(function(x){ return !!x.aa; });
	
		setHiddenFirst('eidikothta_symbashs_stathera', eidVals);
		setHiddenJSON('eidikothta_symbashs_table', eidTable);
	}

	/* ───────────────────── Init / Reinit ───────────────────── */
	function bindTS(inst, handler){
		if (!inst || typeof inst.on !== 'function' || inst.__chain3Bound) return;
		inst.__chain3Bound = true;
		var fire = function(){ queueMicrotask(function(){ handler(inst); }); };
		['change','item_add','item_remove','clear'].forEach(function(e){ inst.on(e, fire); });
		try{
		if (inst.input) inst.input.addEventListener('change', fire, { passive:true });
		if (inst.control) inst.control.addEventListener('click', function(e){
			if (e.target && e.target.closest && e.target.closest('.remove')) fire();
		}, { passive:true });
		}catch(_){}
		setTimeout(fire, 0);
	}

	function reinitTS(selector, url, extraParams){
		var node = document.querySelector(selector);
		if (!node) return null;
		if (node.tomselect) node.tomselect.destroy();

		var inst = null;
		try{
		inst = initTomDropdown && initTomDropdown({
			selector: selector,
			url: url,
			extraParams: extraParams || {},
			minChars: 0
		});
		}catch(e){
		console.error('initTomDropdown failed for', selector, e);
		}

		if (selector === '#symbash'){
		var S = inst || ts('symbash'); if (S && S.on) S.on('change', onSymChange);
		}
		if (selector === '#kathgoria_symbashs'){
		bindTS(inst || ts('kathgoria_symbashs'), function(){ onKatChange(); });
		}
		if (selector === '#eidikothta_symbashs'){
		var E = inst || ts('eidikothta_symbashs');
		bindTS(E, function(){ onEidChange(); });
		// ανοίγει μόνο με κλικ, όχι από focus
		if (E){
			E.settings.openOnFocus = false;
			E.settings.openOnClick = true;
		}
		}

		return inst || ts(selector.replace('#',''));
	}

	/* ───── Auto-clear στο click ΜΟΝΟ όταν το table είναι [] ───── */
	function isEidTableEmpty(){
		var h = $('#eidikothta_symbashs_table');
		var v = h && typeof h.value === 'string' ? h.value.trim() : '';
		if (!v || v === '[]') return true;
		try{ var arr = JSON.parse(v); return Array.isArray(arr) ? arr.length === 0 : true; }
		catch(_){ return v === '[]'; }
	}

	/* ───── Άνοιγμα ΜΟΝΟ με κλικ + (αν [] ) clear & fresh load ───── */
	function wireEidClickOpenOnly(){
		var E = ts('eidikothta_symbashs'); if (!E) return;
		var ctrl = E.control; var wrap = E.wrapper; var dd = E.dropdown;
		if (!ctrl || ctrl.__eidClickOnlyWired) return;
		ctrl.__eidClickOnlyWired = true;

		// flag: μετά από outside click πρέπει να γίνει ρητό κλικ για άνοιγμα
		ctrl.__requireClickToOpen = false;
		var loadingLock = false;

		// Κλικ στο control ⇒ άνοιξε ρητά (και αν το table είναι [] κάνε clear+load πρώτα)
		ctrl.addEventListener('mousedown', function(ev){
		var t = ev.target;
		var insideDropdown = dd && dd.contains ? dd.contains(t) : false;
		if (insideDropdown) return; // κλικ πάνω σε option, άφηνέ το στον TS
		// 🚫 Guard: αν το κλικ είναι πάνω στο +N ή μέσα στο overflow-popup ΜΗΝ ανοίγεις το TS
		if (t && t.closest && (t.closest('.ts-overflow-indicator') || t.closest('.ts-overflow-popup'))) {
			try { ev.preventDefault(); } catch(_){}
			try { ev.stopImmediatePropagation(); } catch(_){}
			try { ev.stopPropagation(); } catch(_){}
			return;
		}


		// επιτρέπουμε άνοιγμα από αυτό το κλικ
		ctrl.__requireClickToOpen = false;

		// Αν είναι κενό, καθάρισε & φόρτωσε πριν ανοίξει
		if (!loadingLock && isEidTableEmpty()){
			loadingLock = true;
			clickEidTrashOrClear();
			try{ E.setTextboxValue(''); }catch(_){}
			try{ E.load(''); }catch(_){}
			setTimeout(function(){ loadingLock = false; }, 400);
		}

		// άνοιξε ρητά (openOnFocus=false, άρα χρειάζεται call)
		// άφησέ το στο επόμενο microtask ώστε να μην «κόψει» το mousedown του TS
		queueMicrotask(function(){
			try{ E.open(); }catch(_){}
		});
		}, true);

		// Με Tab/focus ΔΕΝ ανοίγει (openOnFocus=false). Δεν χρειάζεται handler.

		// Outside click ⇒ κλείσε και ζήτα ρητό κλικ για reopen
		if (!document.__eidOutsideCloseWired){
		document.__eidOutsideCloseWired = true;
		document.addEventListener('mousedown', function(ev){
			var t = ev.target;
			// ⛔️ Μην αγγίζεις κλικ στο +N ή μέσα στο overflow-popup
			if (t && t.closest && (t.closest('.ts-overflow-indicator') || t.closest('.ts-overflow-popup'))) {
			return;
			}
			if ((wrap && wrap.contains && wrap.contains(t)) || (dd && dd.contains && dd.contains(t))) return;

			if (E.isOpen){
			try{ E.close(); }catch(_){}
			try{ E.control_input && E.control_input.blur && E.control_input.blur(); }catch(_){}
			ctrl.__requireClickToOpen = true; // μόνο ρητό κλικ για reopen
			}
		}, true);
		}

		// Αν προσπαθεί να ανοίξει από focus, μπλόκαρέ το.
		// (ασφάλεια, παρότι έχουμε openOnFocus=false)
		E.on('focus', function(){
		if (ctrl.__requireClickToOpen) {
			E.ignoreFocusOpen = true;
			setTimeout(function(){ E.ignoreFocusOpen = false; }, 0);
		}
		});
	}

	/* ───────────────────────── Bootstrap ───────────────────────── */
	reinitTS('#symbash',             '/api/dropdown/symbaseis/symbash');
	reinitTS('#kathgoria_symbashs',  '/api/dropdown/symbaseis/kathgoria_symbashs');
	reinitTS('#eidikothta_symbashs', '/api/dropdown/symbaseis/eidikothta_symbashs_multi');

	// Άνοιγμα ΜΟΝΟ με κλικ + (αν [] ) clear&load
	wireEidClickOpenOnly();

	// Re-wire σε δυναμικά remounts
	var mo = new MutationObserver(function(){
		wireEidClickOpenOnly();
	});
	mo.observe(document.body, { childList:true, subtree:true });

	// Αρχικές ενημερώσεις
	setTimeout(function(){ onSymChange(); onKatChange(); onEidChange(); }, 0);
})();
