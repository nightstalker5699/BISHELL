const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");
const Comment = require("./../models/commentModel");
const Post = require("./../models/postModel");
const factory = require("./handlerFactory");
exports.addComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return next(new appError("there is no post with that ID", 404));
  const comment = await Comment.create({
    userId: req.user._id,
    content: req.body.content,
    postId: req.params.postId,
  });
  post.comments.push(comment);
  await post.save();

  res.status(200).json({
    status: "success",
    data: {
      comment,
      user: {
        username: req.user.username,
        photo: req.user.photo,
      },
    },
  });
});

exports.updateComment = factory.updateOne(Comment);
exports.deleteComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return next(new appError("there is no post with that ID", 404));
  await Comment.findByIdAndDelete(req.params.id);
  post.comments = post.comments.filter(
    (comment) => comment.toString() !== req.params.id
  );
  await post.save();
  res.status(204).json({
    status: "success",
  });
});
exports.getAllComments = catchAsync(async (req, res, next) => {
  const comments = Comment.find({ postId: req.params.postId });
  res.status(200).json({
    status: "success",
    data: comments,
  });
});
