const transporter = require('../../config/emailConfig');
const path = require('path');
const fs = require('fs').promises;
// const { GetObjectCommand } = require('@aws-sdk/client-s3');
// const { s3Client, S3_BUCKET_NAME } = require('../config/aws');
const { downloadFileFromS3 } = require('./s3Helper');  // ✅ Use helper

/**
 * emailService.js
 * Get email content based on language and gender
 */
function getEmailContent({ employeeName, pdfFilename, isGreek, isMale, companyEmail, companyPhone, companyName, companyType }) {
    // ... (κράτα το ίδιο - δεν αλλάζει)
    const currentYear = new Date().getFullYear();
    
    const email = companyEmail || 'support@WebPayrollSolutions.com';
    const phone = companyPhone || 'Δεν υπάρχει διαθέσιμο τηλέφωνο';
    const company = companyName || 'Web Payroll Solutions';
    
    if (isGreek) {
        const salutation = isMale ? 'Κε' : 'Κα';
        
        return {
            subject: `Επικύρωση Σύμβασης Εργασίας - ${company}`,
            text: `
${salutation} ${employeeName},

Σας αποστέλλουμε συνημμένα τη σύμβαση εργασίας σας.

Συνημμένο αρχείο: ${pdfFilename}

Παρακαλούμε:
- Διαβάστε προσεκτικά τη σύμβαση
- Αποθηκεύστε τη σύμβαση για τα αρχεία σας
- Επικυρώστε ΑΜΕΣΑ τη σύμβασή σας μέσω gov.gr (https://www.gov.gr/ipiresies/polites-kai-kathemerinoteta/psephiaka-eggrapha-gov-gr/psephiake-bebaiose-eggraphou)
- Επαναπροωθείστε την επικύρωμένη σύμβαση σας στο email: ${email}
- Επικοινωνήστε μαζί μας για οποιαδήποτε διευκρίνιση

Για περισσότερες πληροφορίες:
📧 Email: ${email}
📞 Τηλέφωνο: ${phone}

Με εκτίμηση,
${company}

© ${currentYear} ${company}. Όλα τα δικαιώματα κατοχυρωμένα.
Αναμένουμε άμεσα την απάντησή σας.
            `,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .email-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(to right, #5a4a2f, #7d6844);
            color: white;
            padding: 25px;
            text-align: center;
        }
        .header h2 {
            margin: 0;
            font-size: 1.5rem;
        }
        .content {
            padding: 30px;
        }
        .salutation {
            font-size: 1.1rem;
            color: #2c3e50;
            margin-bottom: 20px;
        }
        .highlight {
            background: #fff3cd;
            padding: 15px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-list {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-list ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .info-list li {
            margin: 10px 0;
            line-height: 1.6;
        }
        .important {
            color: #d9534f;
            font-weight: 600;
        }
        .contact-info {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .contact-info p {
            margin: 8px 0;
        }
        .footer {
            background: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 0.9rem;
        }
        .footer p {
            margin: 5px 0;
        }
        .small-text {
            font-size: 0.8rem;
            color: #95a5a6;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h2>📄 Υποχρεωτική Επικύρωση Σύμβασης –Απαιτείται Άμεση Ενέργεια</h2>
        </div>
        
        <div class="content">
            <p class="salutation"><strong>${salutation} ${employeeName || 'Εργαζόμενε/η'}</strong>,</p>
            
            <p>Σας αποστέλλουμε συνημμένα τη σύμβαση εργασίας σας και με την παρούσα σας δίδεται επίσημη εντολή να προβείτε άμεσα στην επικύρωση της σύμβασης εργασίας σας.</p>
            
            <div class="highlight">
                <strong>📎 Συνημμένο αρχείο:</strong> ${pdfFilename}
            </div>
            
            <div class="info-list">
                <p><strong>Παρακαλούμε όπως προβείτε άμεσα στις ακόλουθες ενέργειες αναφορικά με τη σύμβασή σας:</strong></p>
                <ul>
                    <li>Διαβάστε προσεκτικά το περιεχόμενο της σύμβασης.</li>
                    <li>Αποθηκεύσετε αντίγραφο της σύμβαση στο αρχείο σας.</li>
                    <li class="important">
                        Ολοκληρώσετε την επίσημη ψηφιακή επικύρωση της σύμβασης μέσω της πλατφόρμας gov.gr<br>
                        <small>
                            <a href="https://www.gov.gr/ipiresies/polites-kai-kathemerinoteta/psephiaka-eggrapha-gov-gr/psephiake-bebaiose-eggraphou" target="_blank">
                                🔗 Ψηφιακή Επικύρωση Εγγράφου (gov.gr)
                            </a>
                        </small><br>
                        <small style="color: #666;">Για την ολοκλήρωση της διαδικασίας απαιτείται σύνδεση με τους προσωπικούς σας κωδικούς TaxisNet.</small>
                    </li>
                    <li>
                        Μετά την ολοκλήρωση της διαδικασίας επικύρωσης, υποχρεούστε <strong>(εντός 2 ημερών)</strong> να αποστείλετε το ψηφιακά επικυρωμένο έγγραφο στην ακόλουθη διεύθυνση ηλεκτρονικού ταχυδρομείου χωρίς καθυστέρηση:<br>
                        <strong><a href="mailto:${email}">${email}</a></strong><br>
                        Τυχόν μη συμμόρφωση εντός της καθορισμένης προθεσμίας ενδέχεται να θεωρηθεί παραβίαση συμβατικών υποχρεώσεων και θα αξιολογηθεί αναλόγως.
                    </li>
                    <li>Για οποιαδήποτε διευκρίνιση, μπορείτε να επικοινωνήσετε με την Εταιρεία.</li>
                </ul>
            </div>

            <div class="contact-info">
                <p><strong>Για περισσότερες πληροφορίες:</strong></p>
                <p>📧 Email: <a href="mailto:${email}">${email}</a></p>
                <p>📞 Τηλέφωνο: <strong>${phone}</strong></p>
            </div>
            
            <p style="margin-top: 30px;">
            ${companyType === 'ΕΤΑΙΡΕΙΑ' 
                ? `Για λογαριασμό της Εταιρείας,<br><strong>Η Διοίκηση</strong><br><strong>${company}</strong>` 
                : `Για λογαριασμό της Εταιρείας,<br><strong>${company}</strong>`
            }</p>
            <p class="small-text">
            Η Εταιρεία επιφυλάσσεται ρητώς παντός νομίμου δικαιώματός της.
            </p>
        </div>
        
        <div class="footer">
            <p>© ${currentYear} <strong>Web</strong> <strong>P</strong>ayroll <strong>S</strong>olutions</p>
            <p>Όλα τα δικαιώματα κατοχυρωμένα.</p>
            <p class="small-text">Αυτό το email δημιουργήθηκε και στάλθηκε αυτόματα.</p>
        </div>
    </div>
</body>
</html>
            `
        };
    }
    
    // English version (same as before)
    else {
        const salutation = isMale ? 'Mr' : 'Mrs';
        
        return {
            subject: `Employment Contract - ${company}`,
            text: `
${salutation} ${employeeName || 'Employee'},

Please find attached your employment contract.

Attached file: ${pdfFilename}

Please:
- Read the contract carefully
- Save the contract for your records
- Authenticate IMMEDIATELY your contract via gov.gr (https://www.gov.gr/ipiresies/polites-kai-kathemerinoteta/psephiaka-eggrapha-gov-gr/psephiake-bebaiose-eggraphou)
- Forward the authenticated contract to: ${email}
- Contact us for any clarification

For more information:
📧 Email: ${email}
📞 Phone: ${phone}

Best regards,
${company}

© ${currentYear} ${company}. All rights reserved.
We await your prompt response.
            `,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .email-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(to right, #5a4a2f, #7d6844);
            color: white;
            padding: 25px;
            text-align: center;
        }
        .header h2 {
            margin: 0;
            font-size: 1.5rem;
        }
        .content {
            padding: 30px;
        }
        .salutation {
            font-size: 1.1rem;
            color: #2c3e50;
            margin-bottom: 20px;
        }
        .highlight {
            background: #fff3cd;
            padding: 15px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-list {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-list ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .info-list li {
            margin: 10px 0;
            line-height: 1.6;
        }
        .important {
            color: #d9534f;
            font-weight: 600;
        }
        .contact-info {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .contact-info p {
            margin: 8px 0;
        }
        .footer {
            background: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 0.9rem;
        }
        .footer p {
            margin: 5px 0;
        }
        .small-text {
            font-size: 0.8rem;
            color: #95a5a6;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h2>📄 Mandatory Contract Validation – Immediate Action Required</h2>
        </div>
        
        <div class="content">
            <p class="salutation"><strong>${salutation} ${employeeName || 'Employee'}</strong>,</p>
            
            <p>Please find attached your employment contract. You are hereby formally instructed to proceed immediately with the validation of your employment contract.</p>
            
            <div class="highlight">
                <strong>📎 Attached file:</strong> ${pdfFilename}
            </div>
            
            <div class="info-list">
                <p><strong>Please proceed immediately with the following actions regarding your contract:</strong></p>
                <ul>
                    <li>Carefully review the contents of the contract.</li>
                    <li>Save a copy of the contract for your records.</li>
                    <li class="important">
                        Complete the official digital validation of the contract through the gov.gr platform<br>
                        <small>
                            <a href="https://www.gov.gr/ipiresies/polites-kai-kathemerinoteta/psephiaka-eggrapha-gov-gr/psephiake-bebaiose-eggraphou" target="_blank">
                                🔗 Digital Document Validation (gov.gr)
                            </a>
                        </small><br>
                        <small style="color: #666;">To complete the process, you are required to log in using your personal TaxisNet credentials.</small>
                    </li>
                    <li>
                        Upon completion of the validation process, you are required <strong>(within 2 days)</strong> to forward the digitally validated document to the following email address without delay:<br>
                        <strong><a href="mailto:${email}">${email}</a></strong><br>
                        Failure to comply within the specified deadline may be considered a breach of contractual obligations and will be assessed accordingly.
                    </li>
                    <li>For any clarification, you may contact the Company.</li>
                </ul>
            </div>

            <div class="contact-info">
                <p><strong>For further information:</strong></p>
                <p>📧 Email: <a href="mailto:${email}">${email}</a></p>
                <p>📞 Phone: <strong>${phone}</strong></p>
            </div>
            
            <p style="margin-top: 30px;">
            ${companyType === 'ΕΤΑΙΡΕΙΑ' 
                ? `For and on behalf of the Company,<br><strong>The Management</strong><br><strong>${company}</strong>` 
                : `For and on behalf of the Company,<br><strong>${company}</strong>`
            }</p>
            <p class="small-text">
            The Company expressly reserves all its legal rights.
            </p>
        </div>
        
        <div class="footer">
            <p>© ${currentYear} <strong>Web</strong> <strong>P</strong>ayroll <strong>S</strong>olutions</p>
            <p>All rights reserved.</p>
            <p class="small-text">This email was generated and sent automatically.</p>
        </div>
    </div>
</body>
</html>
            `
        };
    }
}

/**
 * ✅ FIXED: Download PDF from S3 in production
 * Send contract PDF via email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.employeeName - Employee name
 * @param {string} options.pdfPath - S3 key (production) or local path (dev)
 * @param {string} options.pdfFilename - PDF filename
 * @param {boolean} options.isGreek - Is Greek national (true) or foreign (false)
 * @param {boolean} options.isMale - Is male (true) or female (false)
 * @param {string} options.companyEmail - Company email address
 * @param {string} options.companyPhone - Company phone number
 * @param {string} options.companyName - Company name (eponymia + firstname)
 */
async function sendContractEmail({ 
    to, 
    employeeName, 
    pdfPath, 
    pdfFilename, 
    isGreek = true, 
    isMale = true,
    companyEmail = null,
    companyPhone = null,
    companyName = null,
    companyType = 'ΕΠΙΧΕΙΡΗΣΗ'
}) {
    try {
        let pdfBuffer;
        
        // ============================================================================
        // ✅ SMART DETECTION: S3 key or local path?
        // ============================================================================
        
        const isS3Path = pdfPath.startsWith('contracts/');
        // ✅ DEBUG: Print exact path being used
        console.log('\n🔍 [DEBUG] Email PDF Path:');
        console.log('   pdfPath:', pdfPath);
        console.log('   isS3Path:', isS3Path);
        console.log('   pdfPath length:', pdfPath.length);
        console.log('   Contains URL encoding:', pdfPath.includes('%'));
        console.log();

        if (isS3Path) {
            // ✅ Use helper function (cleaner!)
            console.log(`☁️  [EMAIL] Downloading PDF from S3: ${pdfPath}`);
            
            try {
                pdfBuffer = await downloadFileFromS3(pdfPath);
                console.log(`✅ [EMAIL] Downloaded ${pdfBuffer.length} bytes from S3`);
            } catch (s3Error) {
                console.error('❌ [EMAIL] Failed to download from S3:', s3Error);
                throw new Error(`Αποτυχία λήψης PDF από S3: ${s3Error.message}`);
            }
        } else {
            // ============================================================================
            // ✅ DEV MODE: Read local file
            // ============================================================================
            
            console.log(`📁 [EMAIL] Reading local PDF: ${pdfPath}`);
            
            try {
                pdfBuffer = await fs.readFile(pdfPath);
                console.log(`✅ [EMAIL] Read ${pdfBuffer.length} bytes from local file`);
                
            } catch (fileError) {
                console.error('❌ [EMAIL] Failed to read local file:', fileError);
                throw new Error(`Αποτυχία ανάγνωσης PDF αρχείου: ${fileError.message}`);
            }
        }
        
        // ============================================================================
        // ✅ SEND EMAIL
        // ============================================================================
        
        const emailContent = getEmailContent({
            employeeName,
            pdfFilename,
            isGreek,
            isMale,
            companyEmail,
            companyPhone,
            companyName,
            companyType
        });
        
        const mailOptions = {
            from: {
                name: companyName || 'Web Payroll Solutions',
                address: process.env.EMAIL_FROM
            },
            to: to,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
            attachments: [
                {
                    filename: pdfFilename,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };
        
        console.log(`📧 [EMAIL] Sending to: ${to}`);
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`✅ [EMAIL] Sent successfully! Message ID: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId,
            message: 'Email sent successfully'
        };
        
    } catch (error) {
        console.error('❌ [EMAIL] Error:', error.message);
        console.error('❌ [EMAIL] Stack:', error.stack);
        throw error;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    sendContractEmail
};