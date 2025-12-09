// /static/js/symbaseisDropdownChain3.js (ESM) - FINAL VERSION
// Smart Lock με έλεγχο hidden fields + Full Cascade Clear

import { initTomDropdown } from './dropdown-item.js';

(() => {

	if (window.__symbaseisDropdownChain3MultiInit) {
		return;
	}
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
		// suppress observer when we intentionally update
		try { h.__suppressObserver = true; } catch(_) {}
		h.value = next;
		try{ h.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
		try { h.__suppressObserver = false; } catch(_) {}
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🔐 SMART LOCK/UNLOCK BASED ON HIDDEN FIELDS
	* ═══════════════════════════════════════════════════════════════ */

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
		// suppress observer while we write hidden fields
		var hid = $('symbash_stathera');
		if (hid) { try { hid.__suppressObserver = true; } catch(_){} }
		setHiddenFirst('symbash_stathera', symVals);
		if (hid) { try { hid.__suppressObserver = false; } catch(_){} }

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

		// suppress while writing
		var hidK = $('kathgoria_symbashs_stathera');
		if (hidK) { try { hidK.__suppressObserver = true; } catch(_){} }
		setHiddenFirst('kathgoria_symbashs_stathera', katVals);
		setHiddenJSON('kathgoria_symbashs_table', katTable);
		if (hidK) { try { hidK.__suppressObserver = false; } catch(_){} }

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

		var hidE = $('eidikothta_symbashs_stathera');
		if (hidE) { try { hidE.__suppressObserver = true; } catch(_){} }
		setHiddenFirst('eidikothta_symbashs_stathera', eidVals);
		setHiddenJSON('eidikothta_symbashs_table', eidTable);
		if (hidE) { try { hidE.__suppressObserver = false; } catch(_){} }

		setTimeout(function(){
			try { window.dispatchEvent(new Event('eidikothtaChanged')); } catch(e) {}
		}, 50);

		setTimeout(updateLockState, 100);
	}

	/* ═══════════════════════════════════════════════════════════════
	* 🗑️ TRASH HANDLERS - Full Cascade Clear
	* ═══════════════════════════════════════════════════════════════ */

	function handleSymbashClear() {

		var symTS = ts('symbash');

		// 1️⃣ Καθαρισμός Σύμβασης
		if (symTS) {
			try { symTS.setValue('', true); } catch(_){}
			try { symTS.clearOptions(); } catch(_){}
		}

		var symHidden = $('symbash_stathera');
		if (symHidden) {
			// suppress observer around programmatic changes
			try { symHidden.__suppressObserver = true; } catch(_) {}
			symHidden.value = '';
			try { symHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
			try { symHidden.__suppressObserver = false; } catch(_) {}
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
			try { katHidden.__suppressObserver = true; } catch(_) {}
			katHidden.value = '';
			try { katHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
			try { katHidden.__suppressObserver = false; } catch(_) {}
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
			try { eidHidden.__suppressObserver = true; } catch(_) {}
			eidHidden.value = '';
			try { eidHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
			try { eidHidden.__suppressObserver = false; } catch(_) {}
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
			try { katHidden.__suppressObserver = true; } catch(_) {}
			katHidden.value = '';
			try { katHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
			try { katHidden.__suppressObserver = false; } catch(_) {}
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
			try { eidHidden.__suppressObserver = true; } catch(_) {}
			eidHidden.value = '';
			try { eidHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
			try { eidHidden.__suppressObserver = false; } catch(_) {}
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
			try { eidHidden.__suppressObserver = true; } catch(_) {}
			eidHidden.value = '';
			try { eidHidden.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
			try { eidHidden.__suppressObserver = false; } catch(_) {}
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
		if (!node) {
			return null;
		}

		if (node. tomselect) {
			node.tomselect. destroy();
		}

		var inst = null;

		try{
			inst = initTomDropdown && initTomDropdown({
				selector: selector,
				url:  url,
				extraParams: extraParams || {},
				minChars: 0
			});
		}catch(e){
			console.error('❌ initTomDropdown FAILED:', e);
		}

		// ═════════════════════════════════════════════════════════════
		// ⏰ ΚΑΘΥΣΤΕΡΗΜΕΝΟ BINDING ΓΙΑ AUTO-FOCUS
		// ═════════════════════════════════════════════════════════════
		setTimeout(function() {
			// ===== debug + auto-focus handlers for #symbash =====
			if (selector === '#symbash') {
			    var S = inst || ts('symbash');

			    // helper που κάνει το auto-focus στις Κατηγορίες
			    function autoFocusKat(){
					try {
						const katEl = document.getElementById('kathgoria_symbashs');
						const katTS = katEl && katEl.tomselect;
						if (!katTS) return;
						try { katTS.enable(); } catch(_) {}
						try { katTS.unlock && katTS.unlock(); } catch(_) {}
						const controlInput = katTS.control_input || (katTS.wrapper && katTS.wrapper.querySelector('input'));
						if (controlInput && typeof controlInput.focus === 'function') {
							controlInput.focus();
							setTimeout(()=>{ try { katTS.open(); } catch(_){}; }, 120);
						}
					}catch(_){}
			    }

			    if (S && typeof S.on === 'function') {
			        // existing bindings
			        S.on('change', function(value) {
			            try { onSymChange(); } catch(e) { console.error(e); }
			            if (value) autoFocusKat();
			        });

			        S.on('item_add', function(value) {
			            try { onSymChange(); } catch(e) { console.error(e); }
			            if (value) autoFocusKat();
			            if (value) autoFocusKat();
			        });

			        // fallback handlers
			        try {
			            // 1) raw <select> change (native element)
			            var rawSelect = document.querySelector('#symbash');
			            if (rawSelect && !rawSelect.__fallbackBound) {
			                rawSelect.__fallbackBound = true;
			                rawSelect.addEventListener('change', function(ev){
			                    try { onSymChange(); } catch(e){ console.error(e); }
			                    setTimeout(autoFocusKat, 250);
			                }, true);
			            }

			            // 2) hidden "stathera" input change (if used)
			            var hid = document.getElementById('symbash_stathera');
			            if (hid && !hid.__fallbackBound) {
			                hid.__fallbackBound = true;
			                // robust observer instead of simple attribute loop
			                (function attachRobustObserver(){
			                	try{
			                		if (hid.__robustObserverAttached) return;
			                		hid.__robustObserverAttached = true;
			                		let lastProcessed = String(hid.value || '');
			                		var mo = new MutationObserver(function(mutations){
			                			try{
			                				for (const m of mutations){
			                					if (m.type !== 'attributes' || m.attributeName !== 'value') continue;
			                					if (hid.__suppressObserver) { lastProcessed = String(hid.value||''); continue; }
			                					const newVal = String(hid.value || '');
			                					if (newVal === lastProcessed) continue;
			                					lastProcessed = newVal;
			                					// minimal debug
			                					try { onSymChange(); } catch(e){ console.error(e); }
			                					setTimeout(autoFocusKat, 250);
			                				}
			                			}catch(obsErr){ console.error('MutationObserver callback error', obsErr); }
			                		});
			                		mo.observe(hid, { attributes: true, attributeFilter: ['value'], attributeOldValue: true });
			                		hid.__robustMutationObserver = mo;
			                	}catch(err){ console.error('attachRobustObserver failed', err); }
			                })();
			                // also listen native change for safety
			                hid.addEventListener('change', function(){ 
			                	try { onSymChange(); } catch(e){ console.error(e); }
			                	setTimeout(autoFocusKat, 250);
			                }, true);
			            }

			            // 3) Listen on control_input (TomSelect visible input) for "input" events
			            var ctrlInput = S && S.control_input;
			            if (ctrlInput && !ctrlInput.__fallbackBound) {
			                ctrlInput.__fallbackBound = true;
			                ctrlInput.addEventListener('input', function(){
			                }, { passive:true });
			            }
			        } catch (err) {
			            console.error('fallback listeners attach failed', err);
			        }

			        S.on('clear', handleSymbashClear);
			    } else {
			        console.warn('⚠️ Cannot bind debug handlers for #symbash, S.on is not function', S);
			    }
			}

			// 🟢 ΚΑΤΗΓΟΡΙΕΣ - debug + Auto-focus → Ειδικότητες
			if (selector === '#kathgoria_symbashs') {
				var K = inst || ts('kathgoria_symbashs');

				// helper που κάνει το auto-focus στις Ειδικότητες
				function autoFocusEid(){
					try {
						const eidEl = document.getElementById('eidikothta_symbashs');
						const eidTS = eidEl && eidEl.tomselect;
						if (!eidTS) return;
						try { eidTS.enable(); } catch(_) {}
						try { eidTS.unlock && eidTS.unlock(); } catch(_) {}
						const controlInput = eidTS.control_input || (eidTS.wrapper && eidTS.wrapper.querySelector('input'));
						if (controlInput && typeof controlInput.focus === 'function') {
							controlInput.focus();
							setTimeout(()=>{ try { eidTS.open(); } catch(_){}; }, 120);
						}
					}catch(_){}
				}

				if (K && typeof K.on === 'function') {
					// bindings
					K.on('change', function(value) {
						try { onKatChange(); } catch(e) { console.error(e); }
						if (value && (Array.isArray(value) ? value.length>0 : value)) autoFocusEid();
					});

					K.on('item_add', function(value) {
						try { onKatChange(); } catch(e) { console.error(e); }
						if (value) autoFocusEid();
						if (value) autoFocusEid();
					});

					// fallback handlers for categories
					try {
						// raw <select> change
						var rawSelectK = document.querySelector('#kathgoria_symbashs');
						if (rawSelectK && !rawSelectK.__fallbackBound) {
							rawSelectK.__fallbackBound = true;
							rawSelectK.addEventListener('change', function(ev){
								try { onKatChange(); } catch(e){ console.error(e); }
								setTimeout(autoFocusEid, 250);
							}, true);
						}

						// hidden "stathera" input change (kathgoria)
						var hidK = document.getElementById('kathgoria_symbashs_stathera');
						if (hidK && !hidK.__fallbackBound) {
							hidK.__fallbackBound = true;
							(function attachRobustObserverK(){
								try{
									if (hidK.__robustObserverAttached) return;
									hidK.__robustObserverAttached = true;
									let lastProcessedK = String(hidK.value || '');
									var moK = new MutationObserver(function(muts){
										try{
											for (const m of muts){
												if (m.type !== 'attributes' || m.attributeName !== 'value') continue;
												if (hidK.__suppressObserver) { lastProcessedK = String(hidK.value||''); continue; }
												const newValK = String(hidK.value || '');
												if (newValK === lastProcessedK) continue;
												lastProcessedK = newValK;
												try { onKatChange(); } catch(e){ console.error(e); }
												setTimeout(autoFocusEid, 250);
											}
										}catch(obsErr){ console.error('MutationObserver callback error (kathgoria)', obsErr); }
									});
									moK.observe(hidK, { attributes: true, attributeFilter: ['value'], attributeOldValue: true });
									hidK.__robustMutationObserver = moK;
								}catch(err){ console.error('attachRobustObserverK failed', err); }
							})();
							// native change for safety
							hidK.addEventListener('change', function(){
								try { onKatChange(); } catch(e){ console.error(e); }
								setTimeout(autoFocusEid, 250);
							}, true);
						}

						// control_input listener
						var ctrlInputK = K && K.control_input;
						if (ctrlInputK && !ctrlInputK.__fallbackBound) {
							ctrlInputK.__fallbackBound = true;
							ctrlInputK.addEventListener('input', function(){
								// optional debug
							}, { passive:true });
						}
					} catch (err) {
						console.error('fallback listeners attach failed (kathgoria)', err);
					}

					K.on('clear', handleKathgoriaClear);
				} else {
					console.warn('⚠️ Cannot bind debug handlers for #kathgoria_symbashs, K.on is not function', K);
				}
			}

			// 🟣 ΕΙΔΙΚΟΤΗΤΕΣ
			if (selector === '#eidikothta_symbashs'){
				var E = inst || ts('eidikothta_symbashs');
				bindTS(E, function(){ onEidChange(); });
				if (E) {
					E.settings.openOnFocus = false;
					E.settings.openOnClick = true;
				}
				if (E && E.on) E.on('clear', handleEidikothtaClear);
			}

		}, 500);  // ⏰ Περίμενε 500ms για να είναι έτοιμο το TomSelect

		// Wire trash buttons μετά το init
		setTimeout(ensureTrashButtonsVisible, 700);

		return inst || ts(selector. replace('#',''));
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
	* ═════════─────────────────────────────────────────────────────── */

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