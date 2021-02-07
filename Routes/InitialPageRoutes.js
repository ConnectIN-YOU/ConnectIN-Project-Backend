const express = require("express");
const routes = express.Router();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const session = require("express-session");
const { postDb, userDb, imageDb } = require("../connector");
routes.use(express.json()); // added body key to req

const isNullOrUndefined = (val) => {
  return val === null || val === undefined || val === "";
};

routes.post("/login", async (req, res) => {
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

routes.post("/signUp", async (req, res) => {
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

routes.post("/forgotPassword", async (req, res) => {
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
      let info = await transporter.sendMail({
        from: `${process.env.EMAIL}`, // sender address
        to: `${userEmail}`, // list of receivers
        subject: "Link to reset the Password", // Subject line
        text: `Hello ${existingUserList[0].userName}, You are recieving this email in order to change your password. Use the link below and reset the password! \n
          ${process.env.FRONTENDURL}reset/${token} `, // plain text body
        //html: "<b>Hello world?</b>", // html body
      });
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
    res.send({
      success: false,
      userPresent: false,
    });
  }
});

routes.post("/resetPW", async (req, res) => {
  try {
    const { userName, password, token } = req.body;
    const existingUser = await userDb.findOne({ userName });
    if (isNullOrUndefined(existingUser)) {
      res.send({
        userFound: false,
        success: true,
        tokenValid: false,
        dbConnectSuccess: false,
      });
      return;
    } else {
      if (
        isNullOrUndefined(existingUser.resetPasswordToken) &&
        existingUser.resetPasswordToken !== token
      ) {
        res.send({
          userFound: false,
          success: true,
          tokenValid: false,
          dbConnectSuccess: false,
        });
        return;
      }
      existingUser.password = password;
      existingUser.resetPasswordToken = "";
      try {
        await existingUser.save();
        res.send({
          userFound: true,
          success: true,
          tokenValid: true,
          dbConnectSuccess: true,
        });
      } catch (err) {
        res.send({
          userFound: false,
          success: false,
          tokenValid: true,
          dbConnectSuccess: false,
        });
      }
    }
  } catch (err) {
    res.send({
      userFound: false,
      success: false,
      tokenValid: false,
      dbConnectSuccess: false,
    });
  }
});

const testDataPostDB = async () => {
  await postDb.deleteMany();
  await userDb.deleteMany();
};
//testDataPostDB();

routes.post("/checkUserName", async (req, res) => {
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

routes.get("/getUserData", AuthMiddleware, async (req, res) => {
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
    res.status(500).send({
      retrivalSuccess: false,
      authorizationSuccess: true,
    });
  }
});

routes.get("/", async (req, res) => {
  res.send("Sever Running..");
});

module.exports = routes;
