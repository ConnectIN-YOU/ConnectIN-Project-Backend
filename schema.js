const { Schema } = require("mongoose");


const imageSchema = new Schema({
  name: String,
  desc: String,
  img: {
    data: Buffer,
    contentType: String,
  },
});

const userSchema = new Schema({
  userName: String,
  userEmail: String,
  gitHubLink: String,
  linkedInLink: String,
  password: String,
  company: String,
  designation: String,
  postsLiked: [String],
  followers: [Schema.Types.ObjectId],
  following: [Schema.Types.ObjectId],
  posts: [Schema.Types.ObjectId],
  skills: [String],
});

const postSchema = new Schema({
  postTimeStamp: { type: Date, default: Date.now },
  likeCount: Number,
  comments: [
    {
      postedBy: String,
      commentText: String,
    },
  ],
  userId: Schema.Types.ObjectId,
  postText: String,
  tagsRelatedToPost: [String],
  userName: String,
  imageRelatedToPosts: [{ type: Schema.Types.ObjectId, ref: 'Images' }]
});


exports.imageSchema = imageSchema;
exports.postSchema = postSchema;
exports.userSchema = userSchema;
