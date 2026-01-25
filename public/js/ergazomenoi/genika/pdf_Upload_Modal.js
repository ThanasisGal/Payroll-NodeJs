// public/js/ergazomenoi/genika/pdf_Upload_Modal.js

document.addEventListener('DOMContentLoaded', function() {
    // =========================================================================
    // DOM ELEMENTS
    // =========================================================================
    
    const uploadButtons = document.querySelectorAll('.pdf-upload-btn');
    const pdfModal = document.getElementById('pdfUploadModal');
    const pdfModalTitle = document.getElementById('pdfModalTitle');
    const closePdfModal = document.getElementById('closePdfModal');
    const cancelPdfUpload = document.getElementById('cancelPdfUpload');
    const pdfDropZone = document.getElementById('pdfDropZone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    const pdfFilePreview = document.getElementById('pdfFilePreview');
    const pdfFileName = document.getElementById('pdfFileName');
    const pdfFileSize = document.getElementById('pdfFileSize');
    const removePdfFile = document.getElementById('removePdfFile');
    const confirmPdfUpload = document.getElementById('confirmPdfUpload');
    const pdfProgressBar = document.getElementById('pdfProgressBar');
    const pdfProgressFill = document.getElementById('pdfProgressFill');
    const showPdfPreview = document.getElementById('showPdfPreview');
    
    // =========================================================================
    // CONSTANTS & STATE
    // =========================================================================
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const selectedFiles = {}; // { 'anhlikoi': File, 'allodapoi': File, 'oysiodeis_oroi': File, 'arxeio_symbashs': File }
    let currentBlobUrl = null;
    let currentDocumentType = 'oysiodeis_oroi';

    // =========================================================================
    // UPDATE BUTTON/BADGE DISPLAY
    // =========================================================================

    function updateButtonBadge() {
        uploadButtons.forEach(button => {
            const docType = button.dataset.documentType;
            const file = selectedFiles[docType];
            
            const wrapper = button.closest('.pdf-button-wrapper');
            if (!wrapper) {
                console.warn('⚠️ No wrapper found for button:', button.id);
                return;
            }
            
            const badge = wrapper.querySelector('.pdf-badge-replacement');
            if (!badge) {
                console.warn('⚠️ No badge replacement found for button:', button.id);
                return;
            }
            
            if (file) {
                button.classList.add('hidden');
                badge.classList.remove('hidden');
                
                const filenameSpan = badge.querySelector('.badge-filename');
                if (filenameSpan) {
                    const shortName = file.name.length > 20 
                        ? file.name.substring(0, 17) + '...' 
                        : file.name;
                    filenameSpan.textContent = shortName;
                }
            } else {
                button.classList.remove('hidden');
                badge.classList.add('hidden');
            }
        });
    }

    // =========================================================================
    // BADGE CLICK HANDLERS
    // =========================================================================

    document.addEventListener('click', function(e) {
        const badge = e.target.closest('.pdf-badge-replacement');
        
        if (badge && !e.target.closest('.badge-remove-btn')) {
            const docType = badge.dataset.documentType;
            const wrapper = badge.closest('.pdf-button-wrapper');
            const button = wrapper?.querySelector('.pdf-upload-btn');
            
            if (button && !button.disabled) {
                button.click();
            }
        }
    });

    document.addEventListener('click', function(e) {
        const removeBtn = e.target.closest('.badge-remove-btn');
        
        if (removeBtn) {
            e.stopPropagation();
            const docType = removeBtn.dataset.documentType;
            delete selectedFiles[docType];
            updateButtonBadge();
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'Αρχείο αφαιρέθηκε',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.style.borderRadius = '12px';
                    toast.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
                }
            });
        }
    });

    // =========================================================================
    // OPEN/CLOSE MODAL
    // =========================================================================

    uploadButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                currentDocumentType = this.dataset.documentType;
                if (!currentDocumentType) {
                    console.error('❌ Button missing data-document-type attribute!');
                    return;
                }
                
                const title = this.dataset.title || 'Μεταφόρτωση PDF';
                
                if (pdfModalTitle) {
                    pdfModalTitle.textContent = title;
                }
                
                if (pdfModal) {
                    pdfModal.dataset.documentType = currentDocumentType;
                }
                
                const existingFile = selectedFiles[currentDocumentType];
                if (existingFile) {
                    displayFileInfo(existingFile);
                }
                
                openModal();
            }
        });
    });
    
    function openModal() {
        pdfModal.classList.remove('hidden');
        pdfModal.classList.add('flex-visible');
        resetModalUI();
    }
    
    function closeModal() {
        pdfModal.classList.add('hidden');
        pdfModal.classList.remove('flex-visible');
        resetModalUI();
    }
    
    function resetModalUI() {
        pdfFileInput.value = '';
        
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        
        const currentFile = selectedFiles[currentDocumentType];
        
        if (currentFile) {
            pdfDropZone.classList.add('hidden');
            pdfFilePreview.classList.remove('hidden');
            displayFileInfo(currentFile);
        } else {
            pdfDropZone.classList.remove('hidden');
            pdfFilePreview.classList.add('hidden');
        }
        
        pdfProgressBar.classList.add('hidden');
        pdfProgressFill.removeAttribute('data-progress');
        
        confirmPdfUpload.disabled = !currentFile;
        cancelPdfUpload.disabled = false;
    }
    
    closePdfModal.addEventListener('click', closeModal);
    cancelPdfUpload.addEventListener('click', closeModal);
    
    pdfModal.addEventListener('click', function(e) {
        if (e.target === pdfModal) {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !pdfModal.classList.contains('hidden')) {
            closeModal();
        }
    });
    
    // =========================================================================
    // DRAG & DROP
    // =========================================================================
    
    pdfDropZone.addEventListener('click', () => pdfFileInput.click());
    pdfFileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        pdfDropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        pdfDropZone.addEventListener(eventName, () => {
            pdfDropZone.classList.add('dragover');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        pdfDropZone.addEventListener(eventName, () => {
            pdfDropZone.classList.remove('dragover');
        });
    });
    
    pdfDropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
    
    // =========================================================================
    // FILE HANDLING
    // =========================================================================
    
    async function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        
        if (file.type !== 'application/pdf') {
            await Swal.fire({
                backdrop: false,
                icon: 'error',
                title: 'Μη έγκυρο αρχείο!',
                text: 'Παρακαλώ επιλέξτε μόνο αρχεία PDF.',
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                }
            });
            pdfFileInput.value = '';
            return;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            await Swal.fire({
                backdrop: false,
                icon: 'error',
                title: 'Αρχείο πολύ μεγάλο!',
                html: `Το αρχείο υπερβαίνει το μέγιστο επιτρεπόμενο μέγεθος των <strong>10MB</strong>.<br>Μέγεθος αρχείου: <strong>${formatFileSize(file.size)}</strong>`,
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                }
            });
            pdfFileInput.value = '';
            return;
        }
        
        selectedFiles[currentDocumentType] = file;
        displayFileInfo(file);
    }
    
    function displayFileInfo(file) {
        pdfFileName.textContent = file.name;
        pdfFileSize.textContent = formatFileSize(file.size);
        
        pdfDropZone.classList.add('hidden');
        pdfFilePreview.classList.remove('hidden');
        confirmPdfUpload.disabled = false;
    }
    
    // =========================================================================
    // PDF PREVIEW (keeping your existing preview code)
    // =========================================================================
    
    if (showPdfPreview) {
        showPdfPreview.addEventListener('click', openPreviewInNewTab);
    }
    
    function openPreviewInNewTab() {
        const file = selectedFiles[currentDocumentType];
        if (!file) return;
        
        try {
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }
            
            currentBlobUrl = URL.createObjectURL(file);
            
            // ... (keep all your existing preview SweetAlert code) ...
            
        } catch (error) {
            console.error('Preview error:', error);
            // ... (keep your existing error handling) ...
        }
    }
    
    // =========================================================================
    // REMOVE FILE
    // =========================================================================

    removePdfFile.addEventListener('click', () => {
        delete selectedFiles[currentDocumentType];
        
        pdfFileInput.value = '';
        
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        
        pdfDropZone.classList.remove('hidden');
        pdfFilePreview.classList.add('hidden');
        confirmPdfUpload.disabled = true;
        
        updateButtonBadge();
    });
    
    // =========================================================================
    // CONFIRM BUTTON - ✅ SIMPLIFIED (no hidden input saving)
    // =========================================================================

    confirmPdfUpload.addEventListener('click', async () => {
        const file = selectedFiles[currentDocumentType];
        if (!file) return;
        
        // ✅ Just update UI - no base64 conversion here
        updateButtonBadge();
        closeModal();
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: '✅ PDF επιλέχθηκε',
            html: '<small>Πατήστε <strong>"Αποθήκευση"</strong> στη φόρμα για να ολοκληρωθεί</small>',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.style.borderRadius = '12px';
                toast.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
            }
        });
    });

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
    
    // =========================================================================
    // PUBLIC API - ✅ MINIMAL & CLEAN
    // =========================================================================

    window.pdfUploadModule = {
        /**
         * Check if there are any pending PDFs
         */
        hasPendingUpload: function() {
            return Object.keys(selectedFiles).length > 0;
        },
        
        /**
         * Get info about a specific PDF
         */
        getFileInfo: function(documentType) {
            const file = selectedFiles[documentType];
            if (!file) return null;
            return {
                name: file.name,
                size: file.size,
                type: file.type,
                documentType: documentType
            };
        },
        
        /**
         * Get info about all selected PDFs
         */
        getAllFiles: function() {
            return Object.keys(selectedFiles).map(docType => ({
                name: selectedFiles[docType].name,
                size: selectedFiles[docType].size,
                type: selectedFiles[docType].type,
                documentType: docType
            }));
        },
        
        /**
         * ✅ NEW: Convert a specific PDF to base64 (on-demand)
         */
        getFileAsBase64: async function(documentType) {
            const file = selectedFiles[documentType];
            if (!file) {
                console.warn(`⚠️ No file selected for ${documentType}`);
                return null;
            }
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log(`✅ Converted ${documentType} to base64 (${(e.target.result.length / 1024).toFixed(2)}KB)`);
                    resolve(e.target.result);
                };
                reader.onerror = (error) => {
                    console.error(`❌ Failed to convert ${documentType}:`, error);
                    reject(error);
                };
                reader.readAsDataURL(file);
            });
        },
        
        /**
         * Clear all selected PDFs
         */
        clearAllFiles: function() {
            Object.keys(selectedFiles).forEach(key => delete selectedFiles[key]);
            
            pdfFileInput.value = '';
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
                currentBlobUrl = null;
            }
            pdfDropZone.classList.remove('hidden');
            pdfFilePreview.classList.add('hidden');
            if (confirmPdfUpload) {
                confirmPdfUpload.disabled = true;
            }
            
            updateButtonBadge();
            
            console.log('🗑️ All PDF files cleared');
        }
    };
    
    console.log('✅ PDF Upload Module initialized');
});
