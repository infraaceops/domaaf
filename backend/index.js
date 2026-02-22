const express = require('express');
const { Readable } = require('stream');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Google Drive Integration Placeholder
const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth });

// Helper to upload to Google Drive
async function uploadToDrive(base64Data, filename) {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const contentType = base64Data.substring(5, base64Data.indexOf(';'));
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');

        // Create a stream from the buffer
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        const response = await drive.files.create({
            requestBody: {
                name: filename,
                parents: [folderId],
            },
            media: {
                mimeType: contentType,
                body: stream,
            },
        });

        // Make file public (optional, same logic as .gs)
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        const file = await drive.files.get({
            fileId: response.data.id,
            fields: 'webViewLink',
        });

        return file.data.webViewLink;
    } catch (error) {
        console.error('Drive Upload Error:', error);
        return null;
    }
}

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
            data.imageUrl = await uploadToDrive(data.image, `${data.title}_img_${Date.now()}`);
        }
        if (data.video) {
            data.videoUrl = await uploadToDrive(data.video, `${data.title}_vid_${Date.now()}`);
        }

        const property = await Property.create(data);
        res.status(201).json(property);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health Check
app.get('/health', (req, res) => res.send('Worker is healthy!'));

// Initialize Database and Start Server
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to Postgres.');
        await sequelize.sync(); // Create tables if they don't exist
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();
