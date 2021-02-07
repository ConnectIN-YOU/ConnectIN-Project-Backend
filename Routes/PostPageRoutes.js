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

routes.get(
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
module.exports = routes;
