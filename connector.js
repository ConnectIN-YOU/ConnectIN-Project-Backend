const mongoURI = "mongodb://localhost:27017" + "/ConnectIN"
//const mongoURI = "mongodb+srv://cris:cris@todo-cluster.baijx.mongodb.net/TodoApp?retryWrites=true&w=majority"
require('dotenv').config()

let mongoose = require('mongoose');
const { postSchema, userSchema, imageSchema } = require('./schema')

mongoose.connect(process.env.MONGO_URL || mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => { console.log("connection established with mongodb server online"); })
    .catch(err => {
        console.log("error while connection", err)
    });
const userDb = mongoose.model('Users', userSchema)
const postDb = mongoose.model('Posts', postSchema)
const imageDb = mongoose.model('Images', imageSchema)

exports.imageDb = imageDb;
exports.postDb = postDb;
exports.userDb = userDb;
