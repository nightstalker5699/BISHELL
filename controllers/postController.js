const appError = require("./../utils/appError");
const catchAsync = require("./../utils/catchAsync");
const Post = require("./../models/postModel");
const factory = require("./handlerFactory");
exports.getPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id).populate("comments");
  if (!post) next(new appError("there is no post with this id", 404));
  res.status(200).json({ message: "success", data: post });
});

exports.createPost = catchAsync(async (req, res, next) => {
  const post = await Post.create({
    userId: req.user.id,
    title: req.body.title,
    content: req.body.content,
  });

  res.status(200).json({ message: "success", data: post });
});
exports.getAllPost = factory.getAll(Post);
exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new appError("there is no post with that ID", 404));
  if (req.user.role !== "admin" && !post.userId.equals(req.user.id))
    // reject his request
    return next(new appError("you can't delete someone post", 403));
  await Post.findByIdAndDelete(req.params.id);
  res.status(204).json({
    status: "message",
    data: null,
  });
});
exports.updatePost = catchAsync(async (req, res, next) => {
  // get the required post
  const post = await Post.findById(req.params.id);
  // if the user trying to update is not the admin or the post owner
  if (req.user.role !== "admin" && !post.userId.equals(req.user.id))
    // reject his request
    return next(new appError("you can't update someone post", 403));
  // update fields
  post.title = req.body.title || post.title;
  post.content = req.body.content || post.content;
  //save it and send it to the user
  await post.save();
  res.status(200).json({ status: "success", data: post });
});

exports.likePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) return next(new appError("there is no post with this ID", 404));
  if (post.likes.includes(req.user._id))
    return next(new appError("you already liked this post", 400));

  post.likes.push(req.user._id);
  await post.save();
  res.status(200).json({
    status: "success",
    data: post,
  });
});

exports.unlikePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) return next(new appError("there is no post with this ID", 404));
  if (!post.likes.includes(req.user._id))
    return next(new appError("you already unliked this post", 400));

  post.likes = post.likes.filter(
    (id) => id.toString() !== req.user._id.toString()
  );
  await post.save();
  res.status(200).json({
    status: "success",
    data: post,
  });
});
