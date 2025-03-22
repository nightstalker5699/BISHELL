const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const Store = require("../models/StoreModel");
const appError = require("../utils/appError");

exports.addItem = factory.createOne(Store);
exports.updateItem = factory.updateOne(Store);
exports.deleteItem = factory.deleteOne(Store);

/*
    TODO: Create A Get All Items that have 2 features
    first status of the item which means if item is owned tell the req
    if item is not owned and you do not have enough currency tell him that 
    if item is not owned and you have enough currency tell him that
*/

exports.getAllItem = catchAsync(async (req, res, next) => {
  const items = await Store.find();
  let data = { Buy: [], Equip: [], Equipped: [] };
  const result = items.length;
  items.forEach((item) => {
    let status = !item.owners.includes(req.user._id)
      ? "Buy"
      : item.URL === req.user.userFrame
      ? "Equipped"
      : "Equip";

    let info = {
      name: item.name,
      price: item.price,
      URL: item.URL,
      currency: item.currency,
    };
    data[status].push(info);
  });
  res.status(200).json({
    message: "success",
    result,
    data,
  });
});

exports.buyItem = catchAsync(async (req, res, next) => {
  const item = await Store.findById(req.params.id);

  if (!item) return next(new appError("there is no item with that ID", 400));
  if (item.owners.includes(req.user._id))
    return next(new appError("you already have this", 400));
  if (req.user.stats[item.currency] < item.price)
    return next(new appError("you do not have enough", 400));

  req.user.stats["coins"] -= item.price;
  await req.user.save({ validateBeforeSave: false });
  item.owners.push(req.user._id);
  await item.save();
  res.status(200).json({
    message: "success",
    item,
  });
});

exports.equipItem = catchAsync(async (req, res, next) => {
  const item = await Store.findById(req.params.id);

  if (!item) return next(new appError("there is no item with that ID ", 400));

  if (!item.owners.includes(req.user._id))
    return next(new appError("the user do not own this item", 400));

  if (item.URL === req.user.userFrame)
    return next(new AppError("you already equipped it", 400));
  req.user.userFrame = item.URL;
  await req.user.save({ validateBeforeSave: false });

  res.status(200).json({ message: "success", user: req.user });
});
