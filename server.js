const express = require("express");
const app = express();
const port = 9999;
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const fs = require("fs");
const { postDb, userDb, imageDb } = require("./connector");
app.use(express.json()); // added body key to req
const jwt = require("jsonwebtoken");
require("dotenv").config();

const multer = require("multer");
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage }).single("file");

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

const isNullOrUndefined = (val) => {
  return val === null || val === undefined || val === "";
};
app.post("/login", async (req, res) => {
  const { userName, password } = req.body;
  const existingUser = await userDb.findOne({ userName });
  //testDataPostDB();
  if (isNullOrUndefined(userName) || isNullOrUndefined(password)) {
    res
      .status(400)
      .send({ loginSuccess: false, errorMsg: "Required Fields missing." });
  } else if (isNullOrUndefined(existingUser)) {
    res.status(400).send({
      loginSuccess: false,
      errorMsg: "User not registered with us. Please click on Sign Up.",
    });
  } else {
    if (existingUser.password === password) {
      req.session.userId = existingUser._id;
      const authToken = jwt.sign(
        { id: existingUser._id },
        process.env.TOKEN_SECRET,
        { expiresIn: "24h" }
      );
      console.log("Session saved with ", req.session.userId);
      res.send({
        loginSuccess: true,
        newUser: existingUser,
        authToken: authToken,
      });
    } else {
      res
        .status(400)
        .send({ loginSuccess: false, errorMsg: "Password Incorrect." });
    }
  }
});

app.post("/signUp", async (req, res) => {
  const {
    userName,
    password,
    userEmail,
    gitHubLink,
    linkedInLink,
    company,
    designation,
    skills,
  } = req.body;
  const existingUserList = await userDb.find({
    $or: [{ userName: userName }, { userEmail: userEmail }],
  });
  //testDataPostDB();
  if (existingUserList.length > 0) {
    let errMsg = "";
    if (userName === existingUserList[0].userName) {
      errMsg =
        "You have a doppelgänger in terms of Username, Please think of some different Username";
    } else {
      errMsg = "User already registered with us. Please click on Login button.";
    }
    res.status(400).send({
      alreadyRegistered: true,
      errorMsg: errMsg,
    });
  } else {
    const newUser = new userDb({
      userName,
      password,
      userEmail,
      gitHubLink,
      linkedInLink,
      company,
      designation,
      skills,
      followers: [],
      following: [],
      posts: [],
      postsLiked: [],
    });
    await newUser.save();
    res.send({
      alreadyRegistered: false,
      newUser,
    });
  }
});

app.post("/forgotPassword", async (req, res) => {
  try {
    const { userEmail } = req.body;
    const existingUserList = await userDb.find({ userEmail: userEmail });
    if (existingUserList.length > 0) {
      const token = crypto.randomBytes(20).toString("hex");
      existingUserList[0].resetPasswordToken = token;
      await existingUserList[0].save();

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        auth: {
          user: process.env.EMAIL, // generated ethereal user
          pass: process.env.PASSWD, // generated ethereal password
        },
      });
      console.log("transporter ", transporter);
      const localhost = "http://localhost:3000/";
      let info = await transporter.sendMail({
        from: `${process.env.EMAIL}`, // sender address
        to: `${userEmail}`, // list of receivers
        subject: "Link to reset the Password", // Subject line
        text: `Hello ${
          existingUserList[0].userName
        }, You are recieving this email in order to change your password. Use the link below and reset the password! \n
        ${localhost || process.env.FRONTENDURL}reset/${token} `, // plain text body
        //html: "<b>Hello world?</b>", // html body
      });
      console.log("sendMail ", info);
      res.send({
        success: true,
        userPresent: true,
      });
      return;
    } else {
      res.send({
        success: true,
        userPresent: false,
      });
      return;
    }
  } catch (err) {
    console.log("198 "+err);
    res.send({
      success: false,
      userPresent: false,
    });
  }
});

const testDataPostDB = async () => {
  await postDb.deleteMany();
  await userDb.deleteMany();
};
//testDataPostDB();

app.post("/checkUserName", async (req, res) => {
  const { userName } = req.body;
  const existingUser = await userDb.findOne({ userName });
  if (isNullOrUndefined(existingUser)) {
    res.send({
      isAvailable: true,
    });
  } else {
    res.send({
      isAvailable: false,
    });
  }
});

const AuthMiddleware = async (req, res, next) => {
  try {
    if (
      isNullOrUndefined(req.session) ||
      isNullOrUndefined(req.session.userId)
    ) {
      console.log("Outside session..");
      res.status(401).send({
        authorizationSuccess: false,
        errMsg: "Session Expired, Please Login",
      });
    } else {
      console.log("Inside session..");
      next();
    }
  } catch (err) {
    res.status(500).send({
      authorizationSuccess: false,
      errMsg: "Server Error",
    });
  }
};

