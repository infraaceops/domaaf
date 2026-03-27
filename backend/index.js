const express = require('express');
const { Readable } = require('stream');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const { google } = require('googleapis');
const https = require('https');
const http = require('http');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Setup (Postgres)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
});

// Define a simple model (Property Listing as per existing files)
const Property = sequelize.define('Property', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    price: DataTypes.DECIMAL,
    type: DataTypes.STRING,
    plan: DataTypes.STRING,
    imageUrl: DataTypes.STRING,
    videoUrl: DataTypes.STRING,
    userEmail: DataTypes.STRING,
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
    },
});

const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    lastRotationDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

// Google Drive Integration Placeholder
const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// Helper to upload to Google Apps Script (which has storage quota)
async function uploadToDrive(base64Data, filename, type) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // Increased to 45s for reliability

    try {
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        if (!scriptUrl) {
            console.error('[PROXY] GOOGLE_APPS_SCRIPT_URL is not defined in .env');
            return null;
        }

        console.log(`[PROXY] Forwarding ${type} upload to Apps Script: ${filename}`);
        console.log(`[PROXY] Payload size: ${Math.round(base64Data.length / 1024)} KB`);

        // Apps Script doPost expects either 'image' or 'video'
        const payload = {
            title: filename,
            type: type
        };

        if (type === 'img' || type === 'image') {
            payload.image = base64Data;
        } else {
            payload.video = base64Data;
        }

        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);
        console.log(`[PROXY] Apps Script response status: ${response.status}`);

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error(`[PROXY] Apps Script returned non-JSON: ${responseText.substring(0, 500)}`);
            throw new Error(`Invalid response from storage: ${response.status}`);
        }

        if (data.status === 'error' || !response.ok) {
            console.error(`[PROXY] Apps Script error: ${data.message || response.statusText}`);
            throw new Error(data.message || `Upload failed with status ${response.status}`);
        }

        const finalUrl = data.url || data.imageUrl;
        console.log(`[PROXY] Upload success. URL: ${finalUrl}`);
        return finalUrl;
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            console.error('[PROXY] Upload timed out after 45s');
        } else {
            console.error('[PROXY] Proxy Upload Error:', error.message);
        }
        return null;
    }
}

// Admin Security Protocol: Password Rotation
async function rotateAdminPassword() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'info.jazlanahmed@gmail.com';
        const admin = await Admin.findOne({ where: { username: 'root' } });
        
        if (!admin) {
            console.log('[SECURITY] Root admin not found. Initializing...');
            const tempPassword = Math.random().toString(36).slice(-12);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            await Admin.create({
                username: 'root',
                password: hashedPassword,
                email: adminEmail,
                lastRotationDate: new Date()
            });
            await sendRotationEmail(adminEmail, tempPassword);
            return;
        }

        const newPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await admin.update({
            password: hashedPassword,
            lastRotationDate: new Date()
        });

        console.log(`[SECURITY] Password rotated for admin: ${admin.username}`);
        await sendRotationEmail(adminEmail, newPassword);
    } catch (error) {
        console.error('[SECURITY] Rotation failed:', error.message);
    }
}


