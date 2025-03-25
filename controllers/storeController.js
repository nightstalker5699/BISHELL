const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const Store = require("../models/StoreModel");
const appError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");

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
  // Parse parameters
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const category = req.query.category; // 'Buy', 'Equip', or 'Equipped'

  // Base query
  let query = Store.find();
  let countQuery = Store.find();

  // Apply category filter if specified
  if (category) {
    let filter;
    if (category === "Buy") {
      // Items not owned by user
      filter = { owners: { $ne: req.user._id } };
    } else if (category === "Equip") {
      // Items owned by user but not equipped
      filter = {
        owners: req.user._id,
        URL: { $ne: req.user.userFrame },
      };
    } else if (category === "Equipped") {
      // Items currently equipped
      filter = {
        owners: req.user._id,
        URL: req.user.userFrame,
      };
    }
    countQuery = Store.find(filter);
    query = Store.find(filter);
  }

  // Get total count for the specific category
  const total = await countQuery.countDocuments();

  // Apply APIFeatures for sorting and pagination to the filtered query
  const features = new APIFeatures(query, req.query).sort().paginate();

  // Execute query
  const items = await features.query;

  // Process items with proper categorization
  let data = { Buy: [], Equip: [], Equipped: [] };

  items.forEach((item) => {
    let status = !item.owners.includes(req.user._id)
      ? "Buy"
      : item.URL === req.user.userFrame
      ? "Equipped"
      : "Equip";

    let info = {
      id: item._id,
      name: item.name,
      price: item.price,
      URL: item.URL,
      currency: item.currency,
      canAfford: req.user.stats[item.currency] >= item.price,
    };

    // If a category was specified, only add to that category
    if (category) {
      if (status === category) {
        data[status].push(info);
      }
    } else {
      // Otherwise add to all categories as before
      data[status].push(info);
    }
  });

  res.status(200).json({
    status: "success",
    results: items.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit,
      category: category || "All",
    },
    data: category ? { [category]: data[category] } : data,
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
