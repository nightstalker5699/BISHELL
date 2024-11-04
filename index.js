const mongoose = require('mongoose');
const dotenv = require(`dotenv`);
dotenv.config({ path: `${__dirname}/config.env` });

process.on('uncaughtException', err=>{
  console.log('UNCAUGHT EXCEPTION! Shutting down...', err);
  console.log(err.name, err.message);
  server.close(() =>{
    process.exit(1);
  })
})

const app = require(`./app`);

const DB = process.env.DATABASE.replace(`<PASSWORD>`, process.env.DATABASE_PASSWORD);

mongoose.connect(DB).then(() => console.log(`DB connected successfully!`));
const port = process.env.PORT;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on('unhandledRejection', err=> {
  console.log(`UNHANDLED REJECTION! Shutting down...`);
  console.log(err);
  server.close(() =>{
    process.exit(1);
  })
})



