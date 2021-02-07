const express = require("express");
const app = express();
const port = 9999;
const session = require("express-session");
const cors = require("cors");
app.use(express.json()); // added body key to req
require("dotenv").config();
const InitialPageRoutes = require('./Routes/InitialPageRoutes');
const HomePageRoutes = require("./Routes/HomePageRoutes");
const PostPageRoutes = require("./Routes/PostPageRoutes");

// const session_secret = "newton";
// app.use(
//   cors({
//     credentials: true,
//     //origin: "http://localhost:3000",
//     origin: "https://connectin-you.herokuapp.com",
//   })
// );
// //app.use(cors());
// app.set("trust proxy", 1);
// app.use(
//   session({
//     secret: session_secret,
//     cookie: {
//       maxAge: 1*60*60*1000,
//       sameSite: 'none',
//       secure: true,
//     },
//   })
// ); // adds a property called session to req
const session_secret = "newton";
app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
//app.use(cors());
app.set("trust proxy", 1);
app.use(
  session({
    secret: session_secret,
    resave: true,
    saveUninitialized: true,
    // cookie: {
    //   maxAge: 1 * 60 * 60 * 1000,
    //   sameSite: "none",
    //   secure: true,
    // },
  })
); // adds a property called session to req


app.use("/home", HomePageRoutes);
app.use("/posts", PostPageRoutes);
app.use("/", InitialPageRoutes);

app.listen(process.env.PORT || port, () =>
  console.log(`App listening on port ${port}!`)
);

module.exports = app;