const JWTAuthMiddleware = (req, res, next) => {
  const token = req.headers.authtoken;
  if (token == null)
    return res.status(401).send({
      authorizationSuccess: false,
      errMsg: "No/Missing Auth Token.",
    }); // if there isn't any token
  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err)
      return res.status(403).send({
        authorizationSuccess: false,
        errMsg: err,
      });
    if (req.session.userId === user.id) {
      console.log("JWT token authenticated!");
      next();
    } else {
      return res.status(403).send({
        authorizationSuccess: false,
        errMsg: "Unauthorized Access Detected, Login again!",
      });
    }
  });
};

app.post(
  "/markLikedOrUnliked",
  AuthMiddleware,
  JWTAuthMiddleware,
  async (req, res) => {
    try {
      const { userId, postId } = req.body;

      let existingUser = await userDb.findOne({ _id: userId });
      const likedPosts = [...existingUser.postsLiked];

      //console.log(postSet + " " + postSet.has(postId));
      let isPresent = false;
      likedPosts.forEach(async (curPostId, index) => {
        if (curPostId.toString() === postId.toString()) {
          isPresent = true;
          await userDb.updateOne(
            { _id: userId },
            { $pull: { postsLiked: postId } }
          );
          await postDb.updateOne({ _id: postId }, { $inc: { likeCount: -1 } });
        }
      });

      if (!isPresent) {
        await userDb.updateOne(
          { _id: userId },
          { $push: { postsLiked: postId } }
        );
        await postDb.updateOne({ _id: postId }, { $inc: { likeCount: 1 } });
      }
      res.send({
        deleted: isPresent,
        success: true,
        authorizationSuccess: true,
      });
    } catch (err) {
      res.status(500).send({
        success: false,
        authorizationSuccess: true,
        errMsg: "Server Error!",
      });
    }
  }
);

const getPostLiked = (postId, userData) => {
  if (isNullOrUndefined(userData)) {
    return {
      successful: false,
      liked: false,
    };
  } else {
    let isPresent = false;
    const postsLiked = userData.postsLiked;
    postsLiked.forEach((curPostId, index) => {
      if (curPostId.toString() === postId.toString()) {
        isPresent = true;
      }
    });
    return {
      liked: isPresent,
      successful: true,
    };
  }
};

app.get("/getPosts", AuthMiddleware, JWTAuthMiddleware, async (req, res) => {
  try {
    const offset = !isNaN(Number(req.query.offset))
      ? Number(req.query.offset)
      : 0;
    const limit = !isNaN(Number(req.query.limit))
      ? Number(req.query.limit)
      : 10;
    const posts = await postDb
      .find()
      .skip(offset)
      .limit(limit)
      .sort({ postTimeStamp: -1 });
    const userId = req.query.userId;
    const existingUser = await userDb.findOne({ _id: userId });
    let responsePosts = [];
    let promises = [];
    let postIdImageListMap = new Map();
    posts.forEach((post) => {
      promises.push(
        imageDb
          .find({
            _id: { $in: post.imageRelatedToPosts },
          })
          .then((res) => {
            postIdImageListMap.set(post._id, res);
          })
          .then(() => {
            const response = getPostLiked(post._id, existingUser);
            if (response.successful) {
              responsePosts.push({
                liked: response.liked,
                post: post,
                imagesRelatedToPosts: postIdImageListMap.get(post._id),
              });
              //console.log(post);
            }
          })
      );
    });
    Promise.all(promises).then(() =>
      res.send({ responsePosts: responsePosts, authorizationSuccess: true })
    );
  } catch (err) {
    res.send({ responsePosts: [], authorizationSuccess: true });
  }
});

