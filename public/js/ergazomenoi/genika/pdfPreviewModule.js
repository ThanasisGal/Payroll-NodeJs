// public/js/ergazomenoi/genika/pdfPreviewModule.js

/**
 * PDF Preview Module for Ergazomenoi (CSP-compliant)
 * No inline onclick handlers
 * Uses blob URLs for production compatibility
 */

(function() {
    'use strict';
    
    /**
     * Debounce helper - prevents multiple rapid calls
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Flag για να αποτρέψουμε multiple opens
    let isPreviewOpen = false;
    
    // Store current files for preview
    const fileStore = new Map();
    
    /**
     * Initialize module
     */
    function init() {
        console.log('✅ PDF preview module initializing...');
        
        // ✅ Disable conflicting event handlers FIRST
        disableConflictingHandlers();
        
        attachModalListeners();
        attachPreviewListeners();
        attachTrashListeners();
        
        console.log('✅ PDF preview module ready');
    }

    /**
     * ✅ Disable conflicting preview handlers
     */
    function disableConflictingHandlers() {
        // Find all preview buttons
        const previewButtons = document.querySelectorAll('button');
        
        previewButtons.forEach(button => {
            const buttonText = button.textContent.trim();
            
            if (buttonText.includes('Προεπισκόπηση')) {
                // Remove inline onclick
                if (button.onclick) {
                    button.onclick = null;
                    console.log('🗑️ Removed inline onclick from preview button');
                }
                
                // Remove inline attributes
                button.removeAttribute('onclick');
                
                // Clone and replace to remove ALL event listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                console.log('✅ Cleaned preview button:', buttonText.substring(0, 30));
            }
        });
    }

    /**
     * Attach modal event listeners
     */
    function attachModalListeners() {
        // Listen for modal file inputs
        document.addEventListener('change', function(event) {
            const target = event.target;
            
            if (target.type === 'file' && target.accept && target.accept.includes('pdf')) {
                handleFileSelection(target);
            }
        });
    }
    
    /**
     * Attach preview button listeners (CSP-compliant)
     */
    function attachPreviewListeners() {
        document.addEventListener('click', function(event) {
            const button = event.target.closest('button');
            
            if (!button) return;
            
            const buttonText = button.textContent.trim();
            const hasPreviewClass = button.classList.contains('pdf-preview-btn') || 
                                   button.dataset.action === 'preview-pdf';
            
            if (buttonText.includes('Προεπισκόπηση') || hasPreviewClass) {
                // ✅ CRITICAL: Stop ALL event propagation
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                // ✅ Remove any existing onclick handler
                if (button.onclick) {
                    button.onclick = null;
                    console.log('🗑️ Removed conflicting onclick handler');
                }
                
                handlePreviewClick(button);
                
                return false; // ✅ Extra safety
            }
        }, true); // ✅ Capture phase (runs BEFORE other listeners)
    }

    /**
     * Attach trash button listeners (CSP-compliant)
     */
    function attachTrashListeners() {
        document.addEventListener('click', function(event) {
            const button = event.target.closest('button');
            
            if (!button) return;
            
            // Check if it's a trash/remove button
            const isTrashButton = button.classList.contains('badge-remove-btn') ||
                                 button.dataset.action === 'remove-pdf' ||
                                 button.querySelector('.bi-x-circle-fill') ||
                                 button.querySelector('[data-bs-title*="Αφαίρεση"]');
            
            if (isTrashButton) {
                event.preventDefault();
                event.stopPropagation();
                handleTrashClick(button);
            }
        });
    }
    
    /**
     * Handle file selection (with persistent storage)
     */
    function handleFileSelection(input) {
        const file = input.files[0];
        
        if (!file) return;
        
        // Validate PDF
        if (file.type !== 'application/pdf') {
            alert('❌ Επιλέξτε αρχείο PDF!');
            input.value = '';
            return;
        }
        
        // Check size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert(`❌ Το αρχείο είναι πολύ μεγάλο! (${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB)`);
            input.value = '';
            return;
        }
        
        // ✅ Store με multiple keys
        const documentType = input.dataset.documentType || input.id || input.name;
        fileStore.set(documentType, file);
        fileStore.set('_current_preview', file);
        
        console.log(`✅ PDF stored: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        console.log(`📦 Keys: ${documentType}, _current_preview`);
    }

    /**
     * Handle preview button click
     */
    function handlePreviewClick(button) {
        console.log('👁️ Preview button clicked');
        
        // Find associated file
        const file = findAssociatedFile(button);
        
        if (!file) {
            alert('❌ Δεν βρέθηκε αρχείο για προβολή');
            return;
        }
        
        // ✅ Preview using blob URL
        previewPdfFile(file);
    }
    
    /**
     * Handle trash button click
     */
    function handleTrashClick(button) {
        console.log('🗑️ Trash button clicked');
        
        const documentType = button.dataset.documentType;
        
        if (!documentType) {
            console.warn('⚠️ No documentType found on trash button');
            return;
        }
        
        // Remove from store
        fileStore.delete(documentType);
        fileStore.delete('_current_preview');
        
        // Hide badge, show upload button
        const badge = document.querySelector(`.pdf-badge-replacement[data-document-type="${documentType}"]`);
        const uploadBtn = document.querySelector(`.pdf-upload-btn[data-document-type="${documentType}"]`);
        
        if (badge) {
            badge.classList.add('hidden');
        }
        
        if (uploadBtn) {
            uploadBtn.classList.remove('hidden');
        }
        
        // Clear file input
        const fileInput = document.querySelector(`input[data-document-type="${documentType}"]`);
        if (fileInput) {
            fileInput.value = '';
        }
        
        console.log(`✅ Removed PDF: ${documentType}`);
    }
    
    /**
     * Find file (with multiple fallback strategies)
     */
    function findAssociatedFile(button) {
        console.log('🔍 Finding file...');
        
        // Strategy 1: Current preview
        if (fileStore.has('_current_preview')) {
            const file = fileStore.get('_current_preview');
            console.log('✅ Found: _current_preview →', file.name);
            return file;
        }
        
        // Strategy 2: Modal input
        const modal = button.closest('.modal');
        if (modal) {
            const fileInput = modal.querySelector('input[type="file"][accept*="pdf"]');
            if (fileInput?.files?.[0]) {
                const file = fileInput.files[0];
                console.log('✅ Found: modal input →', file.name);
                return file;
            }
        }
        
        // Strategy 3: Document type
        const documentType = button.dataset.documentType;
        if (documentType && fileStore.has(documentType)) {
            const file = fileStore.get(documentType);
            console.log('✅ Found: documentType →', file.name);
            return file;
        }
        
        // Strategy 4: Any file
        for (const [key, value] of fileStore.entries()) {
            if (!key.startsWith('_') && value instanceof File) {
                console.log('✅ Found: fallback →', value.name);
                return value;
            }
        }
        
        console.error('❌ No file found!');
        return null;
    }

    /**
     * ✅ Preview PDF (no false warnings, duplicate prevention)
     */
    function previewPdfFile(file) {
        if (!file) {
            console.error('❌ No file provided');
            return;
        }
        
        // ✅ Check duplicate
        if (isPreviewOpen) {
            console.warn('⚠️ Ignoring duplicate preview request');
            return;
        }
        
        try {
            isPreviewOpen = true;
            
            const blobUrl = URL.createObjectURL(file);
            console.log('👁️ Opening PDF:', file.name);
            
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
            
            // Reset flag after 1 second
            setTimeout(() => {
                isPreviewOpen = false;
            }, 1000);
            
            // Cleanup blob after 2 minutes
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
                console.log('🗑️ Cleaned up blob URL');
            }, 120000);
            
        } catch (error) {
            isPreviewOpen = false;
            console.error('❌ Preview error:', error);
            alert('Σφάλμα κατά την προβολή του PDF');
        }
    }
    
    /**
     * Public API
     */
    window.pdfPreviewModule = {
        previewFile: previewPdfFile,
        getStoredFile: (documentType) => fileStore.get(documentType),
        hasFile: (documentType) => fileStore.has(documentType),
        clearAll: () => fileStore.clear()
    };
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    console.log('✅ PDF preview module loaded (CSP-compliant)');
    
})();