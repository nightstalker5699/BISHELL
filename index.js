const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const fs = require('fs');
const app = require('./app');

dotenv.config({ path: `${__dirname}/config.env` });

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...', err);
  console.log(err.name, err.message);
  process.exit(1);
});

// Database connection
const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);
mongoose.connect(DB).then(() => console.log('DB connected successfully!'));

// Server configuration
const httpPort = process.env.HTTP_PORT || 8000;
const httpsPort = process.env.HTTPS_PORT || 443;

// SSL options
const httpsOptions = {
  key: fs.readFileSync('./ssl/private.key'),
  cert: fs.readFileSync('./ssl/certificate.crt')
};

// Create both HTTP and HTTPS servers
const httpServer = http.createServer((req, res) => {
  // Redirect HTTP to HTTPS
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
});

const httpsServer = https.createServer(httpsOptions, app);

// Start servers
httpServer.listen(httpPort, () => {
  console.log(`HTTP Server running on port ${httpPort}`);
});

httpsServer.listen(httpsPort, () => {
  console.log(`HTTPS Server running on port ${httpsPort}`);
});

// Handle unhandled rejections
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err);
  httpServer.close(() => {
    httpsServer.close(() => {
      process.exit(1);
    });
  });
});