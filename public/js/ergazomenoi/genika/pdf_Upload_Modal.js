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
        
        // ✅ INJECT FILE TO PREVIEW MODULE (with documentType)
        if (window.pdfPreviewModule) {
            console.log('💉 Injecting file to preview module:', file.name, 'as', currentDocumentType);
            window.pdfPreviewModule.injectFile(file, currentDocumentType);
        }

        // ��� ALSO inject to pdfUploadModule's selectedFiles (redundant but safe)
        console.log(`✅ selectedFiles[${currentDocumentType}] =`, file.name);        
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
    // ✅ PDF PREVIEW - FULLY WORKING VERSION
    // =========================================================================
    
    if (showPdfPreview) {
        showPdfPreview.addEventListener('click', openPreviewModal);
    }
    
    async function openPreviewModal() {
        const file = selectedFiles[currentDocumentType];
        if (!file) {
            console.warn('⚠️ No file selected for preview');
            return;
        }
        
        try {
            // ✅ Revoke previous blob URL
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }
            
            // ✅ Create new blob URL
            currentBlobUrl = URL.createObjectURL(file);
            
            console.log('📄 Opening PDF in new tab:', file.name);
            
            // ✅ Open in new tab
            const newWindow = window.open(currentBlobUrl, '_blank');
            
            if (!newWindow) {
                // Popup blocked
                await Swal.fire({
                    icon: 'warning',
                    title: 'Popup blocked',
                    html: `Παρακαλώ επιτρέψτε τα popups για να δείτε το PDF.<br>
                        <a href="${currentBlobUrl}" target="_blank" style="color: #3085d6; text-decoration: underline;">
                            Κάντε κλικ εδώ για άνοιγμα
                        </a>`,
                    confirmButtonText: 'Εντάξει'
                });
            } else {
                // Success toast
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: '✅ PDF άνοιξε σε νέο tab',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                });
            }
            
        } catch (error) {
            console.error('❌ Preview error:', error);
            
            await Swal.fire({
                backdrop: false,
                icon: 'error',
                title: 'Σφάλμα προεπισκόπησης',
                text: 'Δεν ήταν δυνατή η φόρτωση του PDF.',
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                }
            });
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
    // CONFIRM BUTTON
    // =========================================================================

    confirmPdfUpload.addEventListener('click', async () => {
        const file = selectedFiles[currentDocumentType];
        if (!file) return;
        
        updateButtonBadge();
        closeModal();
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '✅ PDF επιλέχθηκε',
            html: '<small>Πατήστε <strong>"Αποθήκευση"</strong> στη φόρμα για να ολοκληρωθεί</small>',
            showConfirmButton: false,
            timer: 2500,
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
    // PUBLIC API
    // =========================================================================

    window.pdfUploadModule = {
        hasPendingUpload: function() {
            return Object.keys(selectedFiles).length > 0;
        },
        
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
        
        getAllFiles: function() {
            return Object.keys(selectedFiles).map(docType => ({
                name: selectedFiles[docType].name,
                size: selectedFiles[docType].size,
                type: selectedFiles[docType].type,
                documentType: docType
            }));
        },
        
        getFileAsBase64: async function(documentType) {
            // ✅ DEBUG LOGS
            console.log(`🔍 getFileAsBase64 called for: "${documentType}"`);
            console.log(`📦 selectedFiles keys:`, Object.keys(selectedFiles));
            
            if (selectedFiles[documentType]) {
                console.log(`📄 File found: ${selectedFiles[documentType].name} (${selectedFiles[documentType].size} bytes)`);
            } else {
                console.log(`❌ NO FILE for "${documentType}"!`);
            }
            
            const file = selectedFiles[documentType];
            
            if (!file) {
                console.warn(`⚠️ No file selected for ${documentType}`);
                return null;
            }
            
            console.log(`📄 Converting to base64: ${file.name}`);
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Length = e.target.result.length;
                    console.log(`✅ Converted ${documentType} → ${file.name} (${(base64Length / 1024).toFixed(2)}KB base64)`);
                    resolve(e.target.result);
                };
                reader.onerror = (error) => {
                    console.error(`❌ Failed to read ${documentType}:`, error);
                    reject(error);
                };
                reader.readAsDataURL(file);
            });
        },

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