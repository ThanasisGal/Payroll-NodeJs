const dotenv = require('dotenv');
dotenv.config();

const nodemailer = require('nodemailer');

const port = Number(process.env.EMAIL_PORT) || 465;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,          // smtppro.zoho.eu
  port,
  secure: port === 465,                  // 465 => true, 587 => false (STARTTLS)
  authMethod: 'LOGIN',
  auth: {
    user: process.env.EMAIL_USER,        // πλήρες email
    pass: process.env.EMAIL_PASS
  }
  // logger: true, debug: true            // προαιρετικά για έλεγχο
});

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,           // smtppro.zoho.eu
//   port: Number(process.env.EMAIL_PORT),   // 587
//   secure: false,                          // για 587
//   requireTLS: true,                       // STARTTLS
//   authMethod: 'LOGIN',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   },
//   tls: { minVersion: 'TLSv1.2' },         // προαιρετικό, καλό είναι
//   // logger: true, debug: true            // αν θέλεις αναλυτικά logs
// });

// προαιρετικά: άμεσος έλεγχος σύνδεσης
transporter.verify()
  .then(()=>console.log('SMTP ready'))
  .catch(e=>console.error('SMTP error:', e.message));

module.exports = transporter;