async function sendRotationEmail(email, password) {
    try {
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!smtpUser || !smtpPass ||
            smtpUser === 'your_gmail_address@gmail.com' ||
            smtpPass === 'your_16_char_app_password_here') {
            console.warn('[SECURITY] ⚠️  SMTP credentials not configured in .env. Email NOT sent.');
            console.warn('[SECURITY] ⚠️  Set SMTP_USER and SMTP_PASS to enable email delivery.');
            console.warn(`[SECURITY] Password for manual use: ${password}`);
            return;
        }

        // Detect provider: use Brevo if SMTP_HOST is set, otherwise Gmail App Password
        let transportConfig;
        if (process.env.SMTP_HOST) {
            // Brevo / any custom SMTP
            transportConfig = {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false,
                auth: { user: smtpUser, pass: smtpPass }
            };
        } else {
            // Gmail App Password fallback
            transportConfig = {
                service: 'gmail',
                auth: { user: smtpUser, pass: smtpPass }
            };
        }

        const transporter = nodemailer.createTransport(transportConfig);
        const fromName = process.env.SMTP_FROM_NAME || 'Domaaf Security';
        const fromAddr = process.env.SMTP_FROM || smtpUser;

        await transporter.sendMail({
            from: `"${fromName}" <${fromAddr}>`,
            to: email,
            subject: '🔐 Domaaf Admin Credentials — Renewed',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px;
                            border: 1px solid #e0e0e0; border-radius: 12px; background: #fafafa;">
                    <h2 style="color: #10b981; margin-bottom: 4px;">🔐 Admin Credentials Renewed</h2>
                    <p style="color: #555;">Hello Administrator,</p>
                    <p style="color: #555;">Your Domaaf admin password has been automatically renewed as part of the 15-day security rotation protocol.</p>
                    <div style="background: #fff; border: 1px solid #d1fae5; padding: 20px; border-radius: 8px; margin: 24px 0;">
                        <table style="width:100%; border-collapse:collapse;">
                            <tr><td style="padding:6px 0; color:#888; width:130px;">Username</td>
                                <td style="font-family:monospace; font-size:15px;">root</td></tr>
                            <tr><td style="padding:6px 0; color:#888;">New Password</td>
                                <td style="font-family:monospace; font-size:15px; background:#f0fdf4;
                                    padding:4px 8px; border-radius:4px; letter-spacing:1px;">${password}</td></tr>
                            <tr><td style="padding:6px 0; color:#888;">Rotated At</td>
                                <td style="font-size:13px; color:#555;">${new Date().toUTCString()}</td></tr>
                        </table>
                    </div>
                    <p style="color:#888; font-size:13px;">Next rotation is scheduled in 15 days.<br>
                    If you did not expect this email, please secure your admin portal immediately.</p>
                    <p style="color:#555;">Regards,<br><strong>Domaaf Security System</strong></p>
                </div>
            `
        });
        console.log(`[SECURITY] ✅ Email sent to ${email}`);
    } catch (error) {
        console.error('[SECURITY] ❌ Email failed:', error.message);
    }
}

// Schedule rotation check every day
cron.schedule('0 0 * * *', async () => {
    console.log('[SECURITY] Checking if password rotation is due...');
    const admin = await Admin.findOne({ where: { username: 'root' } });
    if (admin) {
        const lastRotation = new Date(admin.lastRotationDate);
        const diffDays = Math.ceil((new Date() - lastRotation) / (1000 * 60 * 60 * 24));
        if (diffDays >= 15) {
            await rotateAdminPassword();
        }
    }
});

// Routes
app.get('/api/properties', async (req, res) => {
    try {
        const properties = await Property.findAll({
            order: [['createdAt', 'DESC']],
        });
        res.json(properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/properties', async (req, res) => {
    try {
        const data = req.body;

        // Handle Media Uploads if present
        if (data.image) {
            data.imageUrl = await uploadToDrive(data.image, `${data.title}_img_${Date.now()}`, 'img');
        }
        if (data.video) {
            data.videoUrl = await uploadToDrive(data.video, `${data.title}_vid_${Date.now()}`, 'vid');
        }

        const property = await Property.create(data);
        res.status(201).json(property);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Manually resend credentials email (for testing / on-demand use)
app.post('/api/admin/resend-credentials', async (req, res) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'info.jazlanahmed@gmail.com';
        const admin = await Admin.findOne({ where: { username: 'root' } });

        if (!admin) {
            // No admin yet — create one fresh
            await rotateAdminPassword();
            return res.json({ message: 'Admin initialised and credentials emailed.' });
        }

        // Rotate and resend
        const newPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await admin.update({ password: hashedPassword, lastRotationDate: new Date() });
        await sendRotationEmail(adminEmail, newPassword);
        console.log('[SECURITY] Manual credential resend triggered.');
        res.json({ message: 'Credentials rotated and email sent to ' + adminEmail });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Authentication
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ where: { username } });

        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({ message: 'Login successful', status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health Check
app.get('/health', (req, res) => res.send('Worker is healthy!'));

// Image Proxy - fetches images server-side to bypass browser ORB/CORS restrictions
app.get('/api/image-proxy', async (req, res) => {
    const { fileId, url } = req.query;

    let targetUrl = url;

    if (fileId) {
        targetUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }

    if (!targetUrl) {
        return res.status(400).send('Missing fileId or url parameter');
    }

    try {
        // Follow redirects manually
        const fetchWithRedirect = (reqUrl, redirectCount = 0) => {
            return new Promise((resolve, reject) => {
                if (redirectCount > 10) return reject(new Error('Too many redirects'));
                const lib = reqUrl.startsWith('https') ? https : http;
                lib.get(reqUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; DomaafProxy/1.0)',
                        'Accept': 'image/*,*/*',
                    }
                }, (response) => {
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        return resolve(fetchWithRedirect(response.headers.location, redirectCount + 1));
                    }
                    resolve(response);
                }).on('error', reject);
            });
        };

        const imageResponse = await fetchWithRedirect(targetUrl);

        if (imageResponse.statusCode !== 200) {
            console.error(`[PROXY] Image fetch failed: ${imageResponse.statusCode} for ${targetUrl}`);
            return res.status(imageResponse.statusCode).send('Image fetch failed');
        }

        const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 1 day
        res.setHeader('Access-Control-Allow-Origin', '*');
        imageResponse.pipe(res);
    } catch (err) {
        console.error('[PROXY] Image proxy error:', err.message);
        res.status(500).send('Proxy error');
    }
});

// Initialize Database and Start Server
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to Postgres.');
        await sequelize.sync(); // Create tables if they don't exist
        
        // Initial Admin Check
        const rootAdmin = await Admin.findOne({ where: { username: 'root' } });
        if (!rootAdmin) {
            await rotateAdminPassword();
        }

        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1); // Exit so Docker can restart the container
    }
};

startServer();
