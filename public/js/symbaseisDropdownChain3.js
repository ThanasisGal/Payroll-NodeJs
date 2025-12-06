// /static/js/symbaseisDropdownChain3.js (ESM) - FINAL VERSION
// Smart Lock με έλεγχο hidden fields + Full Cascade Clear

import { initTomDropdown } from './dropdown-item.js';

(() => {
	if (window.__symbaseisDropdownChain3MultiInit) return;
	window.__symbaseisDropdownChain3MultiInit = true;

	/* ═══════════════════════════════════════════════════════════════
	* 🔧 HELPER FUNCTIONS
	* ═══════════════════════════════════════════════════════════════ */
	
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

	/* ═══════════════════════════════════════════════════════════════
	* 🔐 SMART LOCK/UNLOCK BASED ON HIDDEN FIELDS
	* ═══════════════════════════════════════════════════════════════ */
	
	/**
	 * Έλεγχος: Αν το hidden field έχει τιμή → LOCK, αλλιώς → UNLOCK
	 */
	function updateLockState() {
		var symVal = ($('symbash_stathera')?.value || '').trim();
		var katVal = ($('kathgoria_symbashs_stathera')?.value || '').trim();
		var eidVal = ($('eidikothta_symbashs_stathera')?.value || '').trim();

		var symTS = ts('symbash');
		var katTS = ts('kathgoria_symbashs');
		var eidTS = ts('eidikothta_symbashs');

		// Σύμβαση: Αν ΓΕΜΑΤΟ → LOCK
		if (symTS) {
			if (symVal) {
				try { symTS.disable(); } catch(_){}
				symTS.wrapper?.classList.add('ts-locked');
			} else {
				try { symTS.enable(); } catch(_){}
				symTS.wrapper?.classList.remove('ts-locked');
			}
		}

		// Κατηγορία: Αν ΓΕΜΑΤΟ → LOCK
		if (katTS) {
			if (katVal) {
				try { katTS.disable(); } catch(_){}
				katTS.wrapper?.classList.add('ts-locked');
			} else {
				try { katTS.enable(); } catch(_){}
				katTS.wrapper?.classList.remove('ts-locked');
			}
		}

		// Ειδικότητα: Αν ΓΕΜΑΤΟ → LOCK
		if (eidTS) {
			if (eidVal) {
				try { eidTS.disable(); } catch(_){}
				eidTS.wrapper?.classList.add('ts-locked');
			} else {
				try { eidTS.enable(); } catch(_){}
				eidTS.wrapper?.classList.remove('ts-locked');
			}
		}

		// Εμφάνιση trash buttons ακόμα και όταν είναι locked
		setTimeout(ensureTrashButtonsVisible, 50);
	}

	/**
	 * Βεβαιώνει ότι τα trash buttons είναι ορατά και συνδεδεμένα
	 */
	function ensureTrashButtonsVisible() {
		var symTS = ts('symbash');
		var katTS = ts('kathgoria_symbashs');
		var eidTS = ts('eidikothta_symbashs');

		// Σύμβαση
		if (symTS && symTS.items && symTS.items.length > 0) {
			var symTrash = symTS.wrapper?.querySelector('.ts-single-reset-btn');
			if (symTrash) {
				symTrash.hidden = false;
				symTrash.style.display = '';
				
				if (!symTrash.__cascadeWired) {
					symTrash.__cascadeWired = true;
					symTrash.addEventListener('click', function(e) {
						e.preventDefault();
						e.stopPropagation();
						handleSymbashClear();
					}, true);
				}
			}
		}

		// Κατηγορία
		if (katTS && katTS.items && katTS.items.length > 0) {
			var katTrash = katTS.wrapper?.querySelector('.ts-single-reset-btn');
			if (katTrash) {
				katTrash.hidden = false;
				katTrash.style.display = '';
				
				if (!katTrash.__cascadeWired) {
					katTrash.__cascadeWired = true;
					katTrash.addEventListener('click', function(e) {
						e.preventDefault();
						e.stopPropagation();
						handleKathgoriaClear();
					}, true);
				}
			}
		}

		// Ειδικότητα
		if (eidTS && eidTS.items && eidTS.items.length > 0) {
			var eidTrash = eidTS.wrapper?.querySelector('.ts-single-reset-btn');
			if (eidTrash) {
				eidTrash.hidden = false;
				eidTrash.style.display = '';
				
				if (!eidTrash.__cascadeWired) {
					eidTrash.__cascadeWired = true;
					eidTrash.addEventListener('click', function(e) {
						e.preventDefault();
						e.stopPropagation();
						handleEidikothtaClear();
					}, true);
				}
			}
		}
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🔄 CHANGE HANDLERS
	* ═══════════════════════════════════════════════════════════════ */
	
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
		
		setTimeout(updateLockState, 100);
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

		clickEidTrashOrClear();
		
		setTimeout(updateLockState, 100);
	}

	function onEidChange(){
		var eidVals = getVals('eidikothta_symbashs').map(to4);
		var eidTS   = ts('eidikothta_symbashs');

		var eidTable = eidVals.map(function(e){
			var opt = eidTS && eidTS.options ? (eidTS.options[e] || {}) : {};
			return {
				kodikos: e,
				aa: String(opt.aa != null ? opt.aa : (opt.id != null ? opt.id : '')).trim(),
				afora_thn_symbash_kathgoria: String(opt.afora_thn_symbash_kathgoria != null ? opt.afora_thn_symbash_kathgoria : '').trim()
			};
		}).filter(function(x){ return !!x.kodikos; });

		setHiddenFirst('eidikothta_symbashs_stathera', eidVals);
		setHiddenJSON('eidikothta_symbashs_table', eidTable);
		
		setTimeout(function(){
			try { window.dispatchEvent(new Event('eidikothtaChanged')); } catch(e) {}
		}, 50);
			
		setTimeout(updateLockState, 100);
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🗑️ TRASH HANDLERS - Full Cascade Clear
	* ═══════════════════════════════════════════════════════════════ */

	/**
	 * Trash Σύμβασης → Clear ΟΛΑ (Συμβάσεις, Κατηγορίες, Ειδικότητες, Container)
	 */
	function handleSymbashClear() {
		
		var symTS = ts('symbash');
		
		// 1️⃣ Καθαρισμός Σύμβασης
		if (symTS) {
			try { symTS.setValue('', true); } catch(_){}
			try { symTS.clearOptions(); } catch(_){}
		}
		
		var symHidden = $('symbash_stathera');
		if (symHidden) {
			symHidden.value = '';
			try { symHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		
		// 2️⃣ Καθαρισμός Κατηγοριών
		var katTS = ts('kathgoria_symbashs');
		if (katTS) {
			try { katTS.setValue('', true); } catch(_){}
			try { katTS.clearOptions(); } catch(_){}
		}
		
		var katHidden = $('kathgoria_symbashs_stathera');
		var katTable = $('kathgoria_symbashs_table');
		if (katHidden) {
			katHidden.value = '';
			try { katHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		if (katTable) {
			katTable.value = '[]';
			try { katTable.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		
		// 3️⃣ Καθαρισμός Ειδικοτήτων
		var eidTS = ts('eidikothta_symbashs');
		if (eidTS) {
			try { eidTS.setValue('', true); } catch(_){}
			try { eidTS.clearOptions(); } catch(_){}
		}
		
		var eidHidden = $('eidikothta_symbashs_stathera');
		var eidTable = $('eidikothta_symbashs_table');
		if (eidHidden) {
			eidHidden.value = '';
			try { eidHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		if (eidTable) {
			eidTable.value = '[]';
			try { eidTable.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
			
		// 4️⃣ Καθαρισμός Container
		if (typeof window.clearStoixeiaSymbaseonContainer === 'function') {
			window.clearStoixeiaSymbaseonContainer();
		}
			
		// 5️⃣ Update lock state (όλα unlocked)
		setTimeout(function() {
			updateLockState();
		}, 150);
	}

	/**
	 * Trash Κατηγοριών → Clear Κατηγορίες, Ειδικότητες, Container
	 */
	function handleKathgoriaClear() {
		
		var katTS = ts('kathgoria_symbashs');
		
		// 1️⃣ Καθαρισμός Κατηγοριών
		if (katTS) {
			try { katTS.setValue('', true); } catch(_){}
			try { katTS.clearOptions(); } catch(_){}
		}
		
		var katHidden = $('kathgoria_symbashs_stathera');
		var katTable = $('kathgoria_symbashs_table');
		if (katHidden) {
			katHidden.value = '';
			try { katHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		if (katTable) {
			katTable.value = '[]';
			try { katTable.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		
		// 2️⃣ Καθαρισμός Ειδικοτήτων
		var eidTS = ts('eidikothta_symbashs');
		if (eidTS) {
			try { eidTS.setValue('', true); } catch(_){}
			try { eidTS.clearOptions(); } catch(_){}
		}
		
		var eidHidden = $('eidikothta_symbashs_stathera');
		var eidTable = $('eidikothta_symbashs_table');
		if (eidHidden) {
			eidHidden.value = '';
			try { eidHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		if (eidTable) {
			eidTable.value = '[]';
			try { eidTable.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		
		// 3️⃣ Καθαρισμός Container
		if (typeof window.clearStoixeiaSymbaseonContainer === 'function') {
			window.clearStoixeiaSymbaseonContainer();
		}
		
		// 4️⃣ Update lock state
		setTimeout(function() {
			updateLockState();
		}, 150);
	}

	/**
	 * Trash Ειδικοτήτων → Clear Ειδικότητες, Container
	 */
	function handleEidikothtaClear() {

		var eidTS = ts('eidikothta_symbashs');
		
		// 1️⃣ Καθαρισμός Ειδικοτήτων
		if (eidTS) {
			try { eidTS.setValue('', true); } catch(_){}
			try { eidTS.clearOptions(); } catch(_){}
		}
		
		var eidHidden = $('eidikothta_symbashs_stathera');
		var eidTable = $('eidikothta_symbashs_table');
		if (eidHidden) {
			eidHidden.value = '';
			try { eidHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		if (eidTable) {
			eidTable.value = '[]';
			try { eidTable.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
		}
		
		// 2️⃣ Καθαρισμός Container
		if (typeof window.clearStoixeiaSymbaseonContainer === 'function') {
			window.clearStoixeiaSymbaseonContainer();
		}
		
		// 3️⃣ Trigger event για το watcher
		setTimeout(function(){
			try { window.dispatchEvent(new Event('eidikothtaChanged')); } catch(e) {}
		}, 100);
		
		// 4️⃣ Update lock state
		setTimeout(function() {
			updateLockState();
		}, 150);
	}

	/**
	 * Helper: Trash των Ειδικοτήτων (fallback αν δεν υπάρχει το κουμπί)
	 */
	function clickEidTrashOrClear(){
		var btn =
			document.querySelector('.row-trash-btn-eidikothta_symbashs') ||
			document.querySelector('.ts-eid-trash-external') ||
			document.querySelector('.ts-inline-trash-eidikothta_symbashs');

		if (btn){ btn.click(); return; }

		var eidSel = $('eidikothta_symbashs');
		var eidTS  = eidSel && eidSel.tomselect ? eidSel.tomselect : null;
		if (eidTS){
			try{ eidTS.clear(true); }catch(_){}
			try{ eidTS.clearOptions(); }catch(_){}
			try{ eidTS.refreshOptions(false); }catch(_){}
		}else if (eidSel){
			eidSel.value = '';
			while (eidSel.options && eidSel.options.length) eidSel.remove(0);
		}

		var hid1 = $('eidikothta_symbashs_stathera'); if (hid1) hid1.value = '';
		var hid2 = $('eidikothta_symbashs_table');    if (hid2) hid2.value = '[]';
		try{ hid1 && hid1.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
		try{ hid2 && hid2.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🔧 INIT / REINIT
	* ═══════════════════════════════════════════════════════════════ */
	
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
			var S = inst || ts('symbash'); 
			if (S && S.on) {
				S.on('change', onSymChange);
				S.on('clear', handleSymbashClear);
			}
		}
		if (selector === '#kathgoria_symbashs'){
			bindTS(inst || ts('kathgoria_symbashs'), function(){ onKatChange(); });
			var K = inst || ts('kathgoria_symbashs');
			if (K && K.on) K.on('clear', handleKathgoriaClear);
		}
		if (selector === '#eidikothta_symbashs'){
			var E = inst || ts('eidikothta_symbashs');
			bindTS(E, function(){ onEidChange(); });
			if (E) {
				E.settings.openOnFocus = false;
				E.settings.openOnClick = true;
			}
			if (E && E.on) E.on('clear', handleEidikothtaClear);
		}

		// Wire trash buttons μετά το init
		setTimeout(ensureTrashButtonsVisible, 200);

		return inst || ts(selector.replace('#',''));
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🛡️ ΕΙΔΙΚΗ ΛΟΓΙΚΗ ΓΙΑ ΕΙΔΙΚΟΤΗΤΕΣ (Click-Only Open)
	* ═══════════════════════════════════════════════════════════════ */
	
	function isEidTableEmpty(){
		var h = $('eidikothta_symbashs_table');
		var v = h && typeof h.value === 'string' ? h.value.trim() : '';
		if (!v || v === '[]') return true;
		try{ var arr = JSON.parse(v); return Array.isArray(arr) ? arr.length === 0 : true; }
		catch(_){ return v === '[]'; }
	}

	function wireEidClickOpenOnly(){
		var E = ts('eidikothta_symbashs'); if (!E) return;
		var ctrl = E.control; var wrap = E.wrapper; var dd = E.dropdown;
		if (!ctrl || ctrl.__eidClickOnlyWired) return;
		ctrl.__eidClickOnlyWired = true;

		ctrl.__requireClickToOpen = false;
		var loadingLock = false;

		ctrl.addEventListener('mousedown', function(ev){
			// GUARD: Αν είναι disabled, ΜΗΝ κάνεις ΤΙΠΟΤΑ
			if (E.isDisabled) {
				try { ev.preventDefault(); } catch(_){}
				try { ev.stopPropagation(); } catch(_){}
				try { ev.stopImmediatePropagation(); } catch(_){}
				return false;
			}

			var t = ev.target;
			var insideDropdown = dd && dd.contains ? dd.contains(t) : false;
			if (insideDropdown) return;
			if (t && t.closest && (t.closest('.ts-overflow-indicator') || t.closest('.ts-overflow-popup'))) {
				try { ev.preventDefault(); } catch(_){}
				try { ev.stopImmediatePropagation(); } catch(_){}
				try { ev.stopPropagation(); } catch(_){}
				return;
			}

			ctrl.__requireClickToOpen = false;

			if (!loadingLock && isEidTableEmpty()){
				loadingLock = true;
				clickEidTrashOrClear();
				try{ E.setTextboxValue(''); }catch(_){}
				try{ E.load(''); }catch(_){}
				setTimeout(function(){ loadingLock = false; }, 400);
			}

			queueMicrotask(function(){
				try{ E.open(); }catch(_){}
			});
		}, true);

		if (!document.__eidOutsideCloseWired){
			document.__eidOutsideCloseWired = true;
			document.addEventListener('mousedown', function(ev){
				var t = ev.target;
				if (t && t.closest && (t.closest('.ts-overflow-indicator') || t.closest('.ts-overflow-popup'))) {
					return;
				}
				if ((wrap && wrap.contains && wrap.contains(t)) || (dd && dd.contains && dd.contains(t))) return;

				if (E.isOpen){
					try{ E.close(); }catch(_){}
					try{ E.control_input && E.control_input.blur && E.control_input.blur(); }catch(_){}
					ctrl.__requireClickToOpen = true;
				}
			}, true);
		}

		E.on('focus', function(){
			// GUARD: Αν είναι disabled, ΜΗΝ ανοίγεις
			if (E.isDisabled) {
				try { E.blur(); } catch(_){}
				return;
			}

			if (ctrl.__requireClickToOpen) {
				E.ignoreFocusOpen = true;
				setTimeout(function(){ E.ignoreFocusOpen = false; }, 0);
			}
		});
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🚀 BOOTSTRAP
	* ═══════════════════════════════════════════════════════════════ */
	
	reinitTS('#symbash',             '/api/dropdown/symbaseis/symbash');
	reinitTS('#kathgoria_symbashs',  '/api/dropdown/symbaseis/kathgoria_symbashs');
	reinitTS('#eidikothta_symbashs', '/api/dropdown/symbaseis/eidikothta_symbashs_multi');

	wireEidClickOpenOnly();

	var mo = new MutationObserver(function(){
		wireEidClickOpenOnly();
	});
	mo.observe(document.body, { childList:true, subtree:true });

	setTimeout(function(){ 
		onSymChange(); 
		onKatChange(); 
		onEidChange(); 
		updateLockState();
	}, 0);

	/* ═══════════════════════════════════════════════════════════════
	* 📤 EXPORT (για εξωτερική χρήση)
	* ═══════════════════════════════════════════════════════════════ */
	
	window.__symbaseisHelpers = {
		$,
		ts,
		to4,
		getVals,
		setHiddenFirst,
		setHiddenJSON,
		clickEidTrashOrClear,
		reinitTS,
		updateLockState,
		ensureTrashButtonsVisible,
		handleSymbashClear,
		handleKathgoriaClear,
		handleEidikothtaClear
	};

})();