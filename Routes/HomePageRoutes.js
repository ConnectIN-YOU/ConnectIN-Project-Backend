const express = require("express");
const routes = express.Router();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const session = require("express-session");
const { postDb, userDb, imageDb } = require("../connector");
const fs = require("fs");
routes.use(express.json()); // added body key to req
const path = require("path");

const multer = require("multer");
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, `${__dirname}/../uploads/`);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage }).single("file");

const isNullOrUndefined = (val) => {
  return val === null || val === undefined || val === "";
};

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

routes.post(
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

routes.get(
  "/getPosts",
  AuthMiddleware,
  JWTAuthMiddleware,
  async (req, res) => {
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
  }
);

routes.post(
  "/savePost",
  async (req, res) => {
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
                  path.join(__dirname + "/../uploads/" + req.file.filename)
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
  }
);

routes.get("/getSearchResults/", AuthMiddleware, async (req, res) => {
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

routes.post(
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

routes.get("/logOut", AuthMiddleware, async (req, res) => {
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
module.exports = routes;
