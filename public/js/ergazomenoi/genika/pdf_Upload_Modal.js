document. addEventListener('DOMContentLoaded', function() {
    const customButton = document.getElementById('customButton_oysiodeis_oroi');
    const pdfModal = document.getElementById('pdfUploadModal');
    const closePdfModal = document.getElementById('closePdfModal');
    const cancelPdfUpload = document.getElementById('cancelPdfUpload');
    const pdfDropZone = document.getElementById('pdfDropZone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    const pdfFilePreview = document.getElementById('pdfFilePreview');
    const pdfFileName = document.getElementById('pdfFileName');
    const pdfFileSize = document.getElementById('pdfFileSize');
    const removePdfFile = document.getElementById('removePdfFile');
    const confirmPdfUpload = document.getElementById('confirmPdfUpload');
    const pdfFilePath = document.getElementById('pdfFilePath');
    const pdfProgressBar = document.getElementById('pdfProgressBar');
    const pdfProgressFill = document.getElementById('pdfProgressFill');
    const showPdfPreview = document.getElementById('showPdfPreview');
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    let selectedFile = null;
    let currentBlobUrl = null;
    
    // =========================================================================
    // OPEN/CLOSE MAIN MODAL
    // =========================================================================
    
    if (customButton) {
        customButton.addEventListener('click', function() {
            if (! this.disabled) {
                openModal();
            }
        });
    }
    
    function openModal() {
        pdfModal.classList.remove('hidden');
        pdfModal.classList.add('flex-visible');
        resetModal();
    }
    
    function closeModal() {
        pdfModal.classList.add('hidden');
        pdfModal.classList.remove('flex-visible');
        resetModal();
    }
    
    function resetModal() {
        selectedFile = null;
        pdfFileInput.value = '';
        
        // Cleanup blob URL
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        
        pdfDropZone.classList.remove('hidden');
        pdfFilePreview.classList.add('hidden');
        pdfProgressBar.classList.add('hidden');
        
        pdfProgressFill.removeAttribute('data-progress');
        
        confirmPdfUpload.disabled = true;
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
        if (e.key === 'Escape' && ! pdfModal.classList.contains('hidden')) {
            closeModal();
        }
    });
    
    // =========================================================================
    // DRAG & DROP
    // =========================================================================
    
    pdfDropZone.addEventListener('click', () => pdfFileInput.click());
    pdfFileInput.addEventListener('change', (e) => handleFiles(e. target.files));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        pdfDropZone. addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover']. forEach(eventName => {
        pdfDropZone.addEventListener(eventName, () => {
            pdfDropZone.classList.add('dragover');
        });
    });
    
    ['dragleave', 'drop']. forEach(eventName => {
        pdfDropZone.addEventListener(eventName, () => {
            pdfDropZone.classList. remove('dragover');
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
        
        // Validation:  PDF only
        if (file.type !== 'application/pdf') {
            await Swal.fire({
                backdrop: false,
                icon: 'error',
                title: 'Μη έγκυρο αρχείο! ',
                text: 'Παρακαλώ επιλέξτε μόνο αρχεία PDF.',
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                }
            });
            pdfFileInput.value = '';
            return;
        }
        
        // Validation: File size
        if (file.size > MAX_FILE_SIZE) {
            await Swal.fire({
                backdrop: false,
                icon: 'error',
                title: 'Αρχείο πολύ μεγάλο!',
                html: `Το αρχείο υπερβαίνει το μέγιστο επιτρεπόμενο μέγεθος των <strong>10MB</strong>. <br>Μέγεθος αρχείου: <strong>${formatFileSize(file. size)}</strong>`,
                confirmButtonText: 'Εντάξει',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                }
            });
            pdfFileInput.value = '';
            return;
        }
        
        // All validations passed
        selectedFile = file;
        displayFileInfo(file);
    }
    
    function displayFileInfo(file) {
        pdfFileName.textContent = file. name;
        pdfFileSize.textContent = formatFileSize(file.size);
        
        pdfDropZone.classList.add('hidden');
        pdfFilePreview.classList.remove('hidden');
        confirmPdfUpload.disabled = false;
    }
    
    // =========================================================================
    // PDF PREVIEW (ΑΝΟΙΓΕΙ ΣΕ ΝΕΟ TAB - 100% CSP-COMPLIANT)
    // =========================================================================
    
    if (showPdfPreview) {
        showPdfPreview.addEventListener('click', openPreviewInNewTab);
    }
    
    function openPreviewInNewTab() {
        if (! selectedFile) return;
        
        try {
            // Cleanup previous blob URL if exists
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }
            
            // Create Blob URL
            currentBlobUrl = URL.createObjectURL(selectedFile);
            
            // Show loading modal
            Swal.fire({
                backdrop: 'rgba(0,0,0,0.7)',
                html: `
                    <div style="padding: 30px;">
                        <div class="enhanced-loader"></div>
                        <h3 style="margin-top: 25px; color: #667eea; font-weight: 600;">
                            Άνοιγμα Προεπισκόπησης
                        </h3>
                        <p style="color: #999; margin-top: 10px;">
                            Παρακαλώ περιμένετε... 
                        </p>
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => {
                    const style = document.createElement('style');
                    style.textContent = `
                        .enhanced-loader {
                            width: 60px;
                            height: 60px;
                            margin: 0 auto;
                            border: 4px solid #f3f3f3;
                            border-top: 4px solid #667eea;
                            border-right: 4px solid #764ba2;
                            border-radius: 50%;
                            animation: enhancedSpin 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
                        }
                        @keyframes enhancedSpin {
                            0% { transform:  rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        .swal2-popup {
                            border-radius: 20px ! important;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
                        }
                    `;
                    document.head.appendChild(style);
                },
                timer: 1000
            });
            
            setTimeout(() => {
                const newWindow = window.open(currentBlobUrl, '_blank');
                
                if (! newWindow) {
                    // Enhanced popup blocker warning
                    Swal.fire({
                        backdrop: 'rgba(0,0,0,0.7)',
                        html: `
                            <div style="text-align: center; padding: 20px;">
                                <div style="font-size: 60px; margin-bottom: 20px;">🚫</div>
                                <h2 style="color: #ff6b6b; font-weight: 700; margin-bottom: 15px;">
                                    Popup Blocker Ενεργός
                                </h2>
                                <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #ff6b6b; margin: 20px 0; text-align: left;">
                                    <p style="margin: 0 0 15px 0; color: #666; font-weight: 500;">
                                        <strong>📋 Οδηγίες:</strong>
                                    </p>
                                    <ol style="color: #666; padding-left: 20px; margin: 0; line-height: 1.8;">
                                        <li>Κάντε κλικ στο <strong>🚫</strong> εικονίδιο στη γραμμή διευθύνσεων</li>
                                        <li>Επιλέξτε <strong>"Να επιτρέπονται πάντα τα αναδυόμενα"</strong></li>
                                        <li>Ανανεώστε τη σελίδα και δοκιμάστε ξανά</li>
                                    </ol>
                                </div>
                                <p style="color: #999; font-size: 0.9rem; margin-top: 15px;">
                                    💡 Αυτό είναι απαραίτητο για την προεπισκόπηση του PDF
                                </p>
                            </div>
                        `,
                        confirmButtonText: '👌 Κατάλαβα',
                        confirmButtonColor: '#ff6b6b',
                        customClass: {
                            popup:  'animated-popup',
                            confirmButton: 'animated-button'
                        },
                        didOpen: () => {
                            const style = document.createElement('style');
                            style.textContent = `
                                .animated-popup {
                                    animation: zoomIn 0.3s ease ! important;
                                    border-radius: 20px !important;
                                }
                                @keyframes zoomIn {
                                    from { opacity: 0; transform: scale(0.8); }
                                    to { opacity: 1; transform: scale(1); }
                                }
                                .animated-button {
                                    padding: 12px 30px !important;
                                    font-weight: 600 !important;
                                    border-radius: 10px !important;
                                    transition: all 0.3s ease !important;
                                }
                                .animated-button:hover {
                                    transform:  translateY(-2px) !important;
                                    box-shadow: 0 5px 20px rgba(255, 107, 107, 0.4) !important;
                                }
                            `;
                            document.head.appendChild(style);
                        }
                    });
                } else {
                    // Enhanced success modal
                    Swal.fire({
                        backdrop: 'rgba(0,0,0,0.7)',
                        html: `
                            <div style="padding: 25px;">
                                <div style="margin-bottom: 25px;">
                                    <div class="success-checkmark">
                                        <div class="check-icon">
                                            <span class="icon-line line-tip"></span>
                                            <span class="icon-line line-long"></span>
                                            <div class="icon-circle"></div>
                                            <div class="icon-fix"></div>
                                        </div>
                                    </div>
                                </div>
                                <h2 style="font-size: 1.8rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px;">
                                    Προεπισκόπηση Ανοιχτή! 
                                </h2>
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px; margin: 20px 0; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);">
                                    <div style="display: flex; align-items: center; gap: 15px;">
                                        <div style="font-size: 40px;">📄</div>
                                        <div style="text-align: left; flex: 1;">
                                            <p style="color: white; font-size: 1.05rem; margin: 0; font-weight: 600; word-break: break-all;">
                                                ${selectedFile.name}
                                            </p>
                                            <p style="color: rgba(255,255,255,0.85); font-size: 0.9rem; margin: 5px 0 0 0;">
                                                📦 Μέγεθος: ${formatFileSize(selectedFile.size)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); padding: 20px; border-radius: 12px; border-left: 5px solid #4caf50; margin: 20px 0; text-align: left;">
                                    <p style="margin:  0 0 12px 0; color: #2e7d32; font-weight: 700; font-size: 1.05rem;">
                                        ✅ Επόμενα Βήματα:
                                    </p>
                                    <div style="color: #555; line-height: 1.8;">
                                        <p style="margin: 8px 0;"><strong>1️⃣</strong> Ελέγξτε το PDF στη νέα καρτέλα</p>
                                        <p style="margin: 8px 0;"><strong>2️⃣</strong> Βεβαιωθείτε ότι είναι το σωστό αρχείο</p>
                                        <p style="margin: 8px 0;"><strong>3️⃣</strong> Κλείστε την καρτέλα</p>
                                        <p style="margin: 8px 0;"><strong>4️⃣</strong> Πατήστε <span style="color: #4caf50; font-weight: 700;">"Αποθήκευση"</span> παρακάτω</p>
                                    </div>
                                </div>
                                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border:  2px dashed #dee2e6;">
                                    <p style="color: #6c757d; font-size:  0.9rem; margin: 0;">
                                        💡 <strong>Συμβουλή:</strong> Μπορείτε να κάνετε zoom, print ή download του PDF
                                    </p>
                                </div>
                            </div>
                        `,
                        showConfirmButton: true,
                        confirmButtonText:  '👍 Πολύ Καλά! ',
                        confirmButtonColor:  '#667eea',
                        timer: 10000,
                        timerProgressBar: true,
                        customClass: {
                            popup:  'success-popup-enhanced',
                            confirmButton: 'success-button-enhanced'
                        },
                        didOpen: () => {
                            const style = document.createElement('style');
                            style. textContent = `
                                .success-popup-enhanced {
                                    border-radius: 20px !important;
                                    box-shadow: 0 20px 60px rgba(0,0,0,0.25) !important;
                                    animation: successSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
                                }
                                @keyframes successSlideIn {
                                    from {
                                        opacity: 0;
                                        transform: translateY(-30px) scale(0.9);
                                    }
                                    to {
                                        opacity: 1;
                                        transform: translateY(0) scale(1);
                                    }
                                }
                                .success-button-enhanced {
                                    padding: 14px 40px !important;
                                    font-size: 1.05rem !important;
                                    font-weight: 700 !important;
                                    border-radius: 12px !important;
                                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3) !important;
                                }
                                .success-button-enhanced:hover {
                                    transform: translateY(-3px) scale(1.02) !important;
                                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5) !important;
                                }
                                .success-checkmark {
                                    width: 80px;
                                    height: 80px;
                                    margin: 0 auto;
                                }
                                .check-icon {
                                    width: 80px;
                                    height:  80px;
                                    position: relative;
                                    border-radius: 50%;
                                    box-sizing: content-box;
                                    border: 4px solid #4caf50;
                                }
                                .icon-line {
                                    height: 5px;
                                    background-color: #4caf50;
                                    display: block;
                                    border-radius: 2px;
                                    position: absolute;
                                    z-index: 10;
                                }
                                .icon-line. line-tip {
                                    top: 46px;
                                    left: 14px;
                                    width: 25px;
                                    transform: rotate(45deg);
                                    animation: checkTip 0.75s;
                                }
                                . icon-line.line-long {
                                    top: 38px;
                                    right: 8px;
                                    width:  47px;
                                    transform:  rotate(-45deg);
                                    animation: checkLong 0.75s;
                                }
                                .icon-circle {
                                    top: -4px;
                                    left:  -4px;
                                    z-index: 10;
                                    width: 80px;
                                    height:  80px;
                                    border-radius: 50%;
                                    position: absolute;
                                    box-sizing: content-box;
                                    border: 4px solid rgba(76, 175, 80, 0.5);
                                }
                                .icon-fix {
                                    top: 8px;
                                    width: 5px;
                                    left: 26px;
                                    z-index: 1;
                                    height: 85px;
                                    position: absolute;
                                    transform: rotate(-45deg);
                                    background-color: white;
                                }
                                @keyframes checkTip {
                                    0% { width: 0; left: 1px; top: 19px; }
                                    54% { width: 0; left: 1px; top: 19px; }
                                    70% { width: 50px; left: -8px; top: 37px; }
                                    84% { width: 17px; left: 21px; top: 48px; }
                                    100% { width: 25px; left: 14px; top: 45px; }
                                }
                                @keyframes checkLong {
                                    0% { width: 0; right: 46px; top: 54px; }
                                    65% { width: 0; right: 46px; top: 54px; }
                                    84% { width: 55px; right: 0; top: 35px; }
                                    100% { width: 47px; right: 8px; top:  38px; }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                    });
                    
                    // Enhanced toast when preview closes
                    const checkWindowClosed = setInterval(() => {
                        if (newWindow.closed) {
                            clearInterval(checkWindowClosed);
                            if (currentBlobUrl) {
                                URL.revokeObjectURL(currentBlobUrl);
                                currentBlobUrl = null;
                            }
                            
                            Swal.fire({
                                toast: true,
                                position: 'top-end',
                                icon: 'success',
                                title: '✅ Προεπισκόπηση Ολοκληρώθηκε',
                                html: '<small>Πατήστε "Αποθήκευση" στη φόρμα για να ολοκληρωθεί</small>',
                                showConfirmButton: false,
                                timer: 4000,
                                timerProgressBar: true,
                                didOpen: (toast) => {
                                    toast.style.borderRadius = '12px';
                                    toast. style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
                                }
                            });
                        }
                    }, 1000);
                }
            }, 1000);
            
        } catch (error) {
            console. error('Preview error:', error);
            Swal.fire({
                backdrop: 'rgba(0,0,0,0.7)',
                icon: 'error',
                title: 'Σφάλμα Προεπισκόπησης',
                html: `
                    <div style="padding: 15px;">
                        <p style="color: #666; margin-bottom: 15px;">
                            Δεν ήταν δυνατή η προεπισκόπηση του αρχείου. 
                        </p>
                        <div style="background: #fff3cd; border:  2px solid #ffc107; border-radius: 10px; padding: 15px; margin: 15px 0;">
                            <p style="color: #856404; margin: 0; font-weight: 500;">
                                ⚠️ Μπορείτε να συνεχίσετε με την αποθήκευση χωρίς προεπισκόπηση. 
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Εντάξει',
                confirmButtonColor: '#dc3545'
            });
        }
    }
    
    // =========================================================================
    // REMOVE FILE
    // =========================================================================
    
    removePdfFile. addEventListener('click', () => {
        selectedFile = null;
        pdfFileInput.value = '';
        
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        
        pdfDropZone.classList.remove('hidden');
        pdfFilePreview.classList.add('hidden');
        confirmPdfUpload.disabled = true;
    });
    
    // =========================================================================
    // CONFIRM BUTTON - ΚΛΕΙΝΕΙ ΤΟ MODAL (ΔΕΝ ΚΑΝΕΙ UPLOAD)
    // =========================================================================
    
    confirmPdfUpload.addEventListener('click', () => {
        if (!selectedFile) return;
        
        // Απλά κλείνει το modal - το upload θα γίνει από τη φόρμα
        closeModal();
        
        // Optional: Show confirmation
        Swal.fire({
            backdrop: false,
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: '✅ PDF επιλέχθηκε',
            html: '<small>Πατήστε <strong>"Αποθήκευση"</strong> στη φόρμα για να ολοκληρωθεί το upload</small>',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
            didOpen:  (toast) => {
                toast.style.borderRadius = '12px';
                toast.style. boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
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
    // PUBLIC API - Για χρήση από τη φόρμα
    // =========================================================================
    
    window.pdfUploadModule = {
        // Check αν έχει επιλεγεί PDF
        hasPendingUpload: function() {
            return selectedFile !== null;
        },
        
        // Get το PDF file info
        getFileInfo: function() {
            if (!selectedFile) return null;
            return {
                name: selectedFile. name,
                size: selectedFile.size,
                type: selectedFile.type
            };
        },
        
        // Upload το PDF με το ergazomenosId που μόλις δημιουργήθηκε
        uploadPendingFile: async function(ergazomenosId) {
            return new Promise((resolve, reject) => {
                if (!selectedFile) {
                    resolve({ success: true, message: 'No file to upload' });
                    return;
                }
                
                if (!ergazomenosId) {
                    reject(new Error('ergazomenosId is required'));
                    return;
                }
                
                const formData = new FormData();
                formData. append('pdfFile', selectedFile);
                formData.append('ergazomenosId', ergazomenosId);
                formData.append('documentType', 'oysiodeis_oroi');
                
                const xhr = new XMLHttpRequest();
                
                // Progress tracking
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        console.log(`Upload progress: ${percentComplete}%`);
                    }
                });
                
                // Upload complete
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const result = JSON.parse(xhr.responseText);
                        if (result.success) {
                            resolve({
                                success: true,
                                fileId: result.file.id,
                                message: result.message
                            });
                        } else {
                            reject(new Error(result.error || 'Upload failed'));
                        }
                    } else {
                        try {
                            const error = JSON.parse(xhr.responseText);
                            reject(new Error(error.error || 'Upload failed'));
                        } catch (e) {
                            reject(new Error('Upload failed with status:  ' + xhr.status));
                        }
                    }
                });
                
                // Error handling
                xhr.addEventListener('error', () => {
                    reject(new Error('Σφάλμα δικτύου'));
                });
                
                xhr.addEventListener('abort', () => {
                    reject(new Error('Η μεταφόρτωση ακυρώθηκε'));
                });
                
                xhr.open('POST', '/api/upload-pdf', true);
                
                // CSRF Token
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
                if (csrfToken) {
                    xhr.setRequestHeader('X-CSRF-Token', csrfToken);
                }
                
                xhr.send(formData);
            });
        },
        
        // Clear το selected file
        clearSelectedFile: function() {
            selectedFile = null;
            pdfFileInput. value = '';
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
                currentBlobUrl = null;
            }
            pdfDropZone. classList.remove('hidden');
            pdfFilePreview.classList. add('hidden');
            if (confirmPdfUpload) {
                confirmPdfUpload.disabled = true;
            }
        }
    };
});