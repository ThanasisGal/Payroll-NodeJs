// /common/tooltipsForButtons.js - Premium Tooltip with Smart Positioning
(function () {
	// Απενεργοποίησε τα Bootstrap tooltips
	document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
		el.removeAttribute('data-bs-toggle');
	});

	// Μετατροπή title σε data-bs-title
	document.querySelectorAll('[title]').forEach((el) => {
		const t = el.getAttribute('title');
		if (t && ! el.getAttribute('data-bs-title')) {
			el.setAttribute('data-bs-title', t);
		}
		el.removeAttribute('title');
	});

	// Χρώματα
	const COLORS = {
		bg: '#fffcd1',
		text: '#000',
		border: '#ffc107',
		arrow: '#000000',
		shadow: 'rgba(128, 97, 3, 0.5)'
	};

	// Δημιούργησε tooltip container
	const tip = document.createElement('div');
	tip.className = 'wps-tooltip';
	tip.innerHTML = '<div class="wps-tooltip-arrow"></div><div class="wps-tooltip-inner"></div>';
	tip.style.cssText = `
		position: fixed;
		z-index: 99999;
		pointer-events:  none;
		opacity: 0;
		visibility: hidden;
		top: -9999px;
		left: -9999px;
		transition: opacity 0.2s ease, transform 0.2s ease;
		display: flex;
		align-items: center;
		filter: drop-shadow(0 2px 8px ${COLORS.shadow});
		transform: scale(0.95);
	`;
	document.body.appendChild(tip);

	const tipInner = tip.querySelector('.wps-tooltip-inner');
	const tipArrow = tip.querySelector('.wps-tooltip-arrow');

	tipInner.style.cssText = `
		background: ${COLORS.bg};
		color: ${COLORS.text};
		padding: 10px 14px;
		border-radius:  6px;
		font-size:  0.8rem;
		font-weight: 400;
		line-height: 1.5;
		max-width: 320px;
		border: 2px solid ${COLORS.border};
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		letter-spacing: 0.2px;
	`;

	tipArrow.style.cssText = `
		width: 0;
		height: 0;
		border:  10px solid transparent;
		flex-shrink: 0;
	`;

	let currentEl = null;

	function setArrowStyle(placement) {
		tip.style.flexDirection = 'row';
		tip.style.alignItems = 'center';
		tipArrow.style.borderTopColor = 'transparent';
		tipArrow.style.borderBottomColor = 'transparent';
		tipArrow.style.borderLeftColor = 'transparent';
		tipArrow.style.borderRightColor = 'transparent';

		const arrowColor = COLORS.arrow;

		switch (placement) {
			case 'top':
				tip.style.flexDirection = 'column';
				tip.style.alignItems = 'center';
				tipArrow.style.borderTopColor = arrowColor;
				tipArrow.style.order = '2';
				tipInner.style.order = '1';
				break;
			case 'bottom': 
				tip.style.flexDirection = 'column';
				tip.style.alignItems = 'center';
				tipArrow. style.borderBottomColor = arrowColor;
				tipArrow.style.order = '1';
				tipInner.style. order = '2';
				break;
			case 'left': 
				tip.style.flexDirection = 'row';
				tipArrow.style.borderLeftColor = arrowColor;
				tipArrow.style.order = '2';
				tipInner.style.order = '1';
				break;
			case 'right':
			default:
				tip.style. flexDirection = 'row';
				tipArrow.style.borderRightColor = arrowColor;
				tipArrow.style. order = '1';
				tipInner.style.order = '2';
				break;
		}
	}

	function getTransformOrigin(placement) {
		switch (placement) {
			case 'top':  return 'center bottom';
			case 'bottom':  return 'center top';
			case 'left': return 'right center';
			case 'right': 
			default: return 'left center';
		}
	}

	// Υπολογισμός θέσης για κάθε placement
	function calcPosition(placement, elRect, tipWidth, tipHeight, gap) {
		let top, left;
		
		switch (placement) {
			case 'top':
				top = elRect.top - tipHeight - gap;
				left = elRect.left + (elRect.width - tipWidth) / 2;
				break;
			case 'bottom':
				top = elRect.bottom + gap;
				left = elRect.left + (elRect. width - tipWidth) / 2;
				break;
			case 'left':
				top = elRect.top + (elRect.height - tipHeight) / 2;
				left = elRect.left - tipWidth - gap;
				break;
			case 'right':
			default: 
				top = elRect.top + (elRect.height - tipHeight) / 2;
				left = elRect.right + gap;
				break;
		}
		
		return { top, left };
	}

	// Έλεγχος αν χωράει το tooltip
	function fitsInViewport(placement, elRect, tipWidth, tipHeight, gap, padding) {
		const pos = calcPosition(placement, elRect, tipWidth, tipHeight, gap);
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		switch (placement) {
			case 'top':
				return pos. top >= padding;
			case 'bottom': 
				return (pos.top + tipHeight) <= (vh - padding);
			case 'left':
				return pos. left >= padding;
			case 'right':
				return (pos.left + tipWidth) <= (vw - padding);
			default:
				return true;
		}
	}

	// Smart placement - βρες την καλύτερη θέση
	function getBestPlacement(preferredPlacement, elRect, tipWidth, tipHeight, gap, padding) {
		// Σειρά προτεραιότητας ανάλογα με το preferred
		const fallbackOrder = {
			'top': ['top', 'bottom', 'right', 'left'],
			'bottom': ['bottom', 'top', 'right', 'left'],
			'left': ['left', 'right', 'top', 'bottom'],
			'right': ['right', 'left', 'top', 'bottom']
		};

		const order = fallbackOrder[preferredPlacement] || fallbackOrder['right'];

		for (const placement of order) {
			if (fitsInViewport(placement, elRect, tipWidth, tipHeight, gap, padding)) {
				return placement;
			}
		}

		// Αν δεν χωράει πουθενά, επέστρεψε το preferred
		return preferredPlacement;
	}

	function show(el) {
		const text = el.getAttribute('data-bs-title');
		if (!text) return;

		currentEl = el;
		tipInner.textContent = text;

		const preferredPlacement = el.getAttribute('data-bs-placement') || 'right';
		const gap = 0;
		const padding = 10;

		// Αρχικά βάλε το tooltip εκτός οθόνης για να μετρήσουμε το μέγεθός του
		tip.style.top = '-9999px';
		tip.style.left = '-9999px';
		tip.style.opacity = '0';
		tip. style.visibility = 'hidden';
		tip.style.transform = 'scale(0.95)';
		
		// Temporary: set a placement to measure
		setArrowStyle(preferredPlacement);

		requestAnimationFrame(() => {
			if (currentEl !== el) return;

			const elRect = el.getBoundingClientRect();
			const tipRect = tip.getBoundingClientRect();
			const tipWidth = tipRect. width;
			const tipHeight = tipRect.height;

			// Βρες την καλύτερη θέση
			const bestPlacement = getBestPlacement(
				preferredPlacement, 
				elRect, 
				tipWidth, 
				tipHeight, 
				gap, 
				padding
			);

			// Εφάρμοσε το σωστό style για το arrow
			setArrowStyle(bestPlacement);
			tip.style.transformOrigin = getTransformOrigin(bestPlacement);

			// Υπολόγισε την τελική θέση
			let { top, left } = calcPosition(bestPlacement, elRect, tipWidth, tipHeight, gap);

			// Boundary adjustments (για να μην βγαίνει εκτός οθόνης)
			if (left < padding) left = padding;
			if (top < padding) top = padding;
			if (left + tipWidth > window.innerWidth - padding) {
				left = window.innerWidth - tipWidth - padding;
			}
			if (top + tipHeight > window.innerHeight - padding) {
				top = window. innerHeight - tipHeight - padding;
			}

			tip.style.top = top + 'px';
			tip.style.left = left + 'px';

			requestAnimationFrame(() => {
				if (currentEl !== el) return;
				tip.style.visibility = 'visible';
				tip.style.opacity = '1';
				tip.style.transform = 'scale(1)';
			});
		});
	}

	function hide() {
		currentEl = null;
		tip.style.opacity = '0';
		tip. style.transform = 'scale(0.95)';

		setTimeout(() => {
			if (!currentEl) {
				tip.style.visibility = 'hidden';
				tip. style.top = '-9999px';
				tip.style.left = '-9999px';
			}
		}, 200);
	}

	// Event delegation
	document.addEventListener('mouseenter', (e) => {
		const target = e.target;
		if (! target || typeof target.closest !== 'function') return;
		const el = target.closest('[data-bs-title]');
		if (el) show(el);
	}, true);

	document.addEventListener('mouseleave', (e) => {
		const target = e.target;
		if (!target || typeof target.closest !== 'function') return;
		const el = target.closest('[data-bs-title]');
		if (el) hide();
	}, true);

	document.addEventListener('click', hide, true);
	window.addEventListener('scroll', hide, true);
	window.addEventListener('resize', hide);
})();