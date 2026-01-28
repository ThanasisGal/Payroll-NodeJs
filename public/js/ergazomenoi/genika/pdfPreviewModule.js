// public/js/ergazomenoi/genika/pdfPreviewModule.js

/**
 * PDF Preview Module - HOOKS INTO EXISTING MODAL SYSTEM
 * Listens for drag & drop completion events from existing system
 */

(function() {
    'use strict';
    
    let isPreviewOpen = false;
    const fileStore = new Map();
    
    function init() {
        console.log('✅ PDF preview module (HOOK-BASED) initializing...');
        
        disableConflictingHandlers();
        attachPreviewListeners();
        hookIntoExistingSystem();
        
        console.log('✅ PDF preview module ready');
    }

    function disableConflictingHandlers() {
        const previewButtons = document.querySelectorAll('button');
        
        previewButtons.forEach(button => {
            if (button.textContent.includes('Προεπισκόπηση')) {
                if (button.onclick) button.onclick = null;
                button.removeAttribute('onclick');
                
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
            }
        });
    }
    
    function attachPreviewListeners() {
        document.addEventListener('click', function(event) {
            const button = event.target.closest('button');
            
            if (!button) return;
            
            if (button.textContent.includes('Προεπισκόπηση')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                handlePreviewClick();
                return false;
            }
        }, true);
    }
    
    /**
     * ✅ NEW: Hook into existing modal drag & drop system
     */
    function hookIntoExistingSystem() {
        console.log('✅ Hooking into existing modal system...');
        
        // ✅ ADD THIS LINE:
        patchExistingModalSystem();
        
        // Listen for file selection confirmation (when badge appears)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    // Check if PDF badge was added
                    if (node.nodeType === 1 && 
                        (node.classList?.contains('pdf-badge') || 
                         node.classList?.contains('pdf-badge-replacement') ||
                         node.textContent?.includes('.pdf'))) {
                        
                        console.log('📎 PDF badge detected! Extracting file...');
                        extractFileFromBadge(node);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also watch for ANY change event (existing system might trigger it)
        document.addEventListener('change', function(e) {
            if (e.target && e.target.type === 'file') {
                console.log('📎 Change event on file input');
                
                // Try to get file from event details
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    console.log('✅ Got file from change event:', file.name);
                    storeFile(file, e.target);
                }
            }
        }, true);
        
        // Watch for any DOM element with PDF filename
        setInterval(() => {
            const pdfElements = document.querySelectorAll('[class*="pdf"], [id*="pdf"]');
            pdfElements.forEach(el => {
                const text = el.textContent || el.innerText || '';
                if (text.toLowerCase().includes('.pdf') && text.length < 100) {
                    // Found element with PDF filename
                    const match = text.match(/([^\\/]+\.pdf)/i);
                    if (match) {
                        const filename = match[1];
                        if (!fileStore.has('_filename')) {
                            console.log('📎 Found PDF filename in DOM:', filename);
                            fileStore.set('_filename', filename);
                        }
                    }
                }
            });
        }, 1000);
        
        console.log('✅ Hooks active');
    }
    
/**
 * ✅ AUTO-INJECT: Patch existing modal system
 */
function patchExistingModalSystem() {
    console.log('🔧 Patching existing modal drag & drop...');
    
    // Find all drop zones
    const dropZones = document.querySelectorAll('.drop-zone, [data-drop-zone], .modal');
    
    dropZones.forEach(zone => {
        // Override drop event
        zone.addEventListener('drop', function(e) {
            console.log('📎 Drop event intercepted!');
            
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files[0]) {
                const file = dt.files[0];
                
                if (file.name.toLowerCase().endsWith('.pdf')) {
                    console.log('✅ Auto-injecting dropped PDF:', file.name);
                    
                    // Store immediately
                    fileStore.set('_current', file);
                    
                    // Try to find input
                    const modal = zone.closest('.modal') || zone;
                    const input = modal.querySelector('input[type="file"]');
                    
                    if (input) {
                        const key = input.id || input.name || input.dataset.documentType || 'pdf';
                        fileStore.set(key, file);
                        console.log(`✅ Stored as: _current, ${key}`);
                    }
                }
            }
        }, true); // ← Capture phase (runs BEFORE existing handler)
    });
    
    console.log(`🔧 Patched ${dropZones.length} drop zones`);
}



    /**
     * Extract file from badge element
     */
    function extractFileFromBadge(badge) {
        // Try to find filename in badge
        const text = badge.textContent || badge.innerText || '';
        const match = text.match(/([^\\/]+\.pdf)/i);
        
        if (match) {
            const filename = match[1];
            console.log('📝 Extracted filename:', filename);
            fileStore.set('_filename', filename);
        }
        
        // Try to find associated input
        const modal = badge.closest('.modal');
        if (modal) {
            const inputs = modal.querySelectorAll('input[type="file"]');
            inputs.forEach(input => {
                if (input.files && input.files[0]) {
                    console.log('✅ Found file in associated input:', input.files[0].name);
                    storeFile(input.files[0], input);
                }
            });
        }
    }
    
    /**
     * Store file
     */
    function storeFile(file, input) {
        if (!file) return;
        
        const key = input?.id || input?.name || input?.dataset?.documentType || 'pdf';
        
        fileStore.set('_current', file);
        fileStore.set(key, file);
        
        console.log(`✅ Stored: ${file.name} as [_current, ${key}]`);
    }
    
    /**
     * Handle preview click
     */
    function handlePreviewClick() {
        console.log('👁️ Preview clicked');
        
        // Check fileStore first
        let file = fileStore.get('_current');
        
        if (!file) {
            console.warn('⚠️ No file in fileStore, asking user to re-drop...');
            alert('❌ Δεν βρέθηκε αρχείο.\n\nΠαρακαλώ κάντε drag & drop το PDF ξανά και περιμένετε να εμφανιστεί το badge.');
            return;
        }
        
        console.log('✅ Previewing:', file.name);
        previewPdf(file);
    }
    
    /**
     * Preview PDF
     */
    function previewPdf(file) {
        if (!file) return;
        if (isPreviewOpen) return;
        
        try {
            isPreviewOpen = true;
            
            const blobUrl = URL.createObjectURL(file);
            console.log('👁️ Opening:', file.name);
            
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
            
            setTimeout(() => { isPreviewOpen = false; }, 1000);
            setTimeout(() => { URL.revokeObjectURL(blobUrl); }, 120000);
            
        } catch (error) {
            isPreviewOpen = false;
            console.error('❌ Error:', error);
            alert('Σφάλμα κατά την προβολή του PDF');
        }
    }
    
    /**
     * Convert file to base64
     */
    function getFileAsBase64(documentType) {
        return new Promise((resolve, reject) => {
            const file = fileStore.get(documentType) || fileStore.get('_current');
            
            if (!file) {
                resolve(null);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Public API
     */
    window.pdfPreviewModule = {
        previewFile: previewPdf,
        getStoredFile: (type) => {
            if (type === '_current' || type === '_current_preview') {
                return fileStore.get(type);
            }
            return fileStore.get(type); // ONLY exact match!
        },
        hasFile: (type) => {
            if (type === '_current' || type === '_current_preview') {
                return fileStore.has(type);
            }
            return fileStore.has(type); // ONLY exact match!
        },
        getFileAsBase64: getFileAsBase64,
        clearAll: () => fileStore.clear(),
        
        // ✅ FIXED: Accept documentType parameter
        injectFile: (file, documentType) => {
            if (!file) {
                console.warn('⚠️ injectFile called with no file');
                return;
            }
            
            console.log('💉 File injected:', file.name, 'as', documentType);
            
            // ✅ Store with BOTH documentType AND _current
            if (documentType) {
                fileStore.set(documentType, file);
                console.log(`✅ Stored as: ${documentType}`);
            }
            
            // ✅ ALWAYS store as _current (last uploaded fallback)
            fileStore.set('_current', file);
            
            // ✅ DEBUG: Show all stored files
            const allKeys = Array.from(fileStore.keys()).filter(k => k !== '_filename');
            console.log('📊 FileStore now has:', allKeys);
        }
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    console.log('✅ PDF preview module loaded (HOOK-BASED)');
    
})();