app.post("/savePost", AuthMiddleware, JWTAuthMiddleware, async (req, res) => {
  try {
    upload(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(500).json(err);
      } else if (err) {
        return res.status(500).json(err);
      }
      const { userId, postText, tagList, userName } = req.body;
      const existingUser = await userDb.findOne({ _id: userId });
      if (isNullOrUndefined(existingUser)) {
        res.send({
          successful: false,
          authorizationSuccess: true,
        });
        return;
      } else {
        const post = new postDb({
          likeCount: 0,
          postTimeStamp: Date.now(),
          comments: [],
          userId: existingUser._id,
          postText: postText,
          tagsRelatedToPost: tagList,
          userName: userName,
        });
        let imagesRelatedToPosts = [];
        if (!isNullOrUndefined(req.file)) {
          const obj = {
            name: userId,
            desc: `Posted by..${existingUser.userName}`,
            img: {
              data: fs.readFileSync(
                path.join(__dirname + "/uploads/" + req.file.filename)
              ),
              contentType: "image/png",
            },
          };
          const img = new imageDb(obj);
          await img.save();
          imagesRelatedToPosts.push(img);
          post.imageRelatedToPosts.push(img._id);
        }
        await post.save();
        existingUser.posts.push(post);
        await existingUser.save();
        res.send({
          post: post,
          liked: false,
          imagesRelatedToPosts: imagesRelatedToPosts,
          authorizationSuccess: true,
          successful: true,
        });
        return;
      }
    });
  } catch (err) {
    res.status(500).send({
      liked: false,
      imagesRelatedToPosts: [],
      authorizationSuccess: true,
      successful: false,
    });
    return;
  }
});

app.get("/getSearchResults/", AuthMiddleware, async (req, res) => {
  try {
    const searchVal = req.query.searchVal;
    let queryCond = [];
    queryCond.push({
      userName: { $regex: req.query.searchVal, $options: "i" },
    });
    queryCond.push({ skills: { $regex: req.query.searchVal, $options: "i" } });
    const userList = await userDb.find({ $or: queryCond });
    res.send(userList);
  } catch (err) {
    res.status(500).send({ userList: [], authorizationSuccess: true });
  }
});

app.get(
  "/getUsersPost",
  AuthMiddleware,
  JWTAuthMiddleware,
  async (req, res) => {
    try {
      const postIdStr = req.query.postIds;
      //const postIds = postIdStr.split(",");
      const offset = !isNaN(Number(req.query.offset))
        ? Number(req.query.offset)
        : 0;
      const limit = !isNaN(Number(req.query.limit))
        ? Number(req.query.limit)
        : 10;
      const posts = await postDb
        .find({ _id: { $in: req.query.postIds } })
        .skip(offset)
        .limit(limit);

      let responsePosts = [];
      let promises = [];
      let postIdImageListMap = new Map();
      posts.forEach((post) => {
        promises.push(
          imageDb
            .find({
              _id: { $in: post.imageRelatedToPosts },
            })
            .then((res) => {
              postIdImageListMap.set(post._id, res);
              responsePosts.push({
                post: post,
                imagesRelatedToPosts: postIdImageListMap.get(post._id),
              });
            })
        );
      });
      Promise.all(promises).then(() =>
        res.send({ responsePosts: responsePosts, authorizationSuccess: true })
      );
    } catch (err) {
      res.send({ responsePosts: [], authorizationSuccess: true });
    }
  }
);

app.post(
  "/postComment",
  AuthMiddleware,
  JWTAuthMiddleware,
  async (req, res) => {
    const { userId, postId, commentText, userName } = req.body;
    try {
      //const userData = await userDb.findOne({ _id: userId });
      const newCommentData = {
        postedBy: userName,
        commentText: commentText,
      };
      await postDb.updateOne(
        { _id: postId },
        { $push: { comments: newCommentData } }
      );
      res.send({
        success: true,
        authorizationSuccess: true,
      });
    } catch (err) {
      res.send({
        success: false,
        authorizationSuccess: true,
        errMsg: "Server Not working..",
      });
    }
  }
);

app.get("/logOut", AuthMiddleware, async (req, res) => {
  try {
    if (!isNullOrUndefined(req.session)) {
      // destroy the session
      req.session.destroy(() => {
        res.status(200).send({
          success: true,
          authorizationSuccess: true,
        });
      });
    } else {
      res.status(200).send({
        success: true,
        authorizationSuccess: true,
      });
    }
  } catch (err) {
    res.status(500).send({ success: false, authorizationSuccess: true });
  }
});

app.get("/getUserData", AuthMiddleware, async (req, res) => {
  try {
    console.log(`${req.session.userId} session inside get user data`);
    const existingUser = await userDb.findById(req.session.userId);
    if (isNullOrUndefined(existingUser)) {
      res.status(400).send({
        retrivalSuccess: false,
        authorizationSuccess: true,
        errorMsg: "User not registered with us. Please click on Sign Up.",
      });
    } else {
      res.status(200).send({
        userData: existingUser,
        retrivalSuccess: true,
        authorizationSuccess: true,
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      retrivalSuccess: false,
      authorizationSuccess: true,
    });
  }
});

app.get("/", async (req, res) => {
  res.send("Sever Running..");
});

app.listen(process.env.PORT || port, () =>
  console.log(`App listening on port ${port}!`)
);

module.exports = app;